import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

export class ExportService {
    private async createWorkbook(data: Record<string, unknown>[], sheetName: string): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);
        const headers = data.length > 0 ? Object.keys(data[0]) : [];

        worksheet.columns = headers.map((header) => ({
            header,
            key: header,
            width: Math.min(50, Math.max(14, header.length + 2)),
        }));
        worksheet.addRows(data);
        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const result = await workbook.xlsx.writeBuffer();
        return Buffer.from(result);
    }

    async exportTestRunResults(runId: string, userId: string, role: string): Promise<Buffer> {
        await ProjectAccess.checkByRun(runId, userId, role);
        const run = await prisma.testRun.findUnique({
            where: { id: runId },
            include: {
                items: {
                    include: {
                        testCase: true,
                        results: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        const data = run.items.map(item => ({
            'Test Case': item.testCase.title,
            'Manual Status': item.manualStatus,
            'Automation Status': item.automationStatus,
            'Final Status': item.finalStatus,
            'Executed At': item.manualExecutedAt || item.automationExecutedAt || 'N/A',
            'Comment': item.results[0]?.comment || ''
        }));

        return this.createWorkbook(data, 'Results');
    }

    async exportTestCases(projectId: string, userId: string, role: string): Promise<Buffer> {
        await ProjectAccess.check(projectId, userId, role);
        const cases = await prisma.testCase.findMany({
            where: { suite: { projectId } },
            include: { suite: true }
        });

        const data = cases.map(c => ({
            'Suite': c.suite.name,
            'Title': c.title,
            'Description': c.description || '',
            'Preconditions': c.preconditions || '',
            'Priority': c.priority,
            'Status': c.status,
            'Version': c.version
        }));

        return this.createWorkbook(data, 'Test Cases');
    }

    async exportComparisonReport(runId: string, userId: string, role: string): Promise<Buffer> {
        await ProjectAccess.checkByRun(runId, userId, role);
        const run = await prisma.testRun.findUnique({
            where: { id: runId },
            include: {
                items: {
                    include: {
                        testCase: true
                    }
                }
            }
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks: any[] = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            doc.fontSize(20).text('Test Execution Comparison Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Run: ${run.title}`);
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown();

            // Stats
            doc.fontSize(16).text('Summary Statistics');
            doc.fontSize(12).text(`Total Tests: ${run.totalItems}`);
            doc.text(`Passed: ${run.passedCount}`);
            doc.text(`Failed: ${run.failedCount}`);
            doc.text(`Blocked: ${run.blockedCount}`);
            doc.text(`Untested: ${run.untestedCount}`);
            doc.moveDown();

            // Comparison Table (Simplified)
            doc.fontSize(16).text('Detailed Comparison');
            doc.moveDown();

            run.items.forEach((item, index) => {
                doc.fontSize(10).text(`${index + 1}. ${item.testCase.title}`);
                doc.text(`   Manual: ${item.manualStatus} | Automation: ${item.automationStatus} | Final: ${item.finalStatus}`);
                if (item.finalStatus === 'CONFLICT') {
                    doc.fillColor('red').text('   [!] CONFLICT DETECTED', { indent: 20 }).fillColor('black');
                }
                doc.moveDown(0.5);
            });

            doc.end();
        });
    }
}

export const exportService = new ExportService();
