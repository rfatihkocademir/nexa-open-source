import { createHash } from 'node:crypto';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { calculateQualityDimensions, calculateRegressionTrend } from './quality-math.service';

type QualityTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
type StakeholderDecision = 'APPROVE' | 'APPROVE_WITH_RESERVATION' | 'REJECT' | 'ABSTAIN';

const POLICIES: Record<QualityTier, { minPassRate: number; minPassConfidence: number; minQualityScore: number; minExecutionRate: number; blockHighBugs: boolean }> = {
    TIER_0: { minPassRate: 99.5, minPassConfidence: 97, minQualityScore: 95, minExecutionRate: 100, blockHighBugs: true },
    TIER_1: { minPassRate: 98, minPassConfidence: 95, minQualityScore: 90, minExecutionRate: 100, blockHighBugs: true },
    TIER_2: { minPassRate: 95, minPassConfidence: 90, minQualityScore: 82, minExecutionRate: 98, blockHighBugs: false },
    TIER_3: { minPassRate: 90, minPassConfidence: 80, minQualityScore: 70, minExecutionRate: 90, blockHighBugs: false },
};

const acceptedDecisions = new Set<StakeholderDecision>(['APPROVE', 'APPROVE_WITH_RESERVATION']);
const terminalWorkItemStatuses = ['DONE', 'CLOSED'];

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stableValue(item)]));
    }
    return value;
}

function hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

export class ReleaseConsensusService {
    private async assertRelease(projectId: string, releaseCandidateId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const release = await (prisma as any).releaseCandidate.findFirst({
            where: { id: releaseCandidateId, projectId, deletedAt: null },
            select: { id: true, key: true, title: true, label: true, status: true, projectId: true },
        });
        if (!release) throw new AppError('Release candidate not found', 404);
        return release;
    }

