import { AppError } from './AppError';
import { createLogger } from './logger';

const logger = createLogger('StateMachine');

// ============================================
// STATUS TYPE DEFINITIONS
// ============================================

export type TestCaseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REVISE';
export type TestRunStatus = 'OPEN' | 'COMPLETED' | 'ARCHIVED';
export type WorkItemStatus = 'BACKLOG' | 'TODO' | 'OPEN' | 'IN_ANALYSIS' | 'IN_PROGRESS' | 'FIXED' | 'READY_FOR_TEST' | 'QA' | 'RETEST' | 'DONE' | 'CLOSED' | 'REOPENED' | 'WAITING_FOR_INFO';
export type ReleaseStatus = 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
export type AutomationStatus = 'DRAFT' | 'GENERATED' | 'MAPPED' | 'READY' | 'EXECUTED' | 'FAILED' | 'NEEDS_UPDATE' | 'DEPRECATED';
export type ArtifactLifecycleStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
export type BusinessRequestStatus = 'DRAFT' | 'ANALYZED' | 'APPROVED' | 'REJECTED';

// ============================================
// TRANSITION MATRICES
// ============================================

const testCaseTransitions: Record<TestCaseStatus, TestCaseStatus[]> = {
    DRAFT: ['PENDING', 'APPROVED'],
    PENDING: ['APPROVED', 'REVISE'],
    REVISE: ['PENDING'],
    APPROVED: ['PENDING', 'REVISE'],
};

const testRunTransitions: Record<TestRunStatus, TestRunStatus[]> = {
    OPEN: ['COMPLETED', 'ARCHIVED'],
    COMPLETED: ['ARCHIVED'],
    ARCHIVED: [],
};

const releaseTransitions: Record<ReleaseStatus, ReleaseStatus[]> = {
    DRAFT: ['READY', 'CANCELLED'],
    READY: ['RELEASED', 'CANCELLED', 'DRAFT'],
    RELEASED: ['CANCELLED'],
    CANCELLED: ['DRAFT'],
};

const storyTransitions: Record<string, string[]> = {
    BACKLOG: ['TODO'],
    TODO: ['IN_PROGRESS'],
    IN_PROGRESS: ['TODO', 'READY_FOR_TEST', 'DONE', 'WAITING_FOR_INFO'],
    WAITING_FOR_INFO: ['IN_PROGRESS', 'TODO'],
    READY_FOR_TEST: ['IN_PROGRESS', 'QA'],
    QA: ['IN_PROGRESS', 'DONE', 'READY_FOR_TEST'],
    DONE: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['TODO'],
};

const bugTransitions: Record<string, string[]> = {
    TODO: ['OPEN'],
    OPEN: ['IN_ANALYSIS', 'CLOSED', 'WAITING_FOR_INFO'],
    IN_ANALYSIS: ['IN_PROGRESS', 'OPEN', 'CLOSED', 'WAITING_FOR_INFO'],
    WAITING_FOR_INFO: ['IN_ANALYSIS', 'OPEN'],
    IN_PROGRESS: ['FIXED', 'IN_ANALYSIS', 'OPEN', 'WAITING_FOR_INFO'],
    FIXED: ['RETEST', 'IN_PROGRESS'],
    RETEST: ['CLOSED', 'REOPENED', 'IN_PROGRESS'],
    REOPENED: ['IN_PROGRESS', 'IN_ANALYSIS', 'CLOSED'],
    CLOSED: ['REOPENED'],
};

const defectTransitions: Record<string, string[]> = {
    TODO: ['OPEN'],
    OPEN: ['IN_ANALYSIS', 'CLOSED'],
    IN_ANALYSIS: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['FIXED', 'IN_ANALYSIS'],
    FIXED: ['RETEST'],
    RETEST: ['CLOSED', 'REOPENED'],
    REOPENED: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['REOPENED'],
};

