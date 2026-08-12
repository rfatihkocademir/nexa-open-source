import { Request, Response, NextFunction } from 'express';
import { importService } from '../services/import.service';
import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';
import { sendResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { getRequestActor } from '../utils/requestContext';

export class ImportController {
    async importTestCases(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            if (!req.file) {
                throw new AppError('Please upload an Excel file', 400);
            }

            let suiteId = req.body.suiteId;
            const projectId = req.body.projectId;

            if (!suiteId && !projectId) {
                throw new AppError('Suite ID or Project ID is required', 400);
            }

            if (suiteId) {
                await ProjectAccess.checkBySuite(suiteId, userId, role);
            }

            if (suiteId && projectId) {
                const suiteProject = await prisma.testSuite.findUnique({ where: { id: suiteId }, select: { projectId: true } });
                if (!suiteProject || suiteProject.projectId !== projectId) {
                    throw new AppError('Suite ve proje aynı kapsama ait olmalıdır', 400);
                }
                await ProjectAccess.check(projectId, userId, role);
            }

            if (!suiteId && projectId) {
                await ProjectAccess.check(projectId, userId, role);
                // Find or create a default suite for the project
                let suite = await prisma.testSuite.findFirst({
                    where: { projectId, name: 'Imported Cases' }
                });

                if (!suite) {
                    suite = await prisma.testSuite.create({
                        data: {
                            name: 'Imported Cases',
                            projectId: projectId
                        }
                    });
                }
                suiteId = suite.id;
            }

            const result = await importService.importTestCases(
                req.file.buffer,
                suiteId,
                userId,
                projectId
            );

            sendResponse(res, 201, result, `Successfully imported ${result.count} test cases`);
        } catch (error) {
            next(error);
        }
    }
}

export const importController = new ImportController();
