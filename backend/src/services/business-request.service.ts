import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { aiAnalystService } from './ai.service';
import { AppError } from '../utils/AppError';
import { aiOrchestratorService, type BusinessRequestAISummary } from './ai-orchestrator.service';
import { getAIJob, getAIJobs } from './aiJobStorage.service';
import { workflowGateService } from './workflowGate.service';
import { aiQueue } from './queue/ai.queue';
import { runInBackground } from '../utils/backgroundTask';
import { createLogger } from '../utils/logger';

const logger = createLogger('BusinessRequestService');

const requestWorkItemInclude = {
    id: true,
    title: true,
    itemType: true,
    status: true,
    priority: true,
    parentId: true,
    createdAt: true,
    testCases: {
        select: {
            id: true,
            title: true,
            status: true,
            runItems: {
                select: {
                    id: true,
                    finalStatus: true,
                    testRunId: true,
                    testRun: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                },
            },
        },
    },
} as const;

const requestReleaseCandidateInclude = {
    id: true,
    key: true,
    title: true,
    status: true,
    label: true,
    readinessScore: true,
    createdAt: true,
} as const;

export type BusinessRequestGuidance = BusinessRequestAISummary;

export class BusinessRequestService {
    private buildGuidance(request: any, language: string = 'en'): BusinessRequestGuidance {
        const generatedItems = request.workItems || [];
        const generatedEpics = generatedItems.filter((item: any) => item.itemType === 'EPIC');
        const generatedStories = generatedItems.filter((item: any) => item.itemType === 'STORY');
        const coveredGeneratedStories = generatedStories.filter((item: any) =>
            (item.testCases || []).some((testCase: any) => testCase.status === 'APPROVED'));
        const linkedReleaseCandidates = request.releaseCandidates || [];
        const linkedRuns = new Set<string>();
        const runSignalCounts = generatedStories.reduce((acc: { failed: number; blocked: number; conflicts: number }, story: any) => {
            for (const testCase of story.testCases || []) {
                for (const runItem of testCase.runItems || []) {
                    if (runItem.testRunId) {
                        linkedRuns.add(runItem.testRunId);
                    }
                    if (runItem.finalStatus === 'FAIL') acc.failed += 1;
                    if (runItem.finalStatus === 'BLOCK') acc.blocked += 1;
                    if (runItem.finalStatus === 'CONFLICT') acc.conflicts += 1;
                }
            }
            return acc;
        }, { failed: 0, blocked: 0, conflicts: 0 });
        return aiOrchestratorService.buildBusinessRequestSummary({
            id: request.id,
            projectId: request.projectId,
            status: request.status,
            analysisStatus: request.aiAnalysis?.status,
            questionCount: request.aiAnalysis?.questions?.length ?? 0,
            epicCount: generatedEpics.length,
            totalStories: generatedStories.length,
            coveredStories: coveredGeneratedStories.length,
            linkedRuns: linkedRuns.size,
            failedRunItems: runSignalCounts.failed,
            blockedRunItems: runSignalCounts.blocked,
            conflictRunItems: runSignalCounts.conflicts,
            linkedReleaseCandidates: linkedReleaseCandidates.length,
            releasesNeedingAttention: linkedReleaseCandidates.filter((candidate: any) => candidate.status !== 'READY').length,
        }, language);
    }

    private async attachReleaseCandidates<T extends { id: string }>(request: T): Promise<T & { releaseCandidates: any[] }> {
        const releaseCandidateModel = (prisma as any).releaseCandidate;
        if (!releaseCandidateModel?.findMany) {
            return { ...request, releaseCandidates: [] };
        }

        const releaseCandidates = await releaseCandidateModel.findMany({
            where: { sourceRequestId: request.id },
            select: requestReleaseCandidateInclude,
            orderBy: { createdAt: 'desc' },
        });

        return { ...request, releaseCandidates };
    }