const incidentTransitions: Record<string, string[]> = {
    TODO: ['OPEN'],
    OPEN: ['IN_ANALYSIS', 'IN_PROGRESS', 'CLOSED'],
    IN_ANALYSIS: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['FIXED', 'CLOSED'],
    FIXED: ['CLOSED'],
    CLOSED: ['REOPENED'],
    REOPENED: ['IN_PROGRESS'],
};

const genericWorkItemTransitions: Record<string, string[]> = {
    BACKLOG: ['TODO'],
    TODO: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['TODO', 'DONE', 'CLOSED'],
    DONE: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['TODO', 'REOPENED'],
    REOPENED: ['IN_PROGRESS'],
};

const automationTransitions: Record<AutomationStatus, AutomationStatus[]> = {
    DRAFT: ['GENERATED', 'MAPPED'],
    GENERATED: ['MAPPED', 'NEEDS_UPDATE', 'DEPRECATED'],
    MAPPED: ['READY', 'NEEDS_UPDATE', 'DEPRECATED'],
    READY: ['EXECUTED', 'NEEDS_UPDATE', 'DEPRECATED'],
    EXECUTED: ['READY', 'FAILED', 'NEEDS_UPDATE', 'DEPRECATED'],
    FAILED: ['READY', 'NEEDS_UPDATE', 'DEPRECATED'],
    NEEDS_UPDATE: ['DRAFT', 'MAPPED', 'DEPRECATED'],
    DEPRECATED: [],
};

const artifactLifecycleTransitions: Record<ArtifactLifecycleStatus, ArtifactLifecycleStatus[]> = {
    DRAFT: ['IN_REVIEW'],
    IN_REVIEW: ['APPROVED', 'DRAFT'],
    APPROVED: ['PUBLISHED', 'IN_REVIEW'],
    PUBLISHED: ['SUPERSEDED', 'ARCHIVED'],
    SUPERSEDED: ['ARCHIVED'],
    ARCHIVED: [],
};

const businessRequestTransitions: Record<BusinessRequestStatus, BusinessRequestStatus[]> = {
    DRAFT: ['ANALYZED', 'REJECTED'],
    ANALYZED: ['APPROVED', 'REJECTED', 'DRAFT'],
    APPROVED: ['REJECTED'],
    REJECTED: ['DRAFT'],
};

// ============================================
// TRANSITION GUARD RULES
// ============================================

export interface TransitionContext {
    entityType: string;
    entityId: string;
    from: string;
    to: string;
    entity?: Record<string, unknown>;
    actorId?: string;
}

type GuardRule = {
    condition: (ctx: TransitionContext) => boolean;
    message: string;
};

const transitionGuards: Record<string, GuardRule[]> = {
    'WorkItem:*->IN_PROGRESS': [
        {
            condition: (ctx) => !ctx.entity?.assigneeId,
            message: 'Assignee is required before moving to IN_PROGRESS.',
        },
    ],
    'WorkItem:*->READY_FOR_TEST': [
        {
            condition: (ctx) => !ctx.entity?.description || (ctx.entity.description as string).trim() === '',
            message: 'Description is required before marking as READY_FOR_TEST.',
        },
    ],
    'WorkItem:BUG:*->IN_ANALYSIS': [
        {
            condition: (ctx) => !ctx.entity?.severity,
            message: 'Severity must be set before starting bug analysis.',
        },
    ],
    'WorkItem:BUG:*->FIXED': [
        {
            condition: (ctx) => !ctx.entity?.assigneeId,
            message: 'Assignee is required before marking bug as FIXED.',
        },
    ],
};

function evaluateGuards(ctx: TransitionContext): string[] {
    const violations: string[] = [];
    
    const keys = [
        `${ctx.entityType}:*->${ctx.to}`,
        `${ctx.entityType}:${ctx.from}->${ctx.to}`,
    ];
    
    // Add type-specific keys for WorkItems
    if (ctx.entity?.itemType) {
        keys.push(`${ctx.entityType}:${ctx.entity.itemType}:*->${ctx.to}`);
        keys.push(`${ctx.entityType}:${ctx.entity.itemType}:${ctx.from}->${ctx.to}`);
    }

    for (const key of keys) {
        const guards = transitionGuards[key];
        if (guards) {
            for (const guard of guards) {
                if (guard.condition(ctx)) {
                    violations.push(guard.message);
                }
            }
        }
    }

    return violations;
}

