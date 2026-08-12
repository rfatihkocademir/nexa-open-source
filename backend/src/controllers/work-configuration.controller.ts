import { Request, Response } from 'express';
import { workConfigurationService } from '../services/work-configuration.service';
import { getAuditContext, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';
import { auditService } from '../services/audit.service';

export class WorkConfigurationController {
    static async list(req: Request, res: Response) {
        try {
            res.json(await workConfigurationService.list(getAuthorizedProjectId(req, req.query.projectId)));
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async createWorkType(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            const record = await workConfigurationService.createWorkType(projectId, req.body);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'WorkTypeDefinition', entityId: record.id, action: 'CREATE', after: record }, true);
            res.status(201).json(record);
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async updateWorkType(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId || req.query.projectId);
            const record = await workConfigurationService.updateWorkType(projectId, req.params.id, req.body);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'WorkTypeDefinition', entityId: record.id, action: 'UPDATE', after: record }, true);
            res.json(record);
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async createCustomField(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            const record = await workConfigurationService.createCustomField(projectId, req.body);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'CustomFieldDefinition', entityId: record.id, action: 'CREATE', after: record }, true);
            res.status(201).json(record);
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async updateCustomField(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId || req.query.projectId);
            const record = await workConfigurationService.updateCustomField(projectId, req.params.id, req.body);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'CustomFieldDefinition', entityId: record.id, action: 'UPDATE', after: record }, true);
            res.json(record);
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async deleteCustomField(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            await workConfigurationService.deleteCustomField(projectId, req.params.id);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'CustomFieldDefinition', entityId: req.params.id, action: 'DELETE' }, true);
            res.status(204).send();
        } catch (error) { respondWithControllerError(res, error); }
    }
}
