import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { TestStep } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { playwrightGeneratorService } from './playwrightGenerator.service';
import { playwrightExecutorService } from './playwrightExecutor.service';
import { createLogger } from '../utils/logger';
import { commandBus } from '../core/bus/CommandBus';
import { CreateAutomationScenarioCommand, PublishAutomationScenarioCommand } from '../commands/automation/AutomationCommands';
import { redisClient } from './queue/connection';
import { assertSafeAutomationTargets, assertSafeOutboundTarget } from '../utils/outboundTarget';

interface CreateAutomationScenarioDTO {
    testCaseId: string;
    variables?: Record<string, string>;
    steps?: { stepId: string; orderIndex: number; parameters?: any }[];
    title?: string;
    description?: string;
}

interface UpdateAutomationScenarioDTO {
    variables?: Record<string, string>;
    title?: string;
    description?: string | null;
}

interface TestCaseScenarioRecord {
    id: string;
    title: string;
    suite: {
        projectId: string;
    };
}

export type DryRunActor = {
    userId: string;
    role: string;
    organizationId: string;
    projectId?: string;
};

const logger = createLogger('AutomationScenarioService');
const inMemoryDryRunStore = new Map<string, any>();

const normalizeVariables = (variables?: Record<string, string>): Record<string, string> => {
    if (!variables) return {};
    if (typeof variables !== 'object' || Array.isArray(variables)) {
        throw new AppError('variables must be an object', 400);
    }
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
        if (key.length > 100) throw new AppError('Variable names are too long', 400);
        const normalizedValue = typeof value === 'string' ? value : String(value);
        if (normalizedValue.length > 10_000) throw new AppError('Variable values are too long', 400);
        normalized[key] = normalizedValue;
    }
    if (Object.keys(normalized).length > 100) throw new AppError('Too many automation variables', 400);
    return normalized;
};

export class AutomationScenarioService {
    private async getTestCaseRecord(testCaseId: string): Promise<TestCaseScenarioRecord> {
        const testCase = await prisma.testCase.findUnique({
            where: { id: testCaseId },
            select: {
                id: true,
                title: true,
                suite: {
                    select: {
                        projectId: true,
                    },
                },
            },
        });

        if (!testCase) {
            throw new AppError('Test case not found', 404);
        }

        return testCase;
    }

    private async getTestCaseWithAccess(testCaseId: string, userId: string, role: string) {
        const testCase = await this.getTestCaseRecord(testCaseId);
        await ProjectAccess.check(testCase.suite.projectId, userId, role);
        return testCase;
    }

    private async normalizeScenarioSteps(
        projectId: string,
        steps: CreateAutomationScenarioDTO['steps'] = [],
    ): Promise<NonNullable<CreateAutomationScenarioDTO['steps']>> {
        if (!Array.isArray(steps) || steps.length > 100) {
            throw new AppError('An automation scenario may contain at most 100 steps', 400);
        }

        const stepIds = [...new Set(steps.map((step) => step.stepId))];
        if (steps.some((step) => !step?.stepId) || stepIds.length !== steps.length) {
            throw new AppError('Automation steps must be valid', 400);
        }

        const projectSteps = await prisma.testStep.findMany({
            where: {
                id: { in: stepIds },
                projectId,
                deletedAt: null,
            },
            select: { id: true },
        });
        const availableStepIds = new Set(projectSteps.map((step) => step.id));
        const foreignStep = steps.find((step) => !availableStepIds.has(step.stepId));
        if (foreignStep) {
            throw new AppError('All automation steps must belong to the scenario project', 400);
        }

        // The client can send a visual order, but the persisted contract is
        // always a compact 1..N sequence. This prevents gaps and collisions
        // after fast drag-and-drop edits.
        return [...steps]
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .map((step, index) => ({
                ...step,
                orderIndex: index + 1,
            }));
    }

    private validatePublishableSteps(steps: Array<{ testStep: TestStep }>) {
        if (steps.length === 0) {
            throw new AppError('Cannot publish an empty automation scenario. Add at least one step.', 400);
        }

        for (const scenarioStep of steps) {
            const step = scenarioStep.testStep;
            const actionType = String(step.actionType || '').toUpperCase();
            const requiresLocator = ['CLICK', 'FILL', 'ASSERT_TEXT', 'ASSERT_VISIBLE', 'SELECT'].includes(actionType);
            const requiresData = ['FILL', 'ASSERT_TEXT', 'WAIT', 'SELECT', 'SET_COOKIE', 'SET_LOCAL_STORAGE'].includes(actionType);

            if (requiresLocator && !step.locator?.trim()) {
                throw new AppError(`Step "${step.name || step.id}" requires a locator`, 400);
            }
            if (requiresData && !step.data?.trim()) {
                throw new AppError(`Step "${step.name || step.id}" requires input data`, 400);
            }
        }
    }