// ============================================
// DOMAIN EVENT EMISSION
// ============================================

export interface TransitionEvent {
    entityType: string;
    entityId: string;
    from: string;
    to: string;
    actorId?: string;
    timestamp: string;
    guardViolations?: string[];
}

const transitionListeners: Array<(event: TransitionEvent) => void> = [];

export function onTransition(listener: (event: TransitionEvent) => void) {
    transitionListeners.push(listener);
}

function emitTransitionEvent(event: TransitionEvent) {
    for (const listener of transitionListeners) {
        try {
            listener(event);
        } catch (err) {
            logger.error('Transition event listener error', err);
        }
    }
}

// ============================================
// ASSERTION FUNCTIONS
// ============================================

function assertTransition(
    entityType: string,
    matrix: Record<string, string[]>,
    current: string,
    next: string,
    label: string,
    ctx?: Partial<TransitionContext>
) {
    if (current === next) return;

    const allowed = matrix[current] || [];
    if (!allowed.includes(next)) {
        throw new AppError(`Invalid ${label} status transition: ${current} -> ${next}`, 400);
    }

    // Run guard rules if entity context provided
    if (ctx?.entity) {
        const fullCtx: TransitionContext = {
            entityType,
            entityId: ctx.entityId || 'unknown',
            from: current,
            to: next,
            entity: ctx.entity,
            actorId: ctx.actorId,
        };

        const violations = evaluateGuards(fullCtx);
        if (violations.length > 0) {
            throw new AppError(`Transition ${current} -> ${next} blocked: ${violations.join(' ')}`, 409);
        }
    }

    // Emit domain event
    emitTransitionEvent({
        entityType,
        entityId: ctx?.entityId || 'unknown',
        from: current,
        to: next,
        actorId: ctx?.actorId,
        timestamp: new Date().toISOString(),
    });
}

export function assertTestCaseTransition(current: TestCaseStatus, next: TestCaseStatus) {
    assertTransition('TestCase', testCaseTransitions, current, next, 'test case');
}

export function assertTestRunTransition(current: TestRunStatus, next: TestRunStatus) {
    assertTransition('TestRun', testRunTransitions, current, next, 'test run');
}

export function assertReleaseTransition(current: ReleaseStatus, next: ReleaseStatus) {
    assertTransition('Release', releaseTransitions, current, next, 'release');
}

export function assertWorkItemTransition(
    type: string,
    current: string,
    next: string,
    ctx?: { entityId?: string; entity?: Record<string, unknown>; actorId?: string }
) {
    if (current === next) return;

    let matrix: Record<string, string[]>;
    switch (type) {
        case 'BUG':
            matrix = bugTransitions;
            break;
        case 'DEFECT':
            matrix = defectTransitions;
            break;
        case 'INCIDENT':
            matrix = incidentTransitions;
            break;
        case 'STORY':
            matrix = storyTransitions;
            break;
        default:
            matrix = genericWorkItemTransitions;
            break;
    }

    assertTransition('WorkItem', matrix, current, next, `work item (${type})`, {
        entityId: ctx?.entityId,
        entity: ctx?.entity ? { ...ctx.entity, itemType: type } : undefined,
        actorId: ctx?.actorId,
    });
}

export function assertAutomationTransition(current: AutomationStatus, next: AutomationStatus) {
    assertTransition('Automation', automationTransitions, current, next, 'automation');
}

export function assertArtifactLifecycleTransition(current: ArtifactLifecycleStatus, next: ArtifactLifecycleStatus) {
    assertTransition('Artifact', artifactLifecycleTransitions, current, next, 'artifact lifecycle');
}

export function assertBusinessRequestTransition(current: BusinessRequestStatus, next: BusinessRequestStatus) {
    assertTransition('BusinessRequest', businessRequestTransitions, current, next, 'business request');
}

