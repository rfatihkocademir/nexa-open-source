import { Request, Response } from 'express';
import { AgileService } from '../services/agile.service';
import { AppError } from '../utils/AppError';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectId } from '../utils/requestContext';
import { sendResponse } from '../utils/apiResponse';

const agileService = new AgileService();

export class AgileController {
    async getBoard(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.projectId);
            const getQueryValue = (value: unknown): string | undefined => {
                if (Array.isArray(value)) return value[0];
                if (typeof value === 'string') return value;
                return undefined;
            };

            const data = await agileService.getBoardData(projectId, {
                sprintId: getQueryValue(req.query.sprintId),
                assigneeId: getQueryValue(req.query.assigneeId),
                priority: getQueryValue(req.query.priority),
                itemType: getQueryValue(req.query.itemType),
                search: getQueryValue(req.query.search)
            });

            sendResponse(res, 200, data, 'Board data retrieved successfully');
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch board data');
        }
    }

    async moveItem(req: Request, res: Response) {
        try {
            const { type, id } = req.params;
            const { status } = req.body;

            if (!['story', 'bug', 'task'].includes(type)) {
                throw new AppError('Invalid item type', 400);
            }

            const result = await agileService.moveItem(type as 'story' | 'bug' | 'task', id, status, undefined, {
                userId: req.user!.id,
                role: req.user!.role,
            });
            sendResponse(res, 200, result, 'Item moved successfully');
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to move item');
        }
    }

    async getSprintCompletionStats(req: Request, res: Response) {
        try {
            const { sprintId } = req.params;
            const stats = await agileService.getSprintCompletionStats(sprintId);
            sendResponse(res, 200, stats, 'Sprint completion stats retrieved');
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to get sprint stats');
        }
    }

    async completeSprint(req: Request, res: Response) {
        try {
            const { sprintId } = req.params;
            const { incompleteItemsAction, nextSprintId } = req.body;

            if (!['MOVE_TO_BACKLOG', 'MOVE_TO_NEXT_SPRINT'].includes(incompleteItemsAction)) {
                throw new AppError('Invalid incompleteItemsAction. Must be MOVE_TO_BACKLOG or MOVE_TO_NEXT_SPRINT', 400);
            }

            if (incompleteItemsAction === 'MOVE_TO_NEXT_SPRINT' && !nextSprintId) {
                throw new AppError('nextSprintId is required when action is MOVE_TO_NEXT_SPRINT', 400);
            }

            const result = await agileService.completeSprint(sprintId, incompleteItemsAction, nextSprintId);
            sendResponse(res, 200, result, 'Sprint completed successfully');
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to complete sprint');
        }
    }
}
