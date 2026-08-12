import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class UserController {
    async getMe(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const user = await userService.getMe(userId);
            sendResponse(res, 200, user, 'User profile retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async updateMe(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const user = await userService.updateMe(userId, req.body);
            sendResponse(res, 200, user, 'Profile updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            const user = await userService.create(req.body, organizationId);
            sendResponse(res, 201, user, 'User created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAllUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            const users = await userService.getAllUsers(organizationId);
            sendResponse(res, 200, users, 'All users retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            const user = await userService.getById(req.params.id, organizationId);
            sendResponse(res, 200, user, 'User retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            const user = await userService.update(req.params.id, req.body, organizationId);
            sendResponse(res, 200, user, 'User updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { organizationId } = getRequestActor(req);
            await userService.delete(req.params.id, organizationId);
            sendResponse(res, 204, null, 'User deleted successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const userController = new UserController();
