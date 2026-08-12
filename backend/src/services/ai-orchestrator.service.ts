type ReleaseRecommendation = 'READY' | 'CONDITIONAL' | 'NOT_READY';

type ReleaseAICandidate = {
    readinessScore?: number | null;
    totalWorkItems: number;
    completedWorkItems: number;
    openBugs: number;
    criticalOpenBugs: number;
    approvedTestCases: number;
    totalTestCases: number;
    openRuns: number;
    failedRunItems: number;
    blockedRunItems: number;
    conflictRunItems: number;
    traceabilityGaps: number;
    openFollowUpItems: number;
    completedFollowUpItems: number;
    linkedCommits: number;
    openPullRequests: number;
    mergedPullRequests: number;
};

export type ReleaseAINextAction = {
    type: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    actionLabel: string;
    targetTab: 'backlog' | 'runs' | 'traceability' | 'releases';
    targetFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
};

export type ReleaseAISummary = {
    summary: string;
    recommendation: ReleaseRecommendation;
    confidence: number;
    topRisks: string[];
    highlights: string[];
    nextActions: ReleaseAINextAction[];
};

type BusinessRequestAICandidate = {
    id: string;
    projectId: string;
    status: 'DRAFT' | 'ANALYZED' | 'APPROVED' | 'REJECTED';
    analysisStatus?: 'NEEDS_INFO' | 'COMPLETE';
    questionCount: number;
    epicCount: number;
    totalStories: number;
    coveredStories: number;
    linkedRuns: number;
    failedRunItems: number;
    blockedRunItems: number;
    conflictRunItems: number;
    linkedReleaseCandidates: number;
    releasesNeedingAttention: number;
};

export type BusinessRequestAISummary = {
    recommendation: ReleaseRecommendation;
    summary: string;
    confidence: number;
    topRisks: string[];
    highlights: string[];
    nextActions: Array<{
        label: string;
        href: string;
        detail: string;
    }>;
};