    private async evaluate(projectId: string, releaseCandidateId: string) {
        const project = await (prisma as any).project.findUnique({
            where: { id: projectId },
            select: { id: true, key: true, name: true, qualityTier: true },
        });
        const release = await (prisma as any).releaseCandidate.findUnique({
            where: { id: releaseCandidateId },
            select: {
                id: true, key: true, title: true, label: true, status: true, updatedAt: true, approvedTestCases: true, totalTestCases: true, traceabilityGaps: true,
                workItemLinks: {
                    orderBy: { workItemId: 'asc' },
                    select: { workItem: { select: { id: true, key: true, title: true, itemType: true, status: true, priority: true, severity: true, updatedAt: true } } },
                },
                runLinks: {
                    orderBy: { testRunId: 'asc' },
                    select: { testRun: { select: {
                        id: true, key: true, title: true, status: true, updatedAt: true,
                        environment: { select: { id: true, name: true } },
                        items: { orderBy: { id: 'asc' }, select: { id: true, testCaseId: true, finalStatus: true } },
                    } } },
                },
            },
        });
        if (!project || !release) throw new AppError('Release candidate not found', 404);

        const tier = project.qualityTier as QualityTier;
        const policy = POLICIES[tier];
        const workItems = release.workItemLinks.map((link: any) => link.workItem);
        const testRuns = release.runLinks.map((link: any) => link.testRun);
        const runItems = testRuns.flatMap((run: any) => run.items);
        const executed = runItems.filter((item: any) => item.finalStatus !== 'UNTESTED').length;
        const passed = runItems.filter((item: any) => item.finalStatus === 'PASS').length;
        const failed = runItems.filter((item: any) => item.finalStatus === 'FAIL').length;
        const blocked = runItems.filter((item: any) => item.finalStatus === 'BLOCK').length;
        const conflicts = runItems.filter((item: any) => item.finalStatus === 'CONFLICT').length;
        const passRate = executed ? Number(((passed / executed) * 100).toFixed(2)) : 0;
        const executionRate = runItems.length ? Number(((executed / runItems.length) * 100).toFixed(2)) : 0;
        const openBugs = workItems.filter((item: any) => ['BUG', 'DEFECT', 'INCIDENT'].includes(item.itemType) && !terminalWorkItemStatuses.includes(item.status));
        const criticalOpenBugs = openBugs.filter((item: any) => item.severity === 'CRITICAL').length;
        const highOpenBugs = openBugs.filter((item: any) => item.severity === 'HIGH').length;
        const mediumOpenBugs = openBugs.filter((item: any) => item.severity === 'MEDIUM').length;
        const lowOpenBugs = openBugs.filter((item: any) => item.severity === 'LOW').length;
        const dimensions = calculateQualityDimensions({
            passed, executed, total: runItems.length,
            approvedTestCases: release.approvedTestCases, totalTestCases: release.totalTestCases,
            tracedWorkItems: Math.max(0, workItems.length - release.traceabilityGaps), totalWorkItems: workItems.length,
            openDefects: { critical: criticalOpenBugs, high: highOpenBugs, medium: mediumOpenBugs, low: lowOpenBugs },
        });
        const historicalRuns = await (prisma as any).testRun.findMany({
            where: { projectId, status: 'COMPLETED', deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 12,
            select: { totalItems: true, passedCount: true, untestedCount: true },
        });
        const trend = calculateRegressionTrend(historicalRuns.reverse().map((run: any) => {
            const historicalExecuted = Math.max(0, run.totalItems - run.untestedCount);
            return historicalExecuted ? Number(((run.passedCount / historicalExecuted) * 100).toFixed(2)) : 0;
        }));

        const blockers: string[] = [];
        const warnings: string[] = [];
        if (!runItems.length) blockers.push('Release kapsamında test kanıtı bulunmuyor.');
        if (executionRate < policy.minExecutionRate) blockers.push(`Test yürütme oranı %${policy.minExecutionRate} eşiğinin altında.`);
        if (passRate < policy.minPassRate) blockers.push(`Pass oranı %${policy.minPassRate} eşiğinin altında.`);
        if (dimensions.passConfidenceLower < policy.minPassConfidence) blockers.push(`Pass oranının %95 güven alt sınırı %${policy.minPassConfidence} eşiğinin altında.`);
        if (dimensions.qualityScore < policy.minQualityScore) blockers.push(`Bileşik kalite skoru ${policy.minQualityScore} eşiğinin altında.`);
        if (criticalOpenBugs > 0) blockers.push(`${criticalOpenBugs} açık kritik hata deploy'u engelliyor.`);
        if (highOpenBugs > 0 && policy.blockHighBugs) blockers.push(`${highOpenBugs} açık yüksek seviye hata bu tier için engelleyici.`);
        if (highOpenBugs > 0 && !policy.blockHighBugs) warnings.push(`${highOpenBugs} açık yüksek seviye hata için risk mutabakatı gerekiyor.`);
        if (failed + blocked + conflicts > 0) warnings.push(`${failed + blocked + conflicts} başarısız, bloklu veya çakışmalı test sonucu var.`);
        if (trend.direction === 'DEGRADING') warnings.push(`Son ${trend.sampleSize} regresyon koşumunda kalite eğilimi düşüyor (${trend.slope} puan/koşum).`);

        const qualityResult = blockers.length ? 'BLOCKED' : warnings.length ? 'CONDITIONAL' : 'READY';
        const metrics = { total: runItems.length, executed, passed, failed, blocked, conflicts, passRate, executionRate, openBugs: openBugs.length, criticalOpenBugs, highOpenBugs, mediumOpenBugs, lowOpenBugs, dimensions, trend };
        const manifest = {
            schemaVersion: 1,
            project: { id: project.id, key: project.key, name: project.name, qualityTier: tier },
            release: { id: release.id, key: release.key, title: release.title, label: release.label, status: release.status, updatedAt: release.updatedAt },
            workItems,
            testRuns: testRuns.map((run: any) => ({ ...run, items: run.items })),
        };
        return { qualityResult, metrics, blockers, warnings, policy, manifest, scopeHash: hash(manifest) };
    }

    async getState(projectId: string, releaseCandidateId: string, userId: string, role: string) {
        await this.assertRelease(projectId, releaseCandidateId, userId, role);
        const preview = await this.evaluate(projectId, releaseCandidateId);
        const latestRound = await (prisma as any).releaseApprovalRound.findFirst({
            where: { releaseCandidateId }, orderBy: { roundNumber: 'desc' },
            include: {
                scopeSnapshot: true,
                decisions: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { updatedAt: 'asc' } },
            },
        });
        let stakeholders: any[] = [];
        if (latestRound?.requiredStakeholderIds?.length) {
            stakeholders = await prisma.user.findMany({
                where: { id: { in: latestRound.requiredStakeholderIds } },
                select: { id: true, firstName: true, lastName: true, email: true },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            });
        }
        const packages = await (prisma as any).deployPackage.findMany({
            where: { releaseCandidateId }, orderBy: { packageNumber: 'desc' },
            include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        });
        return { preview, latestRound, stakeholders, packages };
    }

    async updateTier(projectId: string, tier: QualityTier, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        if (!POLICIES[tier]) throw new AppError('Invalid quality tier', 400);
        await (prisma as any).project.update({ where: { id: projectId }, data: { qualityTier: tier } });
        return { qualityTier: tier, policy: POLICIES[tier] };
    }

