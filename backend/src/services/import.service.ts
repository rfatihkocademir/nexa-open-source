import ExcelJS from 'exceljs';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { Priority } from '@prisma/client';

interface ExcelTestCase {
    Title: string;
    Description?: string;
    Preconditions?: string;
    Priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    StepAction: string;
    StepExpected: string;
}

export class ImportService {
    private static readonly MAX_ROWS = 10_000;
    async importTestCases(fileBuffer: Buffer, suiteId: string, userId: string, expectedProjectId?: string) {
        // Check if suite exists
        const suite = await prisma.testSuite.findUnique({
            where: { id: suiteId },
            select: { id: true, projectId: true },
        });

        if (!suite) {
            throw new AppError('Test suite not found', 404);
        }
        if (expectedProjectId && suite.projectId !== expectedProjectId) {
            throw new AppError('Suite ve proje aynı kapsama ait olmalıdır', 400);
        }

        // Parse Excel. ExcelJS avoids the known prototype-pollution/ReDoS
        // vulnerabilities in the previously used SheetJS npm package.
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            throw new AppError('Excel file is empty', 400);
        }

        const headers: string[] = [];
        sheet.getRow(1).eachCell((cell, columnNumber) => {
            headers[columnNumber] = cell.text.trim();
        });
        for (const requiredHeader of ['Title', 'StepAction', 'StepExpected']) {
            if (!headers.includes(requiredHeader)) {
                throw new AppError(`Excel başlığı eksik: ${requiredHeader}`, 400);
            }
        }

        const rows: ExcelTestCase[] = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            if (rowNumber > ImportService.MAX_ROWS + 1) throw new AppError(`Excel row limit is ${ImportService.MAX_ROWS}`, 400);
            const record: Record<string, string> = {};
            row.eachCell((cell, columnNumber) => {
                const header = headers[columnNumber];
                if (header) record[header] = cell.text.trim();
            });
            if (Object.values(record).some(Boolean)) rows.push(record as unknown as ExcelTestCase);
        });

        if (rows.length === 0) {
            throw new AppError('Excel file is empty', 400);
        }
        if (rows.length > ImportService.MAX_ROWS) {
            throw new AppError(`Maximum ${ImportService.MAX_ROWS} test cases can be imported`, 400);
        }

        let createdCount = 0;

        // Process rows
        // Note: This simple implementation assumes one row per test case for simplicity in this MVP.
        // For multi-step cases in Excel, we'd need a more complex grouping logic (e.g. by Title or ID).
        // Here we assume each row is a separate case with 1 step, or we could group by Title if adjacent.

        // Grouping by Title to support multiple steps
        const groupedCases = new Map<string, {
            title: string;
            description?: string;
            preconditions?: string;
            priority: Priority;
            steps: Array<{ action: string; expected: string }>;
        }>();

        for (const row of rows) {
            if (!row.Title || !row.StepAction || !row.StepExpected) {
                throw new AppError('Title, StepAction ve StepExpected alanları her veri satırında zorunludur', 400);
            }

            const priority = String(row.Priority || 'MEDIUM').toUpperCase() as Priority;
            if (!Object.values(Priority).includes(priority)) throw new AppError(`Geçersiz öncelik: ${row.Priority}`, 400);
            if (!groupedCases.has(row.Title)) {
                groupedCases.set(row.Title, {
                    title: row.Title,
                    description: row.Description,
                    preconditions: row.Preconditions,
                    priority,
                    steps: [],
                });
            }

            groupedCases.get(row.Title)!.steps.push({
                action: row.StepAction,
                expected: row.StepExpected,
            });
        }

        // Bulk Create
        // Prisma doesn't support deep nested createMany, so we loop.
        // For performance in large files, we'd use createMany for cases and then createMany for steps,
        // but steps are JSON in our schema, so it's easier.

        await prisma.$transaction(async (tx) => {
            for (const caseData of groupedCases.values()) {
                const projectTC = await tx.project.update({
                    where: { id: suite.projectId },
                    data: { nextTestCaseNumber: { increment: 1 } },
                    select: { key: true, nextTestCaseNumber: true },
                });
                const tcSeq = projectTC.nextTestCaseNumber - 1;

                const newCase = await tx.testCase.create({
                    data: {
                        title: caseData.title,
                        description: caseData.description,
                        preconditions: caseData.preconditions,
                        priority: caseData.priority,
                        suiteId,
                        authorId: userId,
                        status: 'DRAFT',
                        version: 1,
                        key: `${projectTC.key}-TC-${tcSeq}`,
                        sequenceNumber: tcSeq,
                    },
                });

                for (let i = 0; i < caseData.steps.length; i++) {
                    const step = caseData.steps[i];
                    const newStep = await tx.testStep.create({
                        data: {
                            projectId: suite.projectId,
                            action: step.action,
                            expectedResult: step.expected,
                        },
                    });
                    await tx.testCaseStep.create({
                        data: { testCaseId: newCase.id, testStepId: newStep.id, orderIndex: i },
                    });
                }
                createdCount++;
            }
        });

        return { count: createdCount };
    }
}

export const importService = new ImportService();