export class AIOrchestratorService {
    buildBusinessRequestSummary(candidate: BusinessRequestAICandidate, language: string = 'en'): BusinessRequestAISummary {
        const isTr = language === 'tr';
        const coverageGaps = Math.max(candidate.totalStories - candidate.coveredStories, 0);
        const blockingRunSignals = candidate.failedRunItems + candidate.blockedRunItems;
        const topRisks: string[] = [];
        const highlights: string[] = [];
        const nextActions: BusinessRequestAISummary['nextActions'] = [];

        if (candidate.status !== 'APPROVED') {
            topRisks.push(isTr ? 'Backlog grubu henüz onaylanmadı' : 'Backlog batch is not approved yet');
            nextActions.push({
                label: isTr ? 'Backlog grubunu incele' : 'Review backlog batch',
                href: `/projects/${candidate.projectId}?tab=ai-analyst&requestId=${candidate.id}`,
                detail: isTr ? 'Analiz edilen epic ve storyleri onaylayarak bu talebi teslimata taşıyın.' : 'Approve the analyzed epics and stories to move this request into delivery.',
            });
        }
        if (coverageGaps > 0) {
            topRisks.push(isTr ? `${coverageGaps} story için henüz bağlı test yok` : `${coverageGaps} story still has no linked tests`);
            nextActions.push({
                label: isTr ? 'Test boşluklarını doldur' : 'Fill test gaps',
                href: `/projects/${candidate.projectId}?tab=traceability&aiFocus=traceability-gaps`,
                detail: isTr ? 'Release onayı öncesinde kapsanmayan storyler için test üretin veya bağlayın.' : 'Generate or link tests for uncovered stories before release sign-off.',
            });
        }
        if (blockingRunSignals > 0) {
            topRisks.push(isTr ? `${blockingRunSignals} engelleyici koşu sinyali tespit edildi` : `${blockingRunSignals} blocking run signal detected`);
            nextActions.push({
                label: isTr ? 'Yürütme koşularını incele' : 'Review execution runs',
                href: `/projects/${candidate.projectId}?tab=runs&aiFocus=failed-runs`,
                detail: isTr ? 'Bu talebe bağlı başarısız veya engellenmiş yürütme kanıtlarını çözün.' : 'Resolve failed or blocked execution evidence linked to this request.',
            });
        } else if (candidate.linkedRuns > 0) {
            nextActions.push({
                label: isTr ? 'Bağlı koşuları denetle' : 'Inspect linked runs',
                href: `/projects/${candidate.projectId}?tab=runs&aiFocus=open-runs`,
                detail: isTr ? 'Release onayına geçmeden önce aktif koşu kanıtlarını doğrulayın.' : 'Validate active run evidence before moving toward release approval.',
            });
        }
        if (candidate.status === 'APPROVED' && candidate.linkedReleaseCandidates === 0) {
            topRisks.push(isTr ? 'Bu talepten henüz bir release candidate oluşturulmadı' : 'No release candidate has been created from this request');
            nextActions.push({
                label: isTr ? 'Release çalışma alanını hazırla' : 'Prepare release workspace',
                href: `/projects/${candidate.projectId}?tab=releases&sourceRequestId=${candidate.id}`,
                detail: isTr ? 'Kapsam ve kalite kanıtları stabil olduğunda ilk release candidate\'ı oluşturun.' : 'Create the first release candidate once scope and quality evidence are stable.',
            });
        }
        if (candidate.releasesNeedingAttention > 0) {
            topRisks.push(isTr ? `${candidate.releasesNeedingAttention} bağlı release candidate hâlâ onay bekliyor` : `${candidate.releasesNeedingAttention} linked release candidate still needs approval`);
            nextActions.push({
                label: isTr ? 'Release yönetişimini aç' : 'Open release governance',
                href: `/projects/${candidate.projectId}?tab=releases&sourceRequestId=${candidate.id}`,
                detail: isTr ? 'Bağlı release\'ler için hazırlık durumunu, karar kapsamını ve kod kanıtlarını inceleyin.' : 'Review readiness, decision coverage and code evidence for linked releases.',
            });
        }

        let recommendation: ReleaseRecommendation = 'READY';
        if (candidate.status !== 'APPROVED' || blockingRunSignals > 0) {
            recommendation = 'NOT_READY';
        } else if (coverageGaps > 0 || candidate.linkedReleaseCandidates === 0 || candidate.releasesNeedingAttention > 0) {
            recommendation = 'CONDITIONAL';
        }

        const summary = isTr 
            ? (recommendation === 'READY'
                ? 'Talep grafiği backlogdan release\'e kadar hizalandı. Teslimat kanıtları ve yönetişim sinyalleri yayınlanabilir durumda.'
                : recommendation === 'CONDITIONAL'
                    ? 'Talep grafiği ilerliyor ancak en az bir kapsam veya release yönetişim boşluğu kapatılmalıdır.'
                    : 'Talep grafiğinde engelleyici teslimat sinyalleri var. İlerlemek için onay veya yürütme sorunlarını çözün.')
            : (recommendation === 'READY'
                ? 'Request graph is aligned from backlog to release. Delivery evidence and governance signals are in a releasable state.'
                : recommendation === 'CONDITIONAL'
                    ? 'Request graph is progressing, but at least one coverage or release governance gap should be closed next.'
                    : 'Request graph still has blocking delivery signals. Resolve approval or execution issues before moving forward.');

        highlights.push(isTr 
            ? `AI analiz durumu: ${candidate.analysisStatus === 'COMPLETE' ? 'TAMAMLANDI' : candidate.analysisStatus === 'NEEDS_INFO' ? 'BİLGİ GEREKLİ' : 'BİLİNMİYOR'}` 
            : `AI analysis status is ${candidate.analysisStatus ?? 'UNAVAILABLE'}`);
        
        highlights.push(isTr
            ? `Backlog ${candidate.epicCount} epic ve ${candidate.totalStories} story içeriyor`
            : `Backlog includes ${candidate.epicCount} epic(s) and ${candidate.totalStories} stor${candidate.totalStories === 1 ? 'y' : 'ies'}`);
        
        highlights.push(isTr
            ? `Kapsam şu anda ${candidate.totalStories || 0} story'den ${candidate.coveredStories} tanesine ulaşıyor`
            : `Coverage currently reaches ${candidate.coveredStories}/${candidate.totalStories || 0} stor${candidate.totalStories === 1 ? 'y' : 'ies'}`);
        
        if (candidate.questionCount > 0) {
            highlights.push(isTr
                ? `${candidate.questionCount} açıklama sorusu kayıtlarda duruyor`
                : `${candidate.questionCount} clarification question(s) remain on record`);
        }
        if (candidate.linkedReleaseCandidates > 0) {
            highlights.push(isTr
                ? `Talebe ${candidate.linkedReleaseCandidates} bağlı release candidate eklendi`
                : `${candidate.linkedReleaseCandidates} linked release candidate(s) attached to the request`);
        }

        let confidence = 0.55;
        if (candidate.analysisStatus === 'COMPLETE') confidence += 0.1;
        if (candidate.status === 'APPROVED') confidence += 0.1;
        if (coverageGaps === 0) confidence += 0.05;
        if (blockingRunSignals === 0) confidence += 0.05;
        if (candidate.releasesNeedingAttention === 0 && candidate.linkedReleaseCandidates > 0) confidence += 0.05;
        if (candidate.questionCount > 0) confidence -= Math.min(0.1, candidate.questionCount * 0.03);
        confidence = Math.max(0.35, Math.min(0.95, confidence));

        return {
            recommendation,
            summary,
            confidence: Number(confidence.toFixed(2)),
            topRisks,
            highlights,
            nextActions,
        };
    }

