import { useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock3, GitBranchPlus, Sparkles, ShieldAlert, TestTube2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { releaseService } from '@/services/release.service';
import type { ReleaseStatus } from '@/types/release';
import { PageHero, PageLoading, PageMetric, PageMetricGrid } from '@/components/layout/PageChrome';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CreateReleaseFollowUpDialog } from './components/CreateReleaseFollowUpDialog';
import { AddReleaseDecisionDialog } from './components/AddReleaseDecisionDialog';
import { PageBackButton } from '@/components/navigation/PageBackButton';
import { formatReleaseStatus, releaseStatusTone } from '@/lib/release-status';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { ReleaseGovernancePanel } from './components/ReleaseGovernancePanel';
import { appRoutes } from '@/lib/routes';

function buildActionHref(
    projectId: string,
    targetTab: 'backlog' | 'runs' | 'traceability' | 'releases',
    targetFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs',
    projectKey?: string,
) {
    return projectKey
        ? appRoutes.projectTab(projectKey, targetTab, { aiFocus: targetFocus })
        : `/projects/${projectId}?tab=${targetTab}&aiFocus=${targetFocus}`;
}

export default function ReleaseCandidateDetailsPage({ resourceId, resourceProjectId, resourceProjectKey }: { resourceId?: string; resourceProjectId?: string; resourceProjectKey?: string } = {}) {
    const { t } = useTranslation();
    const { projectId: routeProjectId, releaseId: routeReleaseId } = useParams<{ projectId: string; releaseId: string }>();
    const projectId = resourceProjectId ?? routeProjectId;
    const releaseId = resourceId ?? routeReleaseId;
    const queryClient = useQueryClient();

    const { data: releaseCandidate, isLoading, error } = useQuery({
        queryKey: ['release-candidate', projectId, releaseId],
        queryFn: () => releaseService.getById(projectId!, releaseId!),
        enabled: !!projectId && !!releaseId,
    });

    const { data: aiSummary } = useQuery({
        queryKey: ['release-candidate-ai-summary', projectId, releaseId],
        queryFn: () => releaseService.getAISummary(projectId!, releaseId!),
        enabled: !!projectId && !!releaseId,
    });

    const updateStatusMutation = useMutation({
        mutationFn: (newStatus: ReleaseStatus) => releaseService.updateStatus(projectId!, releaseId!, newStatus),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['release-candidate', projectId, releaseId] });
            toast.success(t('release.candidate_details.status_updated'));
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || t('release.candidate_details.status_update_error');
            toast.error(message);
        }
    });

    const translateStatus = (value: string) =>
        t(`release.common.statuses.${value}`, { defaultValue: formatReleaseStatus(value) });

    const translateDecisionType = useCallback((value: string) =>
        t(`release.common.decision_types.${value}`, { defaultValue: value }), [t]);

    const translateOutcome = (value: string) =>
        t(`release.common.outcomes.${value}`, { defaultValue: formatReleaseStatus(value) });

    const translatePriority = (value: string) =>
        t(`release.common.priorities.${value}`, { defaultValue: value });

    const completionRate = useMemo(() => {
        if (!releaseCandidate || releaseCandidate.totalWorkItems === 0) return 0;
        return Math.round((releaseCandidate.completedWorkItems / releaseCandidate.totalWorkItems) * 100);
    }, [releaseCandidate]);

    const coverageRate = useMemo(() => {
        if (!releaseCandidate || releaseCandidate.totalTestCases === 0) return 0;
        return Math.round((releaseCandidate.approvedTestCases / releaseCandidate.totalTestCases) * 100);
    }, [releaseCandidate]);

    const decisionCoverage = useMemo(() => {
        if (!releaseCandidate) {
            return {
                recorded: [] as Array<'SCOPE' | 'DELIVERY' | 'QUALITY'>,
                missing: [] as Array<'SCOPE' | 'DELIVERY' | 'QUALITY'>,
            };
        }

        const trackedTypes: Array<'SCOPE' | 'DELIVERY' | 'QUALITY'> = ['SCOPE', 'DELIVERY', 'QUALITY'];
        const recorded = trackedTypes.filter((type) => releaseCandidate.decisions?.some((decision) => decision.type === type)) as Array<'SCOPE' | 'DELIVERY' | 'QUALITY'>;
        const missing = trackedTypes.filter((type) => !recorded.includes(type));

        return { recorded, missing };
    }, [releaseCandidate]);

    const releaseChecklist = useMemo(() => {
        if (!releaseCandidate) {
            return [];
        }

        const missingTypes = decisionCoverage.missing.map((type) => translateDecisionType(type)).join(', ');

        return [
            {
                label: t('release.candidate_details.checklist.source_request_linked'),
                complete: Boolean(releaseCandidate.sourceRequest),
                detail: releaseCandidate.sourceRequest
                    ? releaseCandidate.sourceRequest.title
                    : t('release.candidate_details.checklist.no_originating_request'),
            },
            {
                label: t('release.candidate_details.checklist.core_decisions_recorded'),
                complete: decisionCoverage.missing.length === 0,
                detail: decisionCoverage.missing.length === 0
                    ? t('release.candidate_details.checklist.core_decisions_complete')
                    : t('release.candidate_details.checklist.missing', { types: missingTypes }),
            },
            {
                label: t('release.candidate_details.checklist.execution_evidence_linked'),
                complete: (releaseCandidate.runLinks?.length ?? 0) > 0,
                detail: (releaseCandidate.runLinks?.length ?? 0) > 0
                    ? t('release.candidate_details.checklist.linked_runs', { count: releaseCandidate.runLinks?.length ?? 0 })
                    : t('release.candidate_details.checklist.no_linked_runs_selected'),
            },
            {
                label: t('release.candidate_details.checklist.follow_up_debt_closed'),
                complete: (releaseCandidate.openFollowUpItems ?? 0) === 0,
                detail: (releaseCandidate.openFollowUpItems ?? 0) === 0
                    ? t('release.candidate_details.checklist.no_open_follow_ups')
                    : t('release.candidate_details.checklist.open_follow_ups', { count: releaseCandidate.openFollowUpItems ?? 0 }),
            },
            {
                label: t('release.candidate_details.checklist.coverage_evidence_available'),
                complete: releaseCandidate.totalTestCases > 0 && releaseCandidate.approvedTestCases > 0,
                detail: t('release.candidate_details.checklist.approved_test_cases', {
                    approved: releaseCandidate.approvedTestCases,
                    total: releaseCandidate.totalTestCases,
                }),
            },
        ];
    }, [decisionCoverage.missing, releaseCandidate, t, translateDecisionType]);

    const blockers = useMemo(() => {
        const checklistBlockers = releaseChecklist
            .filter((item) => !item.complete)
            .map((item) => item.detail);

        if ((releaseCandidate?.criticalOpenBugs ?? 0) > 0) {
            checklistBlockers.push(
                t('release.candidate_details.checklist.critical_bugs_still_open', {
                    count: releaseCandidate?.criticalOpenBugs ?? 0,
                })
            );
        }

        return checklistBlockers;
    }, [releaseChecklist, releaseCandidate?.criticalOpenBugs, t]);

    if (isLoading) {
        return <PageLoading hasHero metricCount={4} />;
    }

    if (error || !releaseCandidate) {
        return (
            <div className="page-shell">
                <div className="flex h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 text-center">
                    <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground/60" />
                    <h2 className="text-2xl font-semibold">{t('release.candidate_details.load_error_title')}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t('release.candidate_details.load_error_desc')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell page-stack">
            <PageHero
                eyebrow={t('release.candidate_details.eyebrow')}
                title={releaseCandidate?.title || t('release.candidate_details.loading_title')}
                description={releaseCandidate?.summary || t('release.candidate_details.fallback_description')}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button data-testid="release-candidate-status-btn" variant="outline" className={cn("gap-2", releaseStatusTone[releaseCandidate.status] || releaseStatusTone.DRAFT)}>
                                    {translateStatus(releaseCandidate.status)}
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {(['DRAFT', 'READY', 'RELEASED', 'CANCELLED'] as const).map((status) => (
                                    <DropdownMenuItem
                                        data-testid={`release-candidate-status-item-${status.toLowerCase()}`}
                                        key={status}
                                        onClick={() => updateStatusMutation.mutate(status)}
                                        disabled={status === releaseCandidate.status || updateStatusMutation.isPending}
                                    >
                                        {translateStatus(status)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <PageBackButton
                            fallbackTo={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "releases") : `/projects/${projectId}?tab=releases`}
                            label={t('release.candidate_details.back_to_hub')}
                        />
                    </div>
                }
            >
                <PageMetricGrid>
                    <PageMetric
                        label={t('release.candidate_details.metrics.readiness_score')}
                        value={`${releaseCandidate.readinessScore ?? 0}%`}
                        icon={CheckCircle2}
                        tone="primary"
                    />
                    <PageMetric
                        label={t('release.candidate_details.metrics.delivery_completion')}
                        value={`${completionRate}%`}
                        hint={t('release.candidate_details.metrics.delivery_items', {
                            completed: releaseCandidate.completedWorkItems,
                            total: releaseCandidate.totalWorkItems,
                        })}
                        icon={GitBranchPlus}
                    />
                    <PageMetric
                        label={t('release.candidate_details.metrics.approved_coverage')}
                        value={`${coverageRate}%`}
                        hint={t('release.candidate_details.metrics.approved_cases', {
                            approved: releaseCandidate.approvedTestCases,
                            total: releaseCandidate.totalTestCases,
                        })}
                        icon={TestTube2}
                    />
                    <PageMetric
                        label={t('release.candidate_details.metrics.open_critical_bugs')}
                        value={releaseCandidate.criticalOpenBugs}
                        hint={t('release.candidate_details.metrics.open_bugs', { count: releaseCandidate.openBugs })}
                        icon={AlertTriangle}
                        tone={releaseCandidate.criticalOpenBugs > 0 ? 'danger' : 'success'}
                    />
                    <PageMetric
                        label={t('release.candidate_details.metrics.open_follow_ups')}
                        value={releaseCandidate.openFollowUpItems ?? 0}
                        hint={t('release.candidate_details.metrics.closed', { count: releaseCandidate.completedFollowUpItems ?? 0 })}
                        icon={Clock3}
                        tone={(releaseCandidate.openFollowUpItems ?? 0) > 0 ? 'warning' : 'success'}
                    />
                </PageMetricGrid>
            </PageHero>

            <ReleaseGovernancePanel projectId={projectId!} releaseId={releaseCandidate.id} />

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('release.candidate_details.sections.release_health')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>{t('release.candidate_details.sections.delivery_progress')}</span>
                                <span>{completionRate}%</span>
                            </div>
                            <Progress value={completionRate} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>{t('release.candidate_details.sections.quality_coverage')}</span>
                                <span>{coverageRate}%</span>
                            </div>
                            <Progress value={coverageRate} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <div className="text-sm font-medium">{t('release.candidate_details.sections.run_risk')}</div>
                                <div className="mt-2 text-2xl font-bold">{releaseCandidate.failedRunItems + releaseCandidate.blockedRunItems + releaseCandidate.conflictRunItems}</div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('release.candidate_details.sections.run_risk_summary', {
                                        fail: releaseCandidate.failedRunItems,
                                        block: releaseCandidate.blockedRunItems,
                                        conflict: releaseCandidate.conflictRunItems,
                                    })}
                                </p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <div className="text-sm font-medium">{t('release.candidate_details.sections.open_runs')}</div>
                                <div className="mt-2 text-2xl font-bold">{releaseCandidate.openRuns}</div>
                                <p className="mt-1 text-xs text-muted-foreground">{t('release.candidate_details.sections.open_runs_desc')}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4 sm:col-span-2">
                                <div className="text-sm font-medium">{t('release.candidate_details.sections.code_evidence')}</div>
                                <div className="mt-2 text-2xl font-bold">{releaseCandidate.linkedCommits ?? 0}</div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('release.candidate_details.sections.code_evidence_summary', {
                                        open: releaseCandidate.openPullRequests ?? 0,
                                        merged: releaseCandidate.mergedPullRequests ?? 0,
                                    })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('release.candidate_details.sections.linked_runs')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {releaseCandidate.runLinks?.length ? (
                            releaseCandidate.runLinks.map((link) => (
                                <div key={link.testRun.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                                    <div>
                                        <div className="font-medium">{link.testRun.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('release.candidate_details.sections.run_id', { id: link.testRun.id })}
                                        </div>
                                    </div>
                                    <Badge variant="secondary">{link.testRun.status}</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5">
                                <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.no_linked_runs')}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <Link
                                        to={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "runs", { aiFocus: "open-runs" }) : `/projects/${projectId}?tab=runs&aiFocus=open-runs`}
                                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                    >
                                        {t('release.candidate_details.sections.open_run_workspace')}
                                    </Link>
                                    {releaseCandidate.sourceRequest ? (
                                        <Link
                                            to={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "ai", { requestId: releaseCandidate.sourceRequest.id }) : `/projects/${projectId}?tab=ai-analyst&requestId=${releaseCandidate.sourceRequest.id}`}
                                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                        >
                                            {t('release.candidate_details.sections.open_source_request')}
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {releaseCandidate.sourceRequest ? (
                <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('release.candidate_details.sections.source_request')}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{releaseCandidate.sourceRequest.title}</p>
                                <Badge variant="outline">{releaseCandidate.sourceRequest.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('release.candidate_details.sections.source_request_desc')}
                            </p>
                        </div>
                        <Link
                            to={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "ai", { requestId: releaseCandidate.sourceRequest.id }) : `/projects/${projectId}?tab=ai-analyst&requestId=${releaseCandidate.sourceRequest.id}`}
                            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
                        >
                            {t('release.candidate_details.sections.open_request_context')}
                        </Link>
                    </CardContent>
                </Card>
            ) : null}

            <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardTitle>{t('release.candidate_details.sections.decision_coverage')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {(['SCOPE', 'DELIVERY', 'QUALITY'] as const).map((type) => (
                            <Badge
                                key={type}
                                variant="outline"
                                className={decisionCoverage.recorded.includes(type)
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700'}
                            >
                                {translateDecisionType(type)}{' '}
                                {decisionCoverage.recorded.includes(type)
                                    ? t('release.candidate_details.sections.recorded')
                                    : t('release.candidate_details.sections.missing')}
                            </Badge>
                        ))}
                    </div>
                    {decisionCoverage.missing.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {t('release.candidate_details.sections.decision_missing_desc')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {decisionCoverage.missing.map((type) => (
                                    <AddReleaseDecisionDialog
                                        key={type}
                                        projectId={projectId!}
                                        releaseId={releaseCandidate.id}
                                        decisionType={type}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.decision_complete_desc')}</p>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('release.candidate_details.sections.release_checklist')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {releaseChecklist.map((item) => (
                            <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={item.complete
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700'}
                                >
                                    {item.complete
                                        ? t('release.candidate_details.sections.complete')
                                        : t('release.candidate_details.sections.pending')}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('release.candidate_details.sections.current_blockers')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {blockers.length > 0 ? (
                            blockers.map((blocker) => (
                                <div key={blocker} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                                    {blocker}
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
                                {t('release.candidate_details.sections.no_blockers')}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t('release.candidate_details.sections.ai_summary')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {aiSummary ? (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="outline" className={releaseStatusTone[aiSummary.recommendation] || releaseStatusTone.DRAFT}>
                                    {translateStatus(aiSummary.recommendation)}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                    {t('release.candidate_details.sections.confidence')}: {Math.round(aiSummary.confidence * 100)}%
                                </span>
                            </div>
                            <p className="text-sm leading-6 text-foreground">{aiSummary.summary}</p>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">{t('release.candidate_details.sections.top_risks')}</h4>
                                    {aiSummary.topRisks.length > 0 ? (
                                        <ul className="space-y-2 text-sm text-muted-foreground">
                                            {aiSummary.topRisks.map((risk) => (
                                                <li key={risk} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                                                    {risk}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.no_risks')}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">{t('release.candidate_details.sections.highlights')}</h4>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        {aiSummary.highlights.map((item) => (
                                            <li key={item} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold">{t('release.candidate_details.sections.recommended_actions')}</h4>
                                {aiSummary.nextActions.length > 0 ? (
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {aiSummary.nextActions.map((action) => (
                                            <div key={`${action.type}-${action.title}`} className="rounded-lg border border-border/60 bg-background/70 px-4 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-medium">{action.title}</div>
                                                    <Badge variant="outline">{translatePriority(action.priority)}</Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <CreateReleaseFollowUpDialog
                                                        projectId={projectId!}
                                                        releaseId={releaseCandidate.id}
                                                        releaseTitle={releaseCandidate.title}
                                                        action={action}
                                                    />
                                                    <Link
                                                        to={buildActionHref(projectId!, action.targetTab, action.targetFocus, resourceProjectKey)}
                                                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                                    >
                                                        {action.actionLabel}
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.no_actions')}</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.summary_unavailable')}</p>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardTitle>{t('release.candidate_details.sections.decision_history')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {releaseCandidate.decisions?.length ? (
                        releaseCandidate.decisions.map((decision) => (
                            <div key={decision.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-4 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{translateDecisionType(decision.type)}</Badge>
                                        <Badge variant="secondary">{translateOutcome(decision.outcome)}</Badge>
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {decision.rationale || t('release.candidate_details.sections.no_rationale')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {decision.author
                                            ? `${decision.author.firstName} ${decision.author.lastName}`
                                            : t('release.common.unknown_author')}
                                    </p>
                                </div>
                                <div className="min-w-[110px] rounded-xl border border-border/60 bg-card px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {t('release.candidate_details.sections.confidence_label')}
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {decision.confidence != null
                                            ? `${Math.round(decision.confidence * 100)}%`
                                            : t('release.common.not_available')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.no_decisions')}</p>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardTitle>{t('release.candidate_details.sections.generated_follow_ups')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {releaseCandidate.followUps?.length ? (
                        releaseCandidate.followUps.map((followUp) => (
                            <div key={followUp.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-4 md:flex-row md:items-center md:justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{followUp.workItem.itemType}</Badge>
                                        <Badge variant="secondary">{followUp.workItem.status}</Badge>
                                    </div>
                                    <p className="text-sm font-medium text-foreground">{followUp.workItem.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('release.candidate_details.sections.source', {
                                            type: followUp.sourceActionType,
                                            focus: followUp.sourceActionFocus,
                                        })}
                                    </p>
                                    <Link
                                        to={
                                            resourceProjectKey
                                                ? appRoutes.projectSection(resourceProjectKey, "backlog", followUp.workItem.itemType === "STORY"
                                                    ? { issue: followUp.workItem.id }
                                                    : { aiFocus: followUp.sourceActionFocus })
                                                : followUp.workItem.itemType === 'STORY'
                                                    ? `/projects/${projectId}?tab=backlog&issue=${followUp.workItem.id}`
                                                    : `/projects/${projectId}?tab=backlog&aiFocus=${followUp.sourceActionFocus}`
                                        }
                                        className="inline-flex text-xs font-medium text-primary hover:underline"
                                    >
                                        {t('release.candidate_details.sections.open_in_workspace')}
                                    </Link>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                    <div>
                                        {followUp.createdBy
                                            ? `${followUp.createdBy.firstName} ${followUp.createdBy.lastName}`
                                            : t('release.common.unknown_author')}
                                    </div>
                                    <div>
                                        {followUp.workItem.priority
                                            ? translatePriority(followUp.workItem.priority)
                                            : t('release.common.no_priority')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('release.candidate_details.sections.no_follow_ups_generated')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
