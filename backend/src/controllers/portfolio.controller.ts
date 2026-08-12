import { Request, Response } from 'express';
import { portfolioService } from '../services/portfolio.service';
import { getAuditContext, getRequestActor } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';
import { sendResponse } from '../utils/apiResponse';
import { auditService } from '../services/audit.service';

export class PortfolioController {
    static async list(req: Request, res: Response) { try { sendResponse(res, 200, await portfolioService.list(getRequestActor(req))); } catch (error) { respondWithControllerError(res, error); } }
    static async dashboard(req: Request, res: Response) { try { sendResponse(res, 200, await portfolioService.dashboard(getRequestActor(req), req.params.id)); } catch (error) { respondWithControllerError(res, error); } }
    static async create(req: Request, res: Response) { try {
        const actor = getRequestActor(req); const record = await portfolioService.create(actor, req.body);
        await auditService.log({ context: getAuditContext(req), entityType: 'Portfolio', entityId: record.id, action: 'PORTFOLIO_CREATE', after: record }, true);
        sendResponse(res, 201, record, 'Portföy oluşturuldu.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async update(req: Request, res: Response) { try {
        const record = await portfolioService.update(getRequestActor(req), req.params.id, req.body);
        await auditService.log({ context: getAuditContext(req), entityType: 'Portfolio', entityId: record.id, action: 'PORTFOLIO_UPDATE', after: record }, true);
        sendResponse(res, 200, record, 'Portföy güncellendi.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async createProgram(req: Request, res: Response) { try {
        const record = await portfolioService.createProgram(getRequestActor(req), req.params.id, req.body);
        await auditService.log({ context: getAuditContext(req), entityType: 'PortfolioProgram', entityId: record.id, action: 'PORTFOLIO_PROGRAM_CREATE', after: record }, true);
        sendResponse(res, 201, record, 'Program oluşturuldu.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async linkProject(req: Request, res: Response) { try {
        const record = await portfolioService.linkProject(getRequestActor(req), req.params.id, req.body);
        await auditService.log({ context: getAuditContext(req, req.body.projectId), entityType: 'PortfolioProject', entityId: record.id, action: 'PORTFOLIO_PROJECT_LINK', after: record }, true);
        sendResponse(res, 200, record, 'Proje portföye bağlandı.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async createInitiative(req: Request, res: Response) { try {
        const record = await portfolioService.createInitiative(getRequestActor(req), req.params.id, req.body);
        await auditService.log({ context: getAuditContext(req, req.body.projectId), entityType: 'PortfolioInitiative', entityId: record.id, action: 'PORTFOLIO_INITIATIVE_CREATE', after: record }, true);
        sendResponse(res, 201, record, 'Initiative oluşturuldu.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async updateInitiative(req: Request, res: Response) { try {
        const record = await portfolioService.updateInitiative(getRequestActor(req), req.params.id, req.params.initiativeId, req.body);
        await auditService.log({ context: getAuditContext(req, record.projectId || undefined), entityType: 'PortfolioInitiative', entityId: record.id, action: 'PORTFOLIO_INITIATIVE_UPDATE', after: record }, true);
        sendResponse(res, 200, record, 'Initiative güncellendi.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async addDependency(req: Request, res: Response) { try {
        const record = await portfolioService.addDependency(getRequestActor(req), req.params.id, req.body);
        await auditService.log({ context: getAuditContext(req), entityType: 'PortfolioDependency', entityId: record.id, action: 'PORTFOLIO_DEPENDENCY_CREATE', after: record }, true);
        sendResponse(res, 201, record, 'Bağımlılık oluşturuldu.');
    } catch (error) { respondWithControllerError(res, error); } }
    static async scenario(req: Request, res: Response) { try { sendResponse(res, 200, await portfolioService.scenario(getRequestActor(req), req.params.id, req.body), 'Senaryo hesaplandı.'); } catch (error) { respondWithControllerError(res, error); } }
}
