import { Request, Response, NextFunction } from 'express';
import { businessRequestService } from '../services/business-request.service';
import { sendResponse } from '../utils/apiResponse';
import { aiQueue } from '../services/queue/ai.queue';
import { notificationService, NotificationType } from '../services/notification.service';
import type { AIJobStatus } from '../types/aiJob';
import { setAIJob } from '../services/aiJobStorage.service';
import { getAuthorizedProjectActor, getAuthorizedProjectId, getRequestActor } from '../utils/requestContext';

export const businessRequestController = {
    create: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { userId, projectId } = getAuthorizedProjectActor(req, req.params.projectId, req.body.projectId);
            const { title, content } = req.body;
            const request = await businessRequestService.create(projectId, userId, { title, content });
            sendResponse(res, 201, request, 'Business request created successfully');
        } catch (error) {
            next(error);
        }
    },

    getAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.projectId, req.query.projectId);
            const requests = await businessRequestService.getAll(projectId);
            sendResponse(res, 200, requests, 'Business requests retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    getById: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const request = await businessRequestService.getById(id);
            sendResponse(res, 200, request, 'Business request retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    getGuidance: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const lang = (req.query.lang as string) || 'en';
            const guidance = await businessRequestService.getGuidance(id, lang);
            sendResponse(res, 200, guidance, 'Guidance retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    update: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { title, content } = req.body;
            const request = await businessRequestService.update(id, { title, content });
            sendResponse(res, 200, request, 'Business request updated successfully');
        } catch (error) {
            next(error);
        }
    },

    analyze: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { userId } = getRequestActor(req);
            const { id } = req.params;
            const { language } = req.body;
            const existingRequest = await businessRequestService.getById(id);

            try {
                const job = await aiQueue.add(`business-request-analysis-${id}-${Date.now()}`, {
                    type: 'analyze-business-request',
                    requestId: id,
                    projectId: existingRequest.projectId,
                    language: language || 'en',
                    userId,
                });

                const queuedAt = new Date().toISOString();
                const aiJob: AIJobStatus = {
                    kind: 'BUSINESS_REQUEST_ANALYSIS',
                    status: 'QUEUED',
                    jobId: String(job.id),
                    requestedById: userId,
                    queuedAt,
                    error: null,
                    resultSummary: null,
                };

                await setAIJob('BusinessRequest', id, aiJob);

                await notificationService.notifyUser(userId, {
                    type: NotificationType.INFO,
                    title: 'notifications.ai_analysis_queued_title',
                    message: 'notifications.ai_analysis_queued_message',
                    data: {
                        type: 'business-request-analysis-queued',
                        projectId: existingRequest.projectId,
                        requestId: id,
                    },
                });

                res.status(202).json({
                    queued: true,
                    jobId: job.id,
                    requestId: id,
                });
            } catch (queueError) {
                const startedAt = new Date().toISOString();
                await setAIJob('BusinessRequest', id, {
                        kind: 'BUSINESS_REQUEST_ANALYSIS',
                        status: 'RUNNING',
                        requestedById: userId,
                        startedAt,
                    error: null,
                    resultSummary: null,
                });

                try {
                    const request = await businessRequestService.analyze(id, language);
                    await setAIJob('BusinessRequest', id, {
                        kind: 'BUSINESS_REQUEST_ANALYSIS',
                        status: 'COMPLETED',
                        requestedById: userId,
                        startedAt,
                        finishedAt: new Date().toISOString(),
                        error: null,
                        resultSummary: 'analysis_completed',
                    });

                    res.status(200).json({
                        queued: false,
                        request,
                        fallback: 'synchronous',
                        queueError: queueError instanceof Error ? queueError.message : String(queueError),
                    });
                } catch (syncError: any) {
                    await setAIJob('BusinessRequest', id, {
                        kind: 'BUSINESS_REQUEST_ANALYSIS',
                        status: 'FAILED',
                        requestedById: userId,
                        startedAt,
                        finishedAt: new Date().toISOString(),
                        error: syncError?.message || 'Synchronous analysis failed',
                        resultSummary: null,
                    });
                    throw syncError;
                }
            }
        } catch (error) {
            next(error);
        }
    },

    approve: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { userId } = getRequestActor(req);
            const { epics, language } = req.body;
            const request = await businessRequestService.approve(id, epics, userId, language || 'en');
            sendResponse(res, 200, request, 'Business request approved successfully');
        } catch (error) {
            next(error);
        }
    },

    delete: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await businessRequestService.delete(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
};
