import type { Request, Response, NextFunction } from 'express';
import { sprintPlanningService } from '../services/sprint-planning.service';
import { getRequestActor } from '../utils/requestContext';
import { sendResponse } from '../utils/apiResponse';

export const SprintPlanningController = {
    async report(req: Request, res: Response, next: NextFunction) {
        try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.report(req.params.id, actor.userId, actor.role)); }
        catch (error) { next(error); }
    },
    async saveMemberCapacity(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.saveMemberCapacity(req.params.id, req.params.userId, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async addException(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 201, await sprintPlanningService.addException(req.params.id, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async addHoliday(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 201, await sprintPlanningService.addHoliday(req.params.id, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async deleteException(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.deleteException(req.params.id, req.params.exceptionId, actor.userId, actor.role)); } catch (error) { next(error); } },
    async deleteHoliday(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.deleteHoliday(req.params.id, req.params.holidayId, actor.userId, actor.role)); } catch (error) { next(error); } },
    async saveEstimate(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.saveEstimate(req.params.id, req.params.workItemId, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async addDependency(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 201, await sprintPlanningService.addDependency(req.params.id, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async deleteDependency(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.deleteDependency(req.params.id, req.params.dependencyId, actor.userId, actor.role)); } catch (error) { next(error); } },
    async createSession(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 201, await sprintPlanningService.createSession(req.params.id, req.body, actor.userId, actor.role)); } catch (error) { next(error); } },
    async transitionSession(req: Request, res: Response, next: NextFunction) { try { const actor = getRequestActor(req); sendResponse(res, 200, await sprintPlanningService.transitionSession(req.params.id, req.params.sessionId, req.body.status, actor.userId, actor.role)); } catch (error) { next(error); } },
};
