import { useMemo } from "react"
import { Activity, ArrowRight, Bug, CalendarDays, CheckCircle2, FileText, ListTodo, PlayCircle, Rocket, Target, XCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"

import { VelocityChart } from "@/components/charts/VelocityChart"
import { dashboardService } from "@/services/dashboard.service"
import { appRoutes, type ProjectSection } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface ProjectDashboardProps {
    projectId: string
    projectKey: string
}

const storyStatuses = [
    { key: "TODO", color: "bg-slate-400" },
    { key: "IN_PROGRESS", color: "bg-blue-500" },
    { key: "DONE", color: "bg-emerald-500" },
]

const executionStatuses = [
    { key: "PASS", color: "bg-emerald-500", icon: CheckCircle2 },
    { key: "FAIL", color: "bg-red-500", icon: XCircle },
    { key: "BLOCKED", color: "bg-amber-500", icon: Target },
    { key: "SKIPPED", color: "bg-slate-400", icon: PlayCircle },
]

function ActionCard({
    title,
    value,
    detail,
    icon: Icon,
    tone = "primary",
    onClick,
}: {
    title: string
    value: string | number
    detail: string
    icon: typeof Rocket
    tone?: "primary" | "info" | "success" | "warning" | "error"
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex min-h-[126px] w-full flex-col justify-between rounded-xl border border-border/75 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
                <span className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    tone === "primary" && "bg-primary/10 text-primary",
                    tone === "info" && "bg-info/10 text-info",
                    tone === "success" && "bg-success/10 text-success",
                    tone === "warning" && "bg-warning/10 text-warning",
                    tone === "error" && "bg-error/10 text-error",
                )}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-xl font-semibold text-foreground">{value}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
                </div>
                <ArrowRight className="mb-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
        </button>
    )
}

function EmptyPanel({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/[0.03] px-5 text-center">
            <p className="text-sm text-muted-foreground">{message}</p>
            <button type="button" onClick={onAction} className="mt-3 text-xs font-semibold text-primary hover:underline">
                {actionLabel} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </button>
        </div>
    )
}