    private async toResponse(testCase: TestCaseScenarioRecord, scenario: any) {
        return {
            id: scenario.id,
            testCaseId: scenario.testCaseId,
            variables: scenario.variables,
            status: scenario.status,
            version: scenario.version,
            title: scenario.title,
            description: scenario.description,
            testCase: {
                id: testCase.id,
                title: testCase.title,
            },
            steps: (scenario.steps || []).map((s: any) => ({
                id: s.id,
                stepId: s.testStepId,
                orderIndex: s.orderIndex,
                parameters: s.parameters,
                step: s.testStep
            })),
        };
    }

    async create(dto: CreateAutomationScenarioDTO, userId: string, role: string) {
        const testCase = await this.getTestCaseWithAccess(dto.testCaseId, userId, role);
        const existingScenario = await prisma.automationScenario.findFirst({
            where: { testCaseId: dto.testCaseId, deletedAt: null },
            select: { id: true },
        });
        if (existingScenario) {
            throw new AppError('An automation scenario already exists for this test case', 409);
        }
        const normalizedSteps = await this.normalizeScenarioSteps(testCase.suite.projectId, dto.steps || []);
        const normalizedVariables = normalizeVariables(dto.variables);
        
        const result = await commandBus.dispatch(new CreateAutomationScenarioCommand(
            { actorId: userId, role, projectId: testCase.suite.projectId },
            {
                ...dto,
                projectId: testCase.suite.projectId,
                title: dto.title?.trim() || `Automation for ${testCase.title}`,
                description: dto.description?.trim(),
                steps: normalizedSteps,
                variables: normalizedVariables,
            }
        ));

        return this.toResponse(testCase, result);
    }

