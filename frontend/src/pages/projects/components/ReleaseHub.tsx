import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, Rocket, ShieldAlert, TestTube2 } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { releaseService } from '@/services/release.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { ReleaseCandidate } from '@/types/release';
import { CreateReleaseCandidateDialog } from './CreateReleaseCandidateDialog';
import { AddReleaseDecisionDialog } from './AddReleaseDecisionDialog';
import { formatReleaseStatus, releaseStatusTone } from '@/lib/release-status';
import { appRoutes } from '@/lib/routes';

function ReleaseScore({ candidate }: { candidate: ReleaseCandidate }) {
    const { t } = useTranslation();
    const score = candidate.readinessScore ?? 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{t('release.hub.readiness_score')}</span>
                <span>{score}%</span>
            </div>
            <Progress value={score} />
        </div>
    );
}

export function ReleaseHub({ resourceId }: { resourceId?: string } = {}) {
    const { t } = useTranslation();
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = resourceId ?? routeProjectId;
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const aiFocus = searchParams.get('aiFocus');
    const sourceRequestId = searchParams.get('sourceRequestId');

    const { data, isLoading, error } = useQuery({
        queryKey: ['release-candidates', projectId],
        queryFn: () => releaseService.getAll(projectId!),
        enabled: !!projectId,
    });

    const translateStatus = (status: string) =>
        t(`release.common.statuses.${status}`, { defaultValue: formatReleaseStatus(status) });

    const translateDecisionType = (type: string) =>
        t(`release.common.decision_types.${type}`, { defaultValue: type });

    const translateOutcome = (outcome: string) =>
        t(`release.common.outcomes.${outcome}`, { defaultValue: formatReleaseStatus(outcome) });

    if (isLoading) {
        return (
            <div className="grid gap-4 lg:grid-cols-2">
                {[0, 1].map((item) => (
                    <div key={item} className="h-56 animate-pulse rounded-2xl border border-border/70 bg-muted/20" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
                <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
                <h3 className="text-lg font-semibold">{t('release.hub.load_error_title')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t('release.hub.load_error_desc')}</p>
            </div>
        );
    }

    const candidates = data || [];
    let filteredCandidates = candidates;
    if (sourceRequestId) {
        filteredCandidates = filteredCandidates.filter((candidate) => candidate.sourceRequest?.id === sourceRequestId);
    }
    if (aiFocus === 'follow-up-items') {
        filteredCandidates = filteredCandidates.filter((candidate) => (candidate.openFollowUpItems ?? 0) > 0);
    }
    if (aiFocus === 'open-prs') {
        filteredCandidates = filteredCandidates.filter((candidate) => (candidate.openPullRequests ?? 0) > 0);
    }

    const sourceRequestTitle = filteredCandidates[0]?.sourceRequest?.title || candidates.find(
        (candidate) => candidate.sourceRequest?.id === sourceRequestId
    )?.sourceRequest?.title;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold">{t('release.hub.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('release.hub.description')}</p>
                    {aiFocus === 'follow-up-items' ? (
                        <p className="text-xs font-medium text-primary">{t('release.hub.ai_focus_follow_up_items')}</p>
                    ) : null}
                    {aiFocus === 'open-prs' ? (
                        <p className="text-xs font-medium text-primary">{t('release.hub.ai_focus_open_prs')}</p>
                    ) : null}
                    {sourceRequestId ? (
                        <p className="text-xs font-medium text-primary">
                            {t('release.hub.request_focus', {
                                title: sourceRequestTitle || t('release.hub.linked_request_releases'),
                            })}
                        </p>
                    ) : null}
                </div>
                {projectId ? <CreateReleaseCandidateDialog projectId={projectId} /> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/70 bg-card/95">
                    <CardHeader className="pb-2">
                        <CardDescription>{t('release.hub.total_candidates')}</CardDescription>
                        <CardTitle className="text-3xl">{filteredCandidates.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-border/70 bg-card/95">
                    <CardHeader className="pb-2">
                        <CardDescription>{t('release.hub.ready_for_release')}</CardDescription>
                        <CardTitle className="text-3xl text-emerald-600">{filteredCandidates.filter((item) => item.status === 'READY').length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-border/70 bg-card/95">
                    <CardHeader className="pb-2">
                        <CardDescription>{t('release.hub.released_candidates')}</CardDescription>
                        <CardTitle className="text-3xl text-sky-600">{filteredCandidates.filter((item) => item.status === 'RELEASED').length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-border/70 bg-card/95">
                    <CardHeader className="pb-2">
                        <CardDescription>{t('release.hub.cancelled_candidates')}</CardDescription>
                        <CardTitle className="text-3xl text-rose-600">{filteredCandidates.filter((item) => item.status === 'CANCELLED').length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {filteredCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-10 text-center">
                    <Rocket className="mx-auto mb-4 h-12 w-12 text-primary/60" />
                    <h3 className="text-xl font-semibold">{t('release.hub.empty_title')}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t('release.hub.empty_description')}</p>
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {filteredCandidates.map((candidate) => (
                        <Card key={candidate.id} className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
                            <CardHeader className="gap-3 border-b border-border/70 bg-muted/10">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-xl">{candidate.title}</CardTitle>
                                        <CardDescription className="mt-1">
                                            {candidate.summary || t('release.hub.summary_placeholder')}
                                        </CardDescription>
                                        {candidate.sourceRequest ? (
                                            <p className="mt-2 text-xs font-medium text-primary">
                                                {t('release.hub.source_request', { title: candidate.sourceRequest.title })}
                                            </p>
                                        ) : null}
                                    </div>
                                    <Badge variant="outline" className={releaseStatusTone[candidate.status] || releaseStatusTone.DRAFT}>
                                        {translateStatus(candidate.status)}
                                    </Badge>
                                </div>
                                <ReleaseScore candidate={candidate} />
                            </CardHeader>
                            <CardContent className="space-y-5 p-6">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            {t('release.hub.delivery_progress')}
                                        </div>
                                        <div className="text-2xl font-bold">
                                            {candidate.completedWorkItems}/{candidate.totalWorkItems}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{t('release.hub.completed_work_items')}</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                            <TestTube2 className="h-4 w-4 text-sky-600" />
                                            {t('release.hub.approved_test_scope')}
                                        </div>
                                        <div className="text-2xl font-bold">
                                            {candidate.approvedTestCases}/{candidate.totalTestCases}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{t('release.hub.approved_test_scope_desc')}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <AlertTriangle className="h-4 w-4 text-red-600" />
                                            {t('release.hub.open_bugs')}
                                        </div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.openBugs}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">{t('release.hub.critical', { count: candidate.criticalOpenBugs })}</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Clock3 className="h-4 w-4 text-amber-600" />
                                            {t('release.hub.open_runs')}
                                        </div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.openRuns}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {t('release.hub.run_fail_block', {
                                                fail: candidate.failedRunItems,
                                                block: candidate.blockedRunItems,
                                            })}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <ShieldAlert className="h-4 w-4 text-warning" />
                                            {t('release.hub.decision_count')}
                                        </div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.decisions?.length || 0}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {t('release.hub.conflict_follow_ups', {
                                                conflicts: candidate.conflictRunItems,
                                                followUps: candidate.openFollowUpItems ?? 0,
                                            })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="text-sm font-medium">{t('release.hub.linked_commits')}</div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.linkedCommits ?? 0}</div>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="text-sm font-medium">{t('release.hub.open_prs')}</div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.openPullRequests ?? 0}</div>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                        <div className="text-sm font-medium">{t('release.hub.merged_prs')}</div>
                                        <div className="mt-2 text-2xl font-bold">{candidate.mergedPullRequests ?? 0}</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">{t('release.hub.latest_decisions')}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <AddReleaseDecisionDialog projectId={projectId!} releaseId={candidate.id} decisionType="SCOPE" />
                                        <AddReleaseDecisionDialog projectId={projectId!} releaseId={candidate.id} decisionType="DELIVERY" />
                                        <AddReleaseDecisionDialog projectId={projectId!} releaseId={candidate.id} decisionType="QUALITY" />
                                        <Link
                                            to={appRoutes.resource(candidate.key)}
                                            state={{ from: `${location.pathname}${location.search}` }}
                                            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent"
                                        >
                                            {t('release.hub.view_details')}
                                        </Link>
                                    </div>
                                    {candidate.decisions?.length ? (
                                        <div className="space-y-2">
                                            {candidate.decisions.slice(0, 3).map((decision) => (
                                                <div key={decision.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                                                    <div>
                                                        <div className="font-medium">{translateDecisionType(decision.type)}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {decision.author
                                                                ? `${decision.author.firstName} ${decision.author.lastName}`
                                                                : t('release.common.unknown')}
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary">{translateOutcome(decision.outcome)}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('release.hub.no_decisions')}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ReleaseHub;
