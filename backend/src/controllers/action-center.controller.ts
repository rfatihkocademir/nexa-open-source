import { Request, Response } from 'express';
import { actionCenterService } from '../services/action-center.service';
import { auditService } from '../services/audit.service';
import { sendResponse } from '../utils/apiResponse';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuditContext, getRequestActor } from '../utils/requestContext';

export class ActionCenterController {
    static async list(req: Request, res: Response) {
        try {
            sendResponse(res, 200, await actionCenterService.list(getRequestActor(req), req.query));
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async summary(req: Request, res: Response) {
        try {
            sendResponse(res, 200, await actionCenterService.summary(getRequestActor(req), req.query));
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async reconcile(req: Request, res: Response) {
        try {
            const actor = getRequestActor(req);
            const result = await actionCenterService.reconcile(actor);
            await auditService.log({
                context: getAuditContext(req),
                entityType: 'ActionCenter',
                entityId: actor.organizationId,
                action: 'ACTION_CENTER_RECONCILE',
                after: result,
            }, true);
            sendResponse(res, 200, result, 'Riskler yenilendi ve aksiyon merkezi uzlaştırıldı.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async update(req: Request, res: Response) {
        try {
            const result = await actionCenterService.update(getRequestActor(req), req.params.id, req.body || {});
            await auditService.log({
                context: getAuditContext(req, result.item.projectId || undefined),
                entityType: 'ActionCenterItem',
                entityId: result.item.id,
                action: 'ACTION_CENTER_ITEM_UPDATE',
                before: result.before,
                after: result.item,
                reason: result.item.resolution || undefined,
            }, true);
            sendResponse(res, 200, result.item, 'Aksiyon güncellendi.');
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async bulkUpdate(req: Request, res: Response) {
        try {
            const actor = getRequestActor(req);
            const result = await actionCenterService.bulkUpdate(actor, req.body || {});
            await auditService.log({
                context: getAuditContext(req),
                entityType: 'ActionCenterItem',
                entityId: `bulk:${result.ids.length}`,
                action: 'ACTION_CENTER_BULK_UPDATE',
                before: result.before,
                after: { ids: result.ids, changes: req.body, updated: result.updated },
                reason: typeof req.body?.resolution === 'string' ? req.body.resolution : undefined,
            }, true);
            sendResponse(res, 200, { updated: result.updated }, `${result.updated} aksiyon güncellendi.`);
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async convertToWorkItem(req: Request, res: Response) {
        try {
            const actor = getRequestActor(req);
            const result = await actionCenterService.convertToWorkItem(actor, req.params.id, req.body || {});
            await auditService.log({
                context: getAuditContext(req, result.projectId),
                entityType: 'ActionCenterItem',
                entityId: req.params.id,
                action: 'ACTION_CENTER_CONVERT_TO_WORK_ITEM',
                after: result,
            }, true);
            if (result.created) {
                await auditService.log({
                    context: getAuditContext(req, result.projectId),
                    entityType: 'WorkItem',
                    entityId: result.id,
                    action: 'WORKITEM_CREATE',
                    after: { id: result.id, key: result.key, sourceActionCenterItemId: req.params.id },
                }, true);
            }
            sendResponse(res, result.created ? 201 : 200, result, result.created ? 'Aksiyondan iş oluşturuldu.' : 'Aksiyon mevcut işe bağlandı.');
        } catch (error) { respondWithControllerError(res, error); }
    }
}
