import { Request, Response } from 'express';
import { aiAnalystService } from '../services/ai.service';
import prisma from '../utils/prisma';
import { notificationService, NotificationType } from '../services/notification.service';
import { aiQueue } from '../services/queue/ai.queue';
import { projectAssistantService } from '../services/project-assistant.service';
import { knowledgeService } from '../services/knowledge.service';
import { AutoBugReporterService } from '../services/autoBugReporter.service';
import { businessRequestService } from '../services/business-request.service';
import { workflowGateService } from '../services/workflowGate.service';
import type { AIJobStatus } from '../types/aiJob';
import { setAIJob } from '../services/aiJobStorage.service';
import { runInBackground } from '../utils/backgroundTask';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectActor, getRequestActor } from '../utils/requestContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('AIController');

export const syncKnowledge = async (req: Request, res: Response) => {
    try {
        const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);

        runInBackground(() => knowledgeService.syncProjectKnowledge(projectId), (err) => {
            logger.error(`Background knowledge sync failed for project ${projectId}:`, err);
        });

        res.json({ message: 'Knowledge synchronization started in the background.' });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to start knowledge sync');
    }
};

export const analyzeRequirement = async (req: Request, res: Response) => {
    try {
        const { text, language } = req.body;
        const { userId, projectId } = getAuthorizedProjectActor(req, req.body.projectId);
        if (!text || !projectId) {
            return res.status(400).json({ error: 'Text and projectId are required' });
        }

        // Add to background processing queue instead of waiting synchronously
        const job = await aiQueue.add(`ai-epics-${Date.now()}`, {
            type: 'generate-epics',
            projectId,
            requirementText: text,
            language: language || 'en',
            userId
        });

        // Immediately respond 202 Accepted
        res.status(202).json({
            message: 'Requirement analysis request has been accepted and is processing in the background.',
            jobId: job.id
        });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to queue analysis');
    }
};

export const createBatch = async (req: Request, res: Response) => {
    try {
        const { userId, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
        const { epics, requestId, language } = req.body;
        let payloadEpics = epics;

        if (requestId) {
            const request = await businessRequestService.getById(requestId);
            if (request.projectId !== projectId) {
                return res.status(400).json({ error: 'requestId does not belong to this project' });
            }

            payloadEpics = Array.isArray(epics) && epics.length > 0
                ? epics
                : Array.isArray((request as any).aiAnalysis?.epics)
                    ? (request as any).aiAnalysis.epics
                    : [];

            await workflowGateService.assertBusinessRequestReadyForApproval(request as any, payloadEpics, req.user!.id, request.projectId);
        }

        // This is still fairly synchronous and fast as it's just DB inserts, 
        // we can leave this one as is or it could be queued too if large enough.
        const results = await aiAnalystService.createBatch(projectId, { epics: payloadEpics }, userId, requestId);

        if (requestId) {
            await prisma.businessRequest.update({
                where: { id: requestId },
                data: { status: 'APPROVED' }
            });
            businessRequestService.queueTestGenerationForRequest(requestId, projectId, userId, language || 'en');
        }

        res.json(results);
    } catch (error) {
        respondWithControllerError(res, error, 'Batch creation failed');
    }
};

export const generateTestsFromStory = async (req: Request, res: Response) => {
    try {
        const { storyId, language, projectId: providedProjectId } = req.body;
        if (!storyId) {
            return res.status(400).json({ error: 'storyId is required' });
        }

        const { userId } = getRequestActor(req);

        let projectId = req.projectAccessContext?.projectId || providedProjectId;
        if (!projectId) {
            const story = await prisma.workItem.findUnique({
                where: { id: storyId },
                select: { projectId: true }
            });

            if (!story) {
                return res.status(404).json({ error: 'Story not found' });
            }

            projectId = story.projectId;
        }

        const job = await aiQueue.add(`ai-tests-${Date.now()}`, {
            type: 'generate-testcases',
            storyId,
            projectId,
            language: language || 'en',
            userId
        });

        const queuedAt = new Date().toISOString();
        const aiJob: AIJobStatus = {
            kind: 'STORY_TEST_GENERATION',
            status: 'QUEUED',
            jobId: String(job.id),
            requestedById: userId,
            queuedAt,
            error: null,
            resultSummary: null,
        };

        await setAIJob('WorkItem', storyId, aiJob);

        // Notify user it's queued
        await notificationService.notifyUser(userId, {
            type: NotificationType.INFO,
            title: 'notifications.ai_tests_queued_title',
            message: 'notifications.ai_tests_queued_message',
            data: { projectId, storyId, type: 'testcases-queued' }
        });

        res.status(202).json({
            message: 'Test generation request has been accepted and is processing in the background.',
            jobId: job.id
        });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to queue test generation');
    }
};

export const chatWithAssistant = async (req: Request, res: Response) => {
    try {
        const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages are required and must be an array' });
        }

        const result = await projectAssistantService.chat(projectId, userId, role, messages);
        res.json({ data: result });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to chat with project assistant');
    }
};

export const generateStories = async (req: Request, res: Response) => {
    try {
        const { description, language } = req.body;
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        const stories = await aiAnalystService.generateStoriesSynchronous(description, language);
        
        // Frontend expects { data: { stories: [] } } format
        res.json({
            data: { stories }
        });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to generate stories');
    }
};

export const generateSteps = async (req: Request, res: Response) => {
    try {
        const { title, context, language } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const steps = await aiAnalystService.generateManualSteps(title, context, language);
        
        // Frontend expects { data: { steps: [] } } format
        res.json({
            data: { steps }
        });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to generate steps');
    }
};

export const extractElements = async (req: Request, res: Response) => {
    try {
        getAuthorizedProjectActor(req, req.params.projectId);
        const { htmlSnippet } = req.body;
        if (!htmlSnippet || typeof htmlSnippet !== 'string') {
            return res.status(400).json({ error: 'htmlSnippet is required' });
        }

        const elements = await aiAnalystService.extractElementsFromHtml(htmlSnippet);
        res.json({ data: elements });
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to extract elements');
    }
};

export const analyzeFailure = async (req: Request, res: Response) => {
    try {
        const { userId, role } = getRequestActor(req);
        const { testResultId } = req.params;
        const { language } = req.body || {};

        const result = await AutoBugReporterService.analyzeFailure(userId, role, testResultId, language || 'en');
        res.json(result);
    } catch (error) {
        respondWithControllerError(res, error, 'Failed to analyze failure');
    }
};
