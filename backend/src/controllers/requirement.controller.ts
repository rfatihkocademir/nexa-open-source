import { Request, Response } from 'express';
import { requirementService } from '../services/requirement.service';
import { commandBus } from '../core/bus/CommandBus';
import { CreateRequirementCommand, UpdateRequirementStatusCommand } from '../commands/requirement/RequirementCommands';
import { getRequestActor, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';

export class RequirementController {
    static async create(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const body = req.body;
            
            const requirement = await commandBus.dispatch(new CreateRequirementCommand(
                { actorId: userId, role, projectId: body.projectId },
                body
            ));

            res.status(201).json(requirement);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async updateStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { nextStatus, reason } = req.body;
            const { userId, role } = getRequestActor(req);

            const requirement = await commandBus.dispatch(new UpdateRequirementStatusCommand(
                { actorId: userId, role },
                id,
                nextStatus,
                reason
            ));

            res.json(requirement);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async findByProject(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req);
            const requirements = await requirementService.findByProject(projectId);
            res.json(requirements);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async findById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const requirement = await requirementService.findById(id);
            if (!requirement) {
                return res.status(404).json({ message: 'Requirement not found' });
            }
            res.json(requirement);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async analyzeTestability(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { testabilityAnalyzerService } = await import('../services/testabilityAnalyzer.service');
            const result = await testabilityAnalyzerService.analyzeRequirement(id);
            res.json(result);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
