import { Request, Response } from 'express';
import { SprintService } from '../services/sprint.service';
import { CreateSprintInput, UpdateSprintInput, SprintFilters } from '../types/sprint';
import { getRequestActor } from '../utils/requestContext';

export class SprintController {
    static async create(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const input: CreateSprintInput = req.body;
        // Convert dates if string
        if (typeof input.startDate === 'string') input.startDate = new Date(input.startDate);
        if (typeof input.endDate === 'string') input.endDate = new Date(input.endDate);

        const sprint = await SprintService.create(userId, role, input);
        res.status(201).json(sprint);
    }

    static async getAll(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const { projectId, status } = req.query;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        const filters: SprintFilters = {
            status: status as any
        };

        const sprints = await SprintService.getAll(userId, role, projectId as string, filters);
        res.json(sprints);
    }

    static async getById(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const sprint = await SprintService.getById(userId, role, req.params.id);
        res.json(sprint);
    }

    static async update(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const input: UpdateSprintInput = req.body;
        if (input.startDate && typeof input.startDate === 'string') input.startDate = new Date(input.startDate);
        if (input.endDate && typeof input.endDate === 'string') input.endDate = new Date(input.endDate);

        const sprint = await SprintService.update(userId, role, req.params.id, input);
        res.json(sprint);
    }

    static async delete(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        await SprintService.delete(userId, role, req.params.id);
        res.status(204).send();
    }

    static async start(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const sprint = await SprintService.start(userId, role, req.params.id);
        res.json(sprint);
    }

    static async complete(req: Request, res: Response) {
        const { userId, role } = getRequestActor(req);
        const sprint = await SprintService.complete(userId, role, req.params.id);
        res.json(sprint);
    }
}