export function ProjectDashboard({ projectId, projectKey }: ProjectDashboardProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ["project-stats", projectId],
        queryFn: () => dashboardService.getProjectStats(projectId),
    })

    const goTo = (section: ProjectSection) => navigate(appRoutes.projectSection(projectKey, section))

    const executionTotal = useMemo(
        () => Object.values(stats?.execution?.byStatus || {}).reduce((total, count) => total + Number(count || 0), 0),
        [stats?.execution?.byStatus],
    )
    const storyTotal = stats?.stories?.total || 0
    const velocityData = stats?.velocityHistory ?? []

    if (isLoading) {
        return (
            <div className="space-y-5 animate-pulse">
                <div className="h-8 w-56 rounded-lg bg-primary/10" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[126px] rounded-xl bg-primary/10" />)}
                </div>
                <div className="grid gap-4 lg:grid-cols-2"><div className="h-72 rounded-xl bg-primary/10" /><div className="h-72 rounded-xl bg-primary/10" /></div>
            </div>
        )
    }

    if (error || !stats) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                <Rocket className="mb-4 h-10 w-10 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">{t("project_dashboard.load_error_title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("project_dashboard.load_error_desc")}</p>
            </div>
        )
    }

    const activeSprintDetail = stats.sprint
        ? `${stats.sprint.progress}% · ${stats.sprint.daysRemaining > 0 ? t("project_dashboard.active_sprint.days_left", { count: stats.sprint.daysRemaining }) : t("project_dashboard.active_sprint.overdue")}`
        : t("project_dashboard.no_active_sprint.title")
    const bugDetail = stats.bugs.openTotal > 0
        ? t("project_dashboard.operational.open_bug_detail", { count: stats.bugs.openTotal })
        : t("project_dashboard.operational.no_open_bugs")
    const runDetail = stats.testRuns.active > 0
        ? t("project_dashboard.operational.active_run_detail", { count: stats.testRuns.active })
        : t("project_dashboard.operational.no_active_runs")
    const testCaseDetail = t("project_dashboard.operational.test_case_detail", {
        active: stats.testCases.byStatus.ACTIVE || 0,
        draft: stats.testCases.byStatus.DRAFT || 0,
    })

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">{t("project_dashboard.operational.title")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("project_dashboard.operational.description")}</p>
                </div>
                <button type="button" onClick={() => goTo("quality")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    {t("project_dashboard.operational.open_quality")} <ArrowRight className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ActionCard
                    title={t("project_dashboard.active_sprint.title")}
                    value={stats.sprint?.name || t("project_dashboard.no_active_sprint.title")}
                    detail={activeSprintDetail}
                    icon={CalendarDays}
                    tone="primary"
                    onClick={() => goTo(stats.sprint ? "board" : "backlog")}
                />
                <ActionCard
                    title={t("project_dashboard.operational.open_bugs")}
                    value={stats.bugs.openTotal}
                    detail={bugDetail}
                    icon={Bug}
                    tone={stats.bugs.openTotal > 0 ? "error" : "success"}
                    onClick={() => goTo("bugs")}
                />
                <ActionCard
                    title={t("project_dashboard.active_runs_title")}
                    value={stats.testRuns.active}
                    detail={runDetail}
                    icon={Activity}
                    tone={stats.testRuns.active > 0 ? "warning" : "success"}
                    onClick={() => goTo("runs")}
                />
                <ActionCard
                    title={t("project_dashboard.total_test_cases")}
                    value={stats.testCases.total}
                    detail={testCaseDetail}
                    icon={FileText}
                    tone="info"
                    onClick={() => goTo("tests")}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold"><ListTodo className="h-4 w-4 text-primary" />{t("project_dashboard.stories_overview.title")}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{t("project_dashboard.operational.story_distribution")}</p>
                        </div>
                        <button type="button" onClick={() => goTo("backlog")} className="text-xs font-semibold text-primary hover:underline">{t("project_dashboard.operational.open_backlog")}</button>
                    </div>
                    {storyTotal > 0 ? (
                        <div className="space-y-3">
                            {storyStatuses.map(({ key, color }) => {
                                const count = stats.stories.byStatus[key] || 0
                                const percent = (count / storyTotal) * 100
                                return (
                                    <div key={key} className="space-y-1.5">
                                        <div className="flex justify-between text-xs"><span>{t(`project_dashboard.stories_overview.statuses.${key}`)}</span><span className="font-medium tabular-nums text-muted-foreground">{count} · {Math.round(percent)}%</span></div>
                                        <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${percent}%` }} /></div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <EmptyPanel message={t("project_dashboard.operational.no_stories")} actionLabel={t("project_dashboard.operational.open_backlog")} onAction={() => goTo("backlog")} />
                    )}
                </section>

                <section className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold"><PlayCircle className="h-4 w-4 text-primary" />{t("project_dashboard.execution_overview.title")}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{t("project_dashboard.execution_overview.description")}</p>
                        </div>
                        <button type="button" onClick={() => goTo("runs")} className="text-xs font-semibold text-primary hover:underline">{t("project_dashboard.operational.open_runs")}</button>
                    </div>
                    {executionTotal > 0 ? (
                        <>
                            <div className="mb-4 flex items-end justify-between gap-4">
                                <div><div className="text-3xl font-semibold">{stats.execution.passRate}%</div><div className="text-xs text-muted-foreground">{t("project_dashboard.pass_rate")}</div></div>
                                <div className="text-right text-xs text-muted-foreground">{t("project_dashboard.execution_overview.executed", { count: executionTotal })}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {executionStatuses.map(({ key, color, icon: Icon }) => (
                                    <div key={key} className="rounded-lg border border-border/70 bg-muted/[0.03] p-2.5">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", color)} /><Icon className="h-3.5 w-3.5" />{t(`project_dashboard.execution_overview.statuses.${key}`)}</div>
                                        <div className="mt-1 text-lg font-semibold tabular-nums">{stats.execution.byStatus[key] || 0}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <EmptyPanel message={t("project_dashboard.execution_overview.no_executions")} actionLabel={t("project_dashboard.operational.open_test_cases")} onAction={() => goTo("tests")} />
                    )}
                </section>
            </div>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold"><Rocket className="h-4 w-4 text-primary" />{t("project_dashboard.velocity_chart.title")}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{t("project_dashboard.velocity_chart.description")}</p>
                    </div>
                    <button type="button" onClick={() => goTo("backlog")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{t("project_dashboard.operational.open_sprint_history")} <ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
                {velocityData.length > 0 ? (
                    <VelocityChart data={velocityData} height={260} showHeader={false} />
                ) : (
                    <EmptyPanel message={t("project_dashboard.velocity_chart.no_data")} actionLabel={t("project_dashboard.no_active_sprint.go_to_backlog")} onAction={() => goTo("backlog")} />
                )}
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><Rocket className="h-4 w-4" /></div>
                    <div><h3 className="text-sm font-semibold">{t("project_dashboard.release_hub_title")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("project_dashboard.release_hub_desc")}</p></div>
                </div>
                <button type="button" onClick={() => goTo("releases")} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">{t("project_dashboard.open_release_hub")} <ArrowRight className="h-3.5 w-3.5" /></button>
            </section>
        </div>
    )
}
