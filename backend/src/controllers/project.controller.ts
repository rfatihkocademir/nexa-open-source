import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { exportService } from '../services/export.service';
import { sendResponse } from '../utils/apiResponse';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { getAuthorizedProjectId, getRequestActor } from '../utils/requestContext';

export class ProjectController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, organizationId } = getRequestActor(req);
            const project = await projectService.create(req.body, userId, organizationId);
            sendResponse(res, 201, project, 'Project created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const sortBy = (req.query.sortBy as string) || 'createdAt';
            const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
            const status = (req.query.status as 'ACTIVE' | 'ARCHIVED') || 'ACTIVE';

            const result = await projectService.getAll(userId, role, organizationId, page, limit, sortBy, sortOrder, status);
            sendResponse(res, 200, result, 'Projects retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const projectId = getAuthorizedProjectId(req, req.params.id);
            const project = await projectService.getById(projectId, userId, role, organizationId);
            sendResponse(res, 200, project, 'Project retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async addMember(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const identifier = req.body.email || req.body.userId;
            const member = await projectService.addMember(getAuthorizedProjectId(req, req.params.id), identifier, userId, role, organizationId);
            sendResponse(res, 201, member, 'Member added successfully');
        } catch (error) {
            next(error);
        }
    }

    async removeMember(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            await projectService.removeMember(getAuthorizedProjectId(req, req.params.id), req.params.userId, userId, role, organizationId);
            sendResponse(res, 204, null, 'Member removed successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const project = await projectService.update(getAuthorizedProjectId(req, req.params.id), req.body, userId, role, organizationId);
            sendResponse(res, 200, project, 'Project updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAvailableTeams(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            const teams = await projectService.getAvailableTeams(organizationId);
            sendResponse(res, 200, teams, 'Teams retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async archive(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const project = await projectService.archive(getAuthorizedProjectId(req, req.params.id), userId, role, organizationId);
            sendResponse(res, 200, project, 'Project archived successfully');
        } catch (error) {
            next(error);
        }
    }

    async unarchive(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const project = await projectService.unarchive(getAuthorizedProjectId(req, req.params.id), userId, role, organizationId);
            sendResponse(res, 200, project, 'Project unarchived successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            await projectService.delete(getAuthorizedProjectId(req, req.params.id), userId, role, organizationId);
            sendResponse(res, 204, null, 'Project deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async getWarnings(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const warnings = await projectService.getWarnings(userId, role, organizationId);
            sendResponse(res, 200, warnings, 'Project warnings retrieved');
        } catch (error) {
            next(error);
        }
    }

    async exportCases(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = getAuthorizedProjectId(req, req.params.id);
            const buffer = await exportService.exportTestCases(projectId, userId, role);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=project-${projectId}-test-cases.xlsx`);
            res.send(buffer);
        } catch (error) {
            next(error);
        }
    }


    async generateQuestions(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, language } = req.body;
            const result = await projectService.generateQuestions(name, description, language);
            sendResponse(res, 200, result, 'Questions generated successfully');
        } catch (error) {
            next(error);
        }
    }

    async generateScope(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, qaPairs, language } = req.body;
            const result = await projectService.generateScope(name, description, qaPairs || [], language);
            sendResponse(res, 200, result, 'Scope generated successfully');
        } catch (error) {
            next(error);
        }
    }

    async generateWiki(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, scope, architecture, language } = req.body;
            const result = await projectService.generateConsolidatedWiki(name, description, scope, architecture, language);
            sendResponse(res, 200, result, 'Wiki generated successfully');
        } catch (error) {
            next(error);
        }
    }

    async generateDocumentationSuite(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, qaPairs, language } = req.body;
            const result = await projectService.generateDocumentationSuite(name, description, qaPairs || [], language);
            sendResponse(res, 200, result, 'Documentation suite generated successfully');
        } catch (error) {
            next(error);
        }
    }

    async generateArchitectureQuestions(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, scopeSummary, language } = req.body;
            const result = await projectService.generateArchitectureQuestions(name, description, scopeSummary || '', language);
            sendResponse(res, 200, result, 'Architecture questions generated successfully');
        } catch (error) {
            next(error);
        }
    }

    async generateArchitectureDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description, scopeSummary, qaPairs, language } = req.body;
            const result = await projectService.generateArchitectureDocument(name, description, scopeSummary || '', qaPairs || [], language);
            sendResponse(res, 200, result, 'Architecture document generated successfully');
        } catch (error) {
            next(error);
        }
    }


    async getElements(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.id);
            const elements = await prisma.projectElement.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' }
            });
            sendResponse(res, 200, elements, 'Elements retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async saveElement(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.id);
            const { name, locator, type, pageUrl, description } = req.body;
            const element = await prisma.projectElement.create({
                data: {
                    projectId,
                    name,
                    locator,
                    type,
                    pageUrl,
                    description
                }
            });
            sendResponse(res, 201, element, 'Element saved successfully');
        } catch (error) {
            next(error);
        }
    }

    async deleteElement(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.id);
            const result = await prisma.projectElement.deleteMany({
                where: {
                    id: req.params.elementId,
                    projectId,
                }
            });

            if (result.count === 0) {
                throw new AppError('Element not found', 404);
            }

            sendResponse(res, 204, null, 'Element deleted successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const projectController = new ProjectController();