    buildReleaseSummary(candidate: ReleaseAICandidate): ReleaseAISummary {
        const topRisks: string[] = [];
        const highlights: string[] = [];
        const nextActions: ReleaseAINextAction[] = [];

        if (candidate.criticalOpenBugs > 0) {
            topRisks.push(`${candidate.criticalOpenBugs} critical bug still open`);
            nextActions.push({
                type: 'BUG',
                priority: 'HIGH',
                title: 'Close critical defects',
                description: 'Resolve or explicitly defer all critical bugs before final release approval.',
                actionLabel: 'Open backlog',
                targetTab: 'backlog',
                targetFocus: 'critical-bugs',
            });
        }
        if (candidate.failedRunItems > 0) {
            topRisks.push(`${candidate.failedRunItems} failed run item detected`);
            nextActions.push({
                type: 'RUN',
                priority: 'HIGH',
                title: 'Investigate failed executions',
                description: 'Review failed run items and confirm whether they are product defects or test issues.',
                actionLabel: 'Review runs',
                targetTab: 'runs',
                targetFocus: 'failed-runs',
            });
        }
        if (candidate.blockedRunItems > 0) {
            topRisks.push(`${candidate.blockedRunItems} blocked run item requires follow-up`);
            nextActions.push({
                type: 'RUN',
                priority: 'HIGH',
                title: 'Remove blockers from execution flow',
                description: 'Clear blocked executions so release verification can complete.',
                actionLabel: 'Review runs',
                targetTab: 'runs',
                targetFocus: 'failed-runs',
            });
        }
        if (candidate.conflictRunItems > 0) {
            topRisks.push(`${candidate.conflictRunItems} conflict item needs resolution`);
            nextActions.push({
                type: 'DECISION',
                priority: 'MEDIUM',
                title: 'Resolve execution conflicts',
                description: 'Review manual and automation mismatches before finalizing quality sign-off.',
                actionLabel: 'Review runs',
                targetTab: 'runs',
                targetFocus: 'conflicts',
            });
        }
        if (candidate.openRuns > 0) {
            topRisks.push(`${candidate.openRuns} linked run still open`);
            nextActions.push({
                type: 'RUN',
                priority: 'MEDIUM',
                title: 'Close linked runs',
                description: 'Complete or explicitly cancel open linked runs to stabilize release evidence.',
                actionLabel: 'Open runs',
                targetTab: 'runs',
                targetFocus: 'open-runs',
            });
        }
        if (candidate.traceabilityGaps > 0) {
            topRisks.push(`${candidate.traceabilityGaps} traceability gap remains`);
            nextActions.push({
                type: 'TRACEABILITY',
                priority: 'MEDIUM',
                title: 'Fill traceability gaps',
                description: 'Link uncovered scope to tests or explicitly accept the gap.',
                actionLabel: 'Open traceability',
                targetTab: 'traceability',
                targetFocus: 'traceability-gaps',
            });
        }
        if (candidate.openFollowUpItems > 0) {
            topRisks.push(`${candidate.openFollowUpItems} generated follow-up item still open`);
            nextActions.push({
                type: 'DECISION',
                priority: 'MEDIUM',
                title: 'Close generated follow-ups',
                description: 'Resolve or explicitly defer AI-generated follow-up items before final release sign-off.',
                actionLabel: 'Open release hub',
                targetTab: 'releases',
                targetFocus: 'follow-up-items',
            });
        }
        if (candidate.openPullRequests > 0) {
            topRisks.push(`${candidate.openPullRequests} pull request still open`);
            nextActions.push({
                type: 'DECISION',
                priority: 'MEDIUM',
                title: 'Review open pull requests',
                description: 'Validate whether remaining open pull requests are release blockers or should be excluded from this release.',
                actionLabel: 'Open release hub',
                targetTab: 'releases',
                targetFocus: 'open-prs',
            });
        }

        const completionRate = candidate.totalWorkItems > 0
            ? Math.round((candidate.completedWorkItems / candidate.totalWorkItems) * 100)
            : 100;
        const coverageRate = candidate.totalTestCases > 0
            ? Math.round((candidate.approvedTestCases / candidate.totalTestCases) * 100)
            : 0;

        if (coverageRate < 70) {
            nextActions.push({
                type: 'COVERAGE',
                priority: 'MEDIUM',
                title: 'Increase approved test coverage',
                description: 'Raise approved coverage before release if current scope is under the target threshold.',
                actionLabel: 'Open traceability',
                targetTab: 'traceability',
                targetFocus: 'coverage-gaps',
            });
        }

        highlights.push(`Delivery completion is ${completionRate}%`);
        highlights.push(`Approved test coverage is ${coverageRate}%`);
        highlights.push(`Current readiness score is ${candidate.readinessScore ?? 0}%`);
        highlights.push(`Follow-up completion is ${candidate.completedFollowUpItems}/${candidate.completedFollowUpItems + candidate.openFollowUpItems}`);
        highlights.push(`Code evidence includes ${candidate.linkedCommits} commit(s) and ${candidate.mergedPullRequests} merged PR(s)`);

        let recommendation: ReleaseRecommendation = 'READY';
        if (candidate.criticalOpenBugs > 0 || candidate.failedRunItems > 0 || candidate.blockedRunItems > 0) {
            recommendation = 'NOT_READY';
        } else if (candidate.openRuns > 0 || candidate.conflictRunItems > 0 || coverageRate < 70 || completionRate < 85 || candidate.openFollowUpItems > 0 || candidate.openPullRequests > 0) {
            recommendation = 'CONDITIONAL';
        }

        const confidence = Math.max(0.35, Math.min(0.95, ((candidate.readinessScore ?? 0) / 100) * 0.8 + 0.15));

        const summary = recommendation === 'READY'
            ? 'AI review indicates the release candidate is broadly ready. Delivery progress and quality signals are aligned, and no blocking release risks were detected.'
            : recommendation === 'CONDITIONAL'
                ? 'AI review indicates a conditional release. Core signals are promising, but at least one remaining execution, coverage or conflict factor should be closed before final sign-off.'
                : 'AI review indicates the release is not ready. Blocking quality or delivery risks are still visible and should be resolved before release approval.';

        return {
            summary,
            recommendation,
            confidence: Number(confidence.toFixed(2)),
            topRisks,
            highlights,
            nextActions,
        };
    }

    async executeWithFallback<T>(primaryFn: () => Promise<T>, fallbackFn?: () => Promise<T>, fallbackValue?: T): Promise<T> {
        try {
            return await primaryFn();
        } catch (error) {
            console.warn('[AIOrchestratorService] Primary AI provider call failed, attempting resilient fallback...', error);
            if (fallbackFn) {
                try {
                    return await fallbackFn();
                } catch (fallbackError) {
                    console.error('[AIOrchestratorService] Secondary fallback AI provider call also failed.', fallbackError);
                }
            }
            if (fallbackValue !== undefined) {
                return fallbackValue;
            }
            throw error;
        }
    }
}

export const aiOrchestratorService = new AIOrchestratorService();
