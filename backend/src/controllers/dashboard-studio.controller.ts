import { Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { dashboardStudioService } from '../services/dashboard-studio.service';
import { sendResponse } from '../utils/apiResponse';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuditContext, getRequestActor } from '../utils/requestContext';

export class DashboardStudioController {
    static async catalog(_req: Request, res: Response) {
        try { sendResponse(res, 200, await dashboardStudioService.catalog()); }
        catch (error) { respondWithControllerError(res, error); }
    }

    static async list(req: Request, res: Response) {
        try { sendResponse(res, 200, await dashboardStudioService.list(getRequestActor(req))); }
        catch (error) { respondWithControllerError(res, error); }
    }

    static async ensureDefault(req: Request, res: Response) {
        try {
            const initialized = await dashboardStudioService.ensureDefault(getRequestActor(req));
            const { wasCreated, ...record } = initialized;
            if (wasCreated) {
                await auditService.log({
                    context: getAuditContext(req),
                    entityType: 'DashboardDefinition',
                    entityId: record.id,
                    action: 'DASHBOARD_DEFAULT_CREATE',
                    after: record,
                }, true);
            }
            sendResponse(res, wasCreated ? 201 : 200, record);
        }
        catch (error) { respondWithControllerError(res, error); }
    }

    static async data(req: Request, res: Response) {
        try { sendResponse(res, 200, await dashboardStudioService.data(getRequestActor(req), req.params.id)); }
        catch (error) { respondWithControllerError(res, error); }
    }

    static async create(req: Request, res: Response) {
        try {
            const record = await dashboardStudioService.create(getRequestActor(req), req.body || {});
            await auditService.log({ context: getAuditContext(req, record.projectId || undefined), entityType: 'DashboardDefinition', entityId: record.id, action: 'DASHBOARD_CREATE', after: record }, true);
            sendResponse(res, 201, record, 'Dashboard oluşturuldu.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async update(req: Request, res: Response) {
        try {
            const record = await dashboardStudioService.updateDefinition(getRequestActor(req), req.params.id, req.body || {});
            await auditService.log({ context: getAuditContext(req, record.projectId || undefined), entityType: 'DashboardDefinition', entityId: record.id, action: 'DASHBOARD_UPDATE', after: record }, true);
            sendResponse(res, 200, record, 'Dashboard güncellendi.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async saveLayout(req: Request, res: Response) {
        try {
            const record = await dashboardStudioService.saveLayout(getRequestActor(req), req.params.id, req.body?.widgets, req.body?.expectedLayoutVersion);
            await auditService.log({ context: getAuditContext(req, record.projectId || undefined), entityType: 'DashboardDefinition', entityId: record.id, action: 'DASHBOARD_LAYOUT_UPDATE', after: { layoutVersion: record.layoutVersion, widgetCount: record.widgets.length } }, true);
            sendResponse(res, 200, record, 'Dashboard düzeni kaydedildi.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async setDefault(req: Request, res: Response) {
        try {
            const record = await dashboardStudioService.setDefault(getRequestActor(req), req.params.id);
            await auditService.log({ context: getAuditContext(req, record.projectId || undefined), entityType: 'DashboardPreference', entityId: getRequestActor(req).userId, action: 'DASHBOARD_DEFAULT_SET', after: { dashboardId: record.id } });
            sendResponse(res, 200, record, 'Varsayılan dashboard güncellendi.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async archive(req: Request, res: Response) {
        try {
            const result = await dashboardStudioService.archive(getRequestActor(req), req.params.id);
            await auditService.log({ context: getAuditContext(req, result.item.projectId || undefined), entityType: 'DashboardDefinition', entityId: result.item.id, action: 'DASHBOARD_ARCHIVE', before: result.before, after: result.item }, true);
            sendResponse(res, 200, { id: result.item.id }, 'Dashboard arşivlendi.');
        } catch (error) { respondWithControllerError(res, error); }
    }
}