    async startRound(projectId: string, releaseCandidateId: string, userId: string, role: string) {
        await this.assertRelease(projectId, releaseCandidateId, userId, role);
        const evaluation = await this.evaluate(projectId, releaseCandidateId);
        const members = await prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } });
        const requiredStakeholderIds = [...new Set([...members.map((member) => member.userId), userId])].sort();
        if (!requiredStakeholderIds.length) throw new AppError('No project stakeholders found', 409);

        return prisma.$transaction(async (tx: any) => {
            const lastSnapshot = await tx.releaseScopeSnapshot.findFirst({ where: { releaseCandidateId }, orderBy: { version: 'desc' }, select: { version: true } });
            const lastRound = await tx.releaseApprovalRound.findFirst({ where: { releaseCandidateId }, orderBy: { roundNumber: 'desc' }, select: { roundNumber: true } });
            await tx.releaseApprovalRound.updateMany({ where: { releaseCandidateId, status: 'AWAITING_CONSENSUS' }, data: { status: 'INVALIDATED', completedAt: new Date() } });
            const snapshot = await tx.releaseScopeSnapshot.create({ data: {
                releaseCandidateId, version: (lastSnapshot?.version ?? 0) + 1, scopeHash: evaluation.scopeHash,
                manifest: evaluation.manifest, qualityResult: evaluation.qualityResult, qualityMetrics: evaluation.metrics,
                policySnapshot: { ...evaluation.policy, blockers: evaluation.blockers, warnings: evaluation.warnings }, createdById: userId,
            } });
            return tx.releaseApprovalRound.create({ data: {
                releaseCandidateId, scopeSnapshotId: snapshot.id, roundNumber: (lastRound?.roundNumber ?? 0) + 1,
                requiredStakeholderIds, createdById: userId,
            }, include: { scopeSnapshot: true, decisions: true } });
        });
    }

    async decide(projectId: string, releaseCandidateId: string, roundId: string, decision: StakeholderDecision, rationale: string, userId: string, role: string) {
        await this.assertRelease(projectId, releaseCandidateId, userId, role);
        const trimmedRationale = rationale?.trim();
        if (!acceptedDecisions.has(decision) && !['REJECT', 'ABSTAIN'].includes(decision)) throw new AppError('Invalid stakeholder decision', 400);
        if (!trimmedRationale || trimmedRationale.length < 10) throw new AppError('Decision rationale must be at least 10 characters', 400);
        const round = await (prisma as any).releaseApprovalRound.findFirst({ where: { id: roundId, releaseCandidateId } });
        if (!round) throw new AppError('Approval round not found', 404);
        if (round.status !== 'AWAITING_CONSENSUS') throw new AppError('Approval round is no longer open', 409);
        if (!round.requiredStakeholderIds.includes(userId)) throw new AppError('You are not a required stakeholder for this round', 403);

        await (prisma as any).releaseApprovalDecision.upsert({
            where: { roundId_userId: { roundId, userId } },
            create: { roundId, userId, decision, rationale: trimmedRationale },
            update: { decision, rationale: trimmedRationale },
        });
        const decisions = await (prisma as any).releaseApprovalDecision.findMany({ where: { roundId } });
        const byUser = new Map(decisions.map((item: any) => [item.userId, item.decision]));
        const rejected = decisions.some((item: any) => item.decision === 'REJECT');
        const complete = round.requiredStakeholderIds.every((id: string) => acceptedDecisions.has(byUser.get(id) as StakeholderDecision));
        const status = rejected ? 'REJECTED' : complete ? 'CONSENSUS_REACHED' : 'AWAITING_CONSENSUS';
        return (prisma as any).releaseApprovalRound.update({
            where: { id: roundId }, data: { status, completedAt: status === 'AWAITING_CONSENSUS' ? null : new Date() },
            include: { scopeSnapshot: true, decisions: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
        });
    }

    async createPackage(projectId: string, releaseCandidateId: string, userId: string, role: string) {
        await this.assertRelease(projectId, releaseCandidateId, userId, role);
        const round = await (prisma as any).releaseApprovalRound.findFirst({
            where: { releaseCandidateId }, orderBy: { roundNumber: 'desc' }, include: { scopeSnapshot: true, decisions: true },
        });
        if (!round || round.status !== 'CONSENSUS_REACHED') throw new AppError('Full stakeholder consensus is required', 409);
        const evaluation = await this.evaluate(projectId, releaseCandidateId);
        if (evaluation.scopeHash !== round.scopeSnapshot.scopeHash) {
            await (prisma as any).releaseApprovalRound.update({ where: { id: round.id }, data: { status: 'INVALIDATED', completedAt: new Date() } });
            throw new AppError('Release scope changed after approval; approvals were invalidated', 409);
        }
        const byUser = new Map(round.decisions.map((item: any) => [item.userId, item.decision]));
        if (!round.requiredStakeholderIds.every((id: string) => acceptedDecisions.has(byUser.get(id) as StakeholderDecision))) {
            throw new AppError('Every required stakeholder must approve the release', 409);
        }
        const lastPackage = await (prisma as any).deployPackage.findFirst({ where: { releaseCandidateId }, orderBy: { packageNumber: 'desc' }, select: { packageNumber: true } });
        const packageNumber = (lastPackage?.packageNumber ?? 0) + 1;
        const manifest = { ...evaluation.manifest, quality: { result: evaluation.qualityResult, metrics: evaluation.metrics, policy: evaluation.policy }, approvals: round.decisions };
        return (prisma as any).deployPackage.create({ data: {
            releaseCandidateId, scopeSnapshotId: round.scopeSnapshotId, approvalRoundId: round.id,
            packageNumber, manifest, packageHash: hash({ scopeHash: evaluation.scopeHash, packageNumber, manifest }), createdById: userId,
        } });
    }
}

export const releaseConsensusService = new ReleaseConsensusService();
