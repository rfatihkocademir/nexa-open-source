import { Request, Response } from 'express';
import { environmentService } from '../services/environment.service';
import { respondWithControllerError } from '../utils/controllerError';
import { commandBus } from '../core/bus/CommandBus';
import { CreateEnvironmentCommand, UpdateEnvironmentCommand } from '../commands/environment/EnvironmentCommands';
import { getRequestActor } from '../utils/requestContext';

export class EnvironmentController {
    static async findAll(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { userId, role } = getRequestActor(req);
            const environments = await environmentService.findAll(projectId, userId, role);
            res.json(environments);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { userId, role } = getRequestActor(req);
            
            const environment = await commandBus.dispatch(new CreateEnvironmentCommand(
                { actorId: userId, role, projectId },
                { ...req.body, projectId }
            ));

            res.status(201).json(environment);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { userId, role } = getRequestActor(req);

            const environment = await commandBus.dispatch(new UpdateEnvironmentCommand(
                { actorId: userId, role },
                id,
                req.body
            ));

            res.json(environment);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { userId, role } = getRequestActor(req);
            await environmentService.delete(id, userId, role);
            res.status(204).send();
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async ensureDefaults(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { userId, role } = getRequestActor(req);
            await environmentService.ensureDefaults(projectId, userId, role);
            const environments = await environmentService.findAll(projectId, userId, role);
            res.json(environments);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