    async findById(id: string, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findFirst({
            where: { id, deletedAt: null },
            include: { 
                steps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!scenario) {
            throw new AppError('Automation scenario not found', 404);
        }

        const testCase = await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);
        return this.toResponse(testCase, scenario);
    }

    async findByTestCaseId(testCaseId: string, userId: string, role: string) {
        const testCase = await this.getTestCaseWithAccess(testCaseId, userId, role);
        const scenario = await prisma.automationScenario.findFirst({
            where: { testCaseId, deletedAt: null },
            include: { 
                steps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!scenario) {
            throw new AppError('Automation scenario not found for this test case', 404);
        }

        return this.toResponse(testCase, scenario);
    }

    async update(id: string, dto: UpdateAutomationScenarioDTO, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findFirst({ 
            where: { id, deletedAt: null } 
        });
        if (!scenario) throw new AppError('Scenario not found', 404);

        const testCase = await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);
        const hasVariableUpdate = dto.variables !== undefined;
        const hasMetadataUpdate = dto.title !== undefined || dto.description !== undefined;

        const updated = await prisma.automationScenario.update({
            where: { id },
            data: {
                variables: hasVariableUpdate ? normalizeVariables(dto.variables) : undefined,
                title: dto.title !== undefined ? dto.title.trim() : undefined,
                description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
                status: hasVariableUpdate || hasMetadataUpdate ? 'DRAFT' : undefined,
                updatedAt: new Date()
            },
            include: {
                steps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        return this.toResponse(testCase, updated);
    }

    async publish(id: string, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findFirst({ 
            where: { id, deletedAt: null } 
        });
        if (!scenario) throw new AppError('Scenario not found', 404);

        const testCase = await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);
        const publishableScenario = await prisma.automationScenario.findFirst({
            where: { id, deletedAt: null },
            include: { steps: { include: { testStep: true }, orderBy: { orderIndex: 'asc' } } },
        });
        if (!publishableScenario) throw new AppError('Scenario not found', 404);
        this.validatePublishableSteps(publishableScenario.steps);

        await commandBus.dispatch(new PublishAutomationScenarioCommand(
            { actorId: userId, role, projectId: testCase.suite.projectId },
            id
        ));

        return this.findById(id, userId, role);
    }

    async archive(id: string, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findUnique({ where: { id } });
        if (!scenario) throw new AppError('Scenario not found', 404);

        await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);

        return prisma.automationScenario.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    async restore(id: string, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findUnique({ where: { id } });
        if (!scenario) throw new AppError('Scenario not found', 404);

        await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);

        return prisma.automationScenario.update({
            where: { id },
            data: { deletedAt: null }
        });
    }

    async hardDelete(id: string, userId: string, role: string) {
        const scenario = await prisma.automationScenario.findUnique({ where: { id } });
        if (!scenario) throw new AppError('Scenario not found', 404);

        await this.getTestCaseWithAccess(scenario.testCaseId, userId, role);

        await prisma.automationScenario.delete({ where: { id } });
    }

    private resolveTemplate(value: unknown, variables: Record<string, string>): string {
        return String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => variables[key.trim()] ?? '');
    }

    private async validateDryRunInput(
        steps: Array<Partial<TestStep>>,
        variables: Record<string, string>,
        actor?: DryRunActor,
    ): Promise<Record<string, string>> {
        if (!Array.isArray(steps) || steps.length > 100) {
            throw new AppError('A dry-run may contain at most 100 steps', 400);
        }

        const normalizedVariables = normalizeVariables(variables);
        const baseValue = normalizedVariables.BASE_URL || normalizedVariables.base_url || normalizedVariables.baseUrl;
        let baseUrl: URL | undefined;
        if (baseValue) {
            const normalizedBase = /^https?:\/\//i.test(baseValue) ? baseValue : `http://${baseValue}`;
            baseUrl = await assertSafeOutboundTarget(normalizedBase, { scope: 'automation' });
        }

        for (const step of steps) {
            if (actor && step.projectId && step.projectId !== actor.projectId) {
                throw new AppError('All automation steps must belong to the authorized project', 403);
            }

            const actionType = String(step.actionType || '').toUpperCase();
            if (!['NAVIGATE', 'API_REQUEST'].includes(actionType)) continue;

            const rawTarget = actionType === 'API_REQUEST' ? step.locator : (step.data || step.locator);
            const target = this.resolveTemplate(rawTarget, normalizedVariables).trim();
            if (!target || target === '/') {
                if (baseUrl) await assertSafeOutboundTarget(new URL('/', baseUrl).toString(), { scope: 'automation' });
                continue;
            }

            let targetUrl: string;
            if (target.startsWith('/')) {
                if (!baseUrl) throw new AppError('Relative automation URLs require BASE_URL', 400);
                targetUrl = new URL(target, baseUrl).toString();
            } else if (/^https?:\/\//i.test(target)) {
                targetUrl = target;
            } else {
                targetUrl = `https://${target}`;
            }
            await assertSafeOutboundTarget(targetUrl, { scope: 'automation' });
        }

        await assertSafeAutomationTargets(steps, normalizedVariables);

        return normalizedVariables;
    }

    private async authorizeDryRunState(state: any, actor?: DryRunActor): Promise<void> {
        if (!actor) return;
        if (state.organizationId && state.organizationId !== actor.organizationId) {
            throw new AppError('Organization boundary violation', 403);
        }
        if (actor.projectId && state.projectId !== actor.projectId) {
            throw new AppError('Dry-run project scope mismatch', 403);
        }
        if (state.ownerId !== actor.userId) {
            await ProjectAccess.check(state.projectId, actor.userId, actor.role);
        }
    }

    async dryRun(
        steps: Array<Partial<TestStep>>,
        variables: Record<string, string>,
        headless: boolean = true,
        customRunId?: string,
        actor?: DryRunActor,
    ) {
        const normalizedVariables = await this.validateDryRunInput(steps, variables, actor);
        const normalizedSteps = (steps || []).map((step, index) => ({
            id: step.id || randomUUID(),
            projectId: step.projectId || actor?.projectId || randomUUID(),
            name: step.name || `Step ${index + 1}`,
            action: step.action || step.name || '',
            expectedResult: step.expectedResult || null,
            type: step.type || 'WEB',
            actionType: step.actionType || 'CLICK',
            locator: step.locator || '',
            data: step.data || '',
            createdAt: step.createdAt || new Date(),
            updatedAt: step.updatedAt || new Date(),
        })) as TestStep[];

        const script = playwrightGeneratorService.generateScript(normalizedSteps, normalizedVariables, { headless });
        return playwrightExecutorService.execute(script, customRunId || `dry-${Date.now()}`, { headless, projectId: actor?.projectId });
    }

    async startDryRun(
        steps: Array<Partial<TestStep>>,
        variables: Record<string, string>,
        headless: boolean = true,
        actor?: DryRunActor,
    ) {
        await this.validateDryRunInput(steps, variables, actor);
        const dryRunId = randomUUID();
        const initialState = {
            status: 'RUNNING',
            startedAt: new Date().toISOString(),
            ownerId: actor?.userId,
            projectId: actor?.projectId,
            organizationId: actor?.organizationId,
        };

        const stored = await redisClient.setex(`dryrun:${dryRunId}`, 7200, JSON.stringify(initialState));
        if (!stored) inMemoryDryRunStore.set(`dryrun:${dryRunId}`, initialState);

        this.executeDryRunAsync(dryRunId, steps, variables, headless, actor).catch((error) => {
            logger.error(`Async dry run failed for ${dryRunId}:`, error);
        });

        return { dryRunId, status: initialState.status, startedAt: initialState.startedAt };
    }

    private async executeDryRunAsync(
        dryRunId: string,
        steps: Array<Partial<TestStep>>,
        variables: Record<string, string>,
        headless: boolean,
        actor?: DryRunActor,
    ) {
        try {
            const result = await this.dryRun(steps, variables, headless, dryRunId, actor);
            const state = {
                status: 'COMPLETED', completedAt: new Date().toISOString(), result,
                ownerId: actor?.userId, projectId: actor?.projectId, organizationId: actor?.organizationId,
            };
            const stored = await redisClient.setex(`dryrun:${dryRunId}`, 7200, JSON.stringify(state));
            if (!stored) inMemoryDryRunStore.set(`dryrun:${dryRunId}`, state);
        } catch (error) {
            const state = {
                status: 'FAILED', completedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error),
                ownerId: actor?.userId, projectId: actor?.projectId, organizationId: actor?.organizationId,
            };
            const stored = await redisClient.setex(`dryrun:${dryRunId}`, 7200, JSON.stringify(state));
            if (!stored) inMemoryDryRunStore.set(`dryrun:${dryRunId}`, state);
        }
    }

    async getDryRunStatus(dryRunId: string, actor?: DryRunActor) {
        let stateStr = await redisClient.get(`dryrun:${dryRunId}`);
        if (!stateStr) {
            const memState = inMemoryDryRunStore.get(`dryrun:${dryRunId}`);
            if (memState) stateStr = JSON.stringify(memState);
        }
        if (!stateStr) throw new AppError('Dry run not found or expired', 404);
        const state = JSON.parse(stateStr);
        await this.authorizeDryRunState(state, actor);
        return state;
    }

    async getLiveFrame(dryRunId: string, actor?: DryRunActor) {
        await this.getDryRunStatus(dryRunId, actor);
        const { getLatestLiveFrame } = await import('./playwrightExecutor.service');
        return getLatestLiveFrame(dryRunId);
    }

    async clearDryRun(dryRunId: string, actor?: DryRunActor) {
        await this.getDryRunStatus(dryRunId, actor);
        await redisClient.del(`dryrun:${dryRunId}`);
        inMemoryDryRunStore.delete(`dryrun:${dryRunId}`);
        return { success: true };
    }

    async cleanupVideo(videoUrl: string, actor?: DryRunActor) {
        if (!videoUrl) return;

        const fileName = path.basename(videoUrl);
        const runIdMatch = fileName.match(/^video-([a-zA-Z0-9_-]+)\.webm$/);
        if (!runIdMatch || videoUrl.includes('..') || (!videoUrl.startsWith('/public/videos/') && !videoUrl.startsWith('public/videos/'))) {
            throw new AppError('Invalid video file for cleanup', 400);
        }

        const filePath = path.join(process.cwd(), 'public', 'videos', fileName);
        if (!fs.existsSync(filePath)) return { success: true };
        if (!actor) throw new AppError('Automation ownership context is required', 403);

        const runId = runIdMatch[1];
        let authorized = false;
        try {
            await this.getDryRunStatus(runId, actor);
            authorized = true;
        } catch (error) {
            if (error instanceof AppError && error.statusCode !== 404) throw error;
        }

        if (!authorized) {
            const runItem = await prisma.testRunItem.findFirst({
                where: { id: runId, testRun: { projectId: actor.projectId } },
                select: { id: true },
            });
            authorized = Boolean(runItem);
        }
        if (!authorized) throw new AppError('You do not own this automation video', 403);

        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            logger.error('Failed to cleanup video:', error);
        }
        return { success: true };
    }
}

export const automationScenarioService = new AutomationScenarioService();
