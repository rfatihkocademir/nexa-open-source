import { auditService } from '../services/audit.service';
import { createLogger } from './logger';

const logger = createLogger('PolicyEvaluator');

// ============================================
// TYPES
// ============================================

export interface PolicySubject {
    actorId: string;
    actorRole: string;
    permissions?: string[];
}

export interface PolicyResource {
    resourceType: string;
    resourceId?: string;
    resourceState?: string;
    resourceOwnerId?: string;
    projectId?: string;
}

export interface PolicyAction {
    action: string;
}

export interface PolicyDecision {
    allowed: boolean;
    reason?: string;
    violatedRules?: string[];
}

// ============================================
// POLICY RULES
// ============================================

interface PolicyRule {
    id: string;
    description: string;
    evaluate: (subject: PolicySubject, resource: PolicyResource, action: PolicyAction) => PolicyDecision | null;
}

const policyRules: PolicyRule[] = [
    // 1. DEVELOPER cannot create or finalize releases
    {
        id: 'RELEASE_CREATE_RESTRICTION',
        description: 'Developer role cannot create release candidates',
        evaluate: (subject, resource, action) => {
            if (resource.resourceType === 'ReleaseCandidate' && ['create', 'finalize'].includes(action.action)) {
                if (subject.actorRole === 'DEVELOPER') {
                    return { allowed: false, reason: 'Developers cannot create or finalize releases.' };
                }
            }
            return null;
        },
    },

    // 2. Only QA-capable roles can approve test cases
    {
        id: 'TEST_CASE_APPROVE_RESTRICTION',
        description: 'Only TEAM_LEADER, ADMIN, or TESTER with quality permission can approve test cases',
        evaluate: (subject, resource, action) => {
            if (resource.resourceType === 'TestCase' && action.action === 'approve') {
                const approverRoles = ['ADMIN', 'TEAM_LEADER', 'TESTER', 'SCRUM_MASTER'];
                if (!approverRoles.includes(subject.actorRole)) {
                    return { allowed: false, reason: 'Only QA-capable roles can approve test cases.' };
                }
            }
            return null;
        },
    },

    // 3. ANALYST cannot trigger deployments
    {
        id: 'DEPLOY_TRIGGER_RESTRICTION',
        description: 'Analyst role cannot trigger deployments',
        evaluate: (subject, resource, action) => {
            if (resource.resourceType === 'ReleaseCandidate' && action.action === 'deploy') {
                if (subject.actorRole === 'ANALYST') {
                    return { allowed: false, reason: 'Analysts cannot trigger deployments.' };
                }
            }
            return null;
        },
    },

    // 4. Only resource owner or authorized roles can modify in certain states
    {
        id: 'OWNERSHIP_STATE_GUARD',
        description: 'Resources in advanced states can only be modified by owner or managers',
        evaluate: (subject, resource, action) => {
            if (action.action !== 'update') return null;

            const protectedStates = ['APPROVED', 'PUBLISHED', 'RELEASED', 'CLOSED'];
            if (resource.resourceState && protectedStates.includes(resource.resourceState)) {
                const managerRoles = ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER'];
                const isOwner = resource.resourceOwnerId === subject.actorId;
                const isManager = managerRoles.includes(subject.actorRole);

                if (!isOwner && !isManager) {
                    return {
                        allowed: false,
                        reason: `Resources in ${resource.resourceState} state can only be modified by the owner or a manager role.`,
                    };
                }
            }
            return null;
        },
    },

    // 5. PRODUCT_OWNER cannot modify automation scripts
    {
        id: 'AUTOMATION_MODIFY_RESTRICTION',
        description: 'Product Owner cannot modify automation configurations',
        evaluate: (subject, resource, action) => {
            if (resource.resourceType === 'AutomationScenario' && ['update', 'delete'].includes(action.action)) {
                if (subject.actorRole === 'PRODUCT_OWNER') {
                    return { allowed: false, reason: 'Product Owners cannot modify automation scripts.' };
                }
            }
            return null;
        },
    },
];

// ============================================
// EVALUATOR
// ============================================

/**
 * Evaluates all policy rules against the given subject, resource, and action.
 * Returns the combined decision. If any rule denies, the overall result is denied.
 */
export async function evaluatePolicy(
    subject: PolicySubject,
    resource: PolicyResource,
    action: PolicyAction
): Promise<PolicyDecision> {
    const violations: string[] = [];
    const violatedRuleIds: string[] = [];

    // Admin bypass for non-restricted operations
    // NOTE: Admin is still subject to state-based guards (rule 4) for audit purposes
    if (subject.actorRole === 'ADMIN') {
        return { allowed: true };
    }

    for (const rule of policyRules) {
        try {
            const result = rule.evaluate(subject, resource, action);
            if (result && !result.allowed) {
                violations.push(result.reason || rule.description);
                violatedRuleIds.push(rule.id);
            }
        } catch (err) {
            logger.error(`Policy rule ${rule.id} evaluation failed`, err);
        }
    }

    if (violations.length > 0) {
        // Log policy violation to audit
        try {
            await auditService.log({
                context: {
                    actorId: subject.actorId,
                    projectId: resource.projectId,
                },
                entityType: resource.resourceType,
                entityId: resource.resourceId || 'unknown',
                action: 'POLICY_VIOLATION',
                after: {
                    attemptedAction: action.action,
                    actorRole: subject.actorRole,
                    resourceState: resource.resourceState,
                    violatedRules: violatedRuleIds,
                    reasons: violations,
                },
            });
        } catch (auditErr) {
            logger.error('Failed to audit policy violation', auditErr);
        }

        return {
            allowed: false,
            reason: violations.join(' '),
            violatedRules: violatedRuleIds,
        };
    }

    return { allowed: true };
}

/**
 * Helper that throws AppError if policy denies the action.
 */
export async function enforcePolicy(
    subject: PolicySubject,
    resource: PolicyResource,
    action: PolicyAction
): Promise<void> {
    const decision = await evaluatePolicy(subject, resource, action);
    if (!decision.allowed) {
        const { AppError } = await import('./AppError');
        throw new AppError(decision.reason || 'Policy denied this action.', 403);
    }
}
