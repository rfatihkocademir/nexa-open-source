
import { Request, Response } from 'express';
import { WorklogService } from '../services/worklog.service';
import { respondWithControllerError } from '../utils/controllerError';
import { getRequestActor } from '../utils/requestContext';

export class WorklogController {
    static async weeklySummary(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            res.json(await WorklogService.getWeeklySummary(userId, role, String(req.query.projectId || ''), req.query.weekStart as string | undefined));
        } catch (error) { respondWithControllerError(res, error); }
    }

    static async getTimesheet(req: Request, res: Response) {
        console.log("REACHED getTimesheet endpoint!");
        try {
            const { userId, role } = getRequestActor(req);
            const { projectId, startDate, endDate } = req.query;
            if (!projectId || !startDate || !endDate) {
                return res.status(400).json({ error: "projectId, startDate, and endDate are required" });
            }
            res.json(await WorklogService.getTimesheetData(userId, role, String(projectId), String(startDate), String(endDate)));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async create(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const data = {
                ...req.body,
                workItemId: req.body.workItemId || req.body.storyId || req.body.taskId || req.body.bugId
            };
            const worklog = await WorklogService.create(userId, role, data);
            res.status(201).json(worklog);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async getAll(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const filters = {
                ...req.query,
                workItemId: req.query.workItemId || req.query.storyId || req.query.taskId || req.query.bugId
            };
            const worklogs = await WorklogService.getAll(userId, role, filters as any);
            res.json(worklogs);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const worklog = await WorklogService.update(userId, role, req.params.id, req.body);
            res.json(worklog);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            await WorklogService.delete(userId, role, req.params.id);
            res.status(204).send();
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