    private async attachReleaseCandidatesToMany<T extends { id: string }>(requests: T[]): Promise<Array<T & { releaseCandidates: any[] }>> {
        if (requests.length === 0) {
            return [];
        }

        const releaseCandidateModel = (prisma as any).releaseCandidate;
        if (!releaseCandidateModel?.findMany) {
            return requests.map((request) => ({ ...request, releaseCandidates: [] }));
        }

        const releaseCandidates = await releaseCandidateModel.findMany({
            where: { sourceRequestId: { in: requests.map((request) => request.id) } },
            select: {
                ...requestReleaseCandidateInclude,
                sourceRequestId: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const grouped = releaseCandidates.reduce((acc: Record<string, any[]>, candidate: any) => {
            const sourceRequestId = candidate.sourceRequestId;
            if (!sourceRequestId) {
                return acc;
            }

            const { sourceRequestId: _ignored, ...rest } = candidate;
            acc[sourceRequestId] = acc[sourceRequestId] || [];
            acc[sourceRequestId].push(rest);
            return acc;
        }, {});

        return requests.map((request) => ({
            ...request,
            releaseCandidates: grouped[request.id] || [],
        }));
    }

    async create(projectId: string, userId: string, data: { title: string; content: string }) {
        return prisma.businessRequest.create({
            data: {
                title: data.title,
                content: data.content,
                projectId,
                authorId: userId,
                status: 'DRAFT'
            }
        });
    }

    async update(id: string, data: { title?: string; content?: string }) {
        const existing = await prisma.businessRequest.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) throw new AppError('Business Request not found', 404);

        return prisma.businessRequest.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.content !== undefined ? { content: data.content } : {}),
            },
        });
    }

    async getById(id: string) {
        const request = await prisma.businessRequest.findUnique({
            where: { id },
            include: {
                author: true,
                workItems: {
                    select: requestWorkItemInclude,
                    orderBy: { createdAt: 'desc' },
                },
            }
        });

        if (!request) throw new AppError('Business Request not found', 404);
        const [requestWithReleases, aiJob] = await Promise.all([
            this.attachReleaseCandidates(request),
            getAIJob('BusinessRequest', request.id),
        ]);
        return { ...requestWithReleases, aiJob };
    }

    async getAll(projectId: string) {
        const requests = await prisma.businessRequest.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            include: {
                author: { select: { firstName: true, lastName: true } },
                workItems: {
                    select: requestWorkItemInclude,
                    orderBy: { createdAt: 'desc' },
                },
            }
        });

        const requestIds = requests.map((request) => request.id);
        const [withReleaseCandidates, aiJobs] = await Promise.all([
            this.attachReleaseCandidatesToMany(requests),
            getAIJobs('BusinessRequest', requestIds),
        ]);
        return withReleaseCandidates.map((request) => ({
            ...request,
            aiJob: aiJobs[request.id] || null,
        }));
    }

    async getGuidance(id: string, language: string = 'en') {
        const request = await this.getById(id);
        return this.buildGuidance(request, language);
    }

    async analyze(id: string, language: string = 'en') {
        const request = await this.getById(id);

        // Try to enrich analysis with existing project documentation (scope / architecture / master doc)
        const docSpace = await prisma.wikiSpace.findFirst({
            where: {
                projectId: request.projectId,
                name: 'Documentation',
            },
            select: { id: true },
        });

        let wikiSummary: string | undefined;
        if (docSpace) {
            const latestDocPage = await prisma.wikiPage.findFirst({
                where: { spaceId: docSpace.id, status: 'APPROVED', deletedAt: null },
                orderBy: { updatedAt: 'desc' },
                select: { content: true },
            });

            if (latestDocPage?.content) {
                // Reuse the same normalization logic as other AI prompts
                const { normalizeWikiContent } = await import('./ai.service');
                wikiSummary = normalizeWikiContent(latestDocPage.content, 2000);
            }
        }

        // Call AI Service with contextual documentation when available
        const analysis = await aiAnalystService.analyzeRequirement(request.content, language, {
            wikiSummary,
        });

        // Update Request with Analysis Result
        // If status is NEEDS_INFO setting status to ANALYZED (but UI will show questions)
        // If status is COMPLETE setting status to ANALYZED

        return prisma.businessRequest.update({
            where: { id },
            data: {
                aiAnalysis: analysis as any,
                status: 'ANALYZED'
            }
        });
    }

    async approve(id: string, epics: any[], userId: string, language = 'en') {
        const request = await this.getById(id);
        const analyzedEpics = Array.isArray(epics) && epics.length > 0
            ? epics
            : Array.isArray((request as any).aiAnalysis?.epics)
                ? (request as any).aiAnalysis.epics
                : [];

        await workflowGateService.assertBusinessRequestReadyForApproval(request as any, analyzedEpics, userId, request.projectId);

        await aiAnalystService.createBatch(request.projectId, { epics: analyzedEpics }, userId, request.id);

        // Approval creates the backlog synchronously; test generation is deliberately
        // asynchronous so the user can review the generated DRAFT cases before execution.
        this.queueTestGenerationForRequest(request.id, request.projectId, userId, language);

        return prisma.businessRequest.update({
            where: { id },
            data: { status: 'APPROVED' }
        });
    }

    queueTestGenerationForRequest(requestId: string, projectId: string, userId: string, language = 'en') {
        runInBackground(async () => {
            const stories = await prisma.workItem.findMany({
                where: { sourceRequestId: requestId, projectId, itemType: 'STORY', deletedAt: null },
                select: { id: true },
            });
            await Promise.all(stories.map((story) => aiQueue.add(`ai-testcases-${story.id}`, {
                type: 'generate-testcases', storyId: story.id, projectId, language, userId,
            })));
        }, (error) => logger.error(`Failed to queue test generation for request ${requestId}`, error));
    }

    async delete(id: string) {
        try {
            return await prisma.businessRequest.delete({ where: { id } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new AppError('Business Request not found', 404);
            }
            throw error;
        }
    }
}

export const businessRequestService = new BusinessRequestService();
