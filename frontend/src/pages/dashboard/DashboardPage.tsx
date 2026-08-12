import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
    FolderKanban,
    Users,
    BarChart3,
    ArrowRight,
    Kanban,
    CheckCircle2,
    Info,
    Sparkles,
    ShieldAlert,
    Lightbulb,
    ListTodo,
    PlayCircle,
    PanelsTopLeft,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/authStore";
import { queryKeys } from "@/lib/queryKeys"
import { dashboardService, type MetricsTimeframe } from "@/services/dashboard.service"
import { useNavigate } from "react-router-dom"
import { ZombieProjectWarning } from "./components/ZombieProjectWarning"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { TestExecutionTrend } from "./components/TestExecutionTrend"
import { RecentActivityList } from "./components/RecentActivityList"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHero, PageLoading, PageMetricGrid, PageMetric } from "@/components/layout/PageChrome"
import { PageQueryError } from "@/components/layout/PageQueryError"
import { appRoutes } from "@/lib/routes"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

type DashboardCreateButtonProps = {
    canCreateProject: boolean
    label: string
    tooltip: string
    onCreate: () => void
}

function DashboardCreateButton({ canCreateProject, label, tooltip, onCreate }: DashboardCreateButtonProps) {
    if (canCreateProject) {
        return (
            <Button
                data-testid="create-project-button"
                className="bg-primary text-primary-foreground"
                onClick={onCreate}
            >
                {label}
            </Button>
        )
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0}>
                        <Button disabled size="sm">{label}</Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

type DashboardMetricLabelProps = {
    label: string
    tooltip: string
}

function DashboardMetricLabel({ label, tooltip }: DashboardMetricLabelProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex cursor-help items-center gap-1.5">
                        <p className="text-xs font-semibold uppercase leading-none text-muted-foreground">{label}</p>
                        <Info className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-[240px] text-xs">{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}



export default function DashboardPage() {
    const user = useAuthStore((state) => state.user)
    const { t } = useTranslation()
    const canCreateProject = user?.role === 'TEAM_LEADER' || user?.role === 'ADMIN'
    const isAdminOrLeader = canCreateProject
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")
    const [timeframe, setTimeframe] = useState<MetricsTimeframe>("WEEK")
    const [performanceSortBy, setPerformanceSortBy] = useState("name")
    const [performanceSortOrder, setPerformanceSortOrder] = useState<"asc" | "desc">("asc")

    const { data: workspaceOverview, isLoading: isOverviewLoading, isError: isOverviewError, refetch: refetchOverview } = useQuery({
        queryKey: queryKeys.dashboard.overview,
        queryFn: dashboardService.getWorkspaceOverview,
    })
    const { data: myWork } = useQuery({
        queryKey: queryKeys.dashboard.myWork,
        queryFn: dashboardService.getMyWorkQueue,
    })

    const projects = workspaceOverview?.projects ?? []
    const defaultProjectId = projects[0]?.id || ""
    const activeProjectId = selectedProjectId || defaultProjectId

    // Calculate KPIs
    const totalProjects = workspaceOverview?.totals.projects || 0
    const totalSuites = workspaceOverview?.totals.suites || 0
    const totalRuns = workspaceOverview?.totals.testRuns || 0
    const totalMembers = workspaceOverview?.totals.members || 0

    const { data: managementMetrics } = useQuery({
        queryKey: queryKeys.dashboard.management(activeProjectId, timeframe),
        queryFn: () => dashboardService.getManagementMetrics(activeProjectId, timeframe),
        enabled: isAdminOrLeader && !!activeProjectId,
    })

    const { data: performanceMetrics } = useQuery({
        queryKey: queryKeys.dashboard.performance(activeProjectId, timeframe),
        queryFn: () => dashboardService.getPerformanceMetrics(activeProjectId, timeframe),
        enabled: isAdminOrLeader && !!activeProjectId,
    })

    const sortedPerformanceMetrics = useMemo(() => {
        const rows = performanceMetrics || []
        return [...rows].sort((left, right) => {
            const valueFor = (row: typeof rows[number]) => {
                if (performanceSortBy === "velocity") return row.velocity
                if (performanceSortBy === "passRate") return row.passRate
                if (performanceSortBy === "failRate") return row.failRate
                if (performanceSortBy === "retestRate") return row.retestRate
                if (performanceSortBy === "avgDurationMs") return row.avgDurationMs || 0
                return row.name
            }
            const leftValue = valueFor(left)
            const rightValue = valueFor(right)
            const result = typeof leftValue === "number" && typeof rightValue === "number"
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue))
            return performanceSortOrder === "asc" ? result : -result
        })
    }, [performanceMetrics, performanceSortBy, performanceSortOrder])

    const handlePerformanceSort = (field: string) => {
        if (performanceSortBy === field) {
            setPerformanceSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setPerformanceSortBy(field)
        setPerformanceSortOrder("asc")
    }

    const navigate = useNavigate()

    if (isOverviewLoading) return <PageLoading hasHero metricCount={4} />
    if (isOverviewError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void refetchOverview()} /></div>
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="page-shell page-stack"
        >
            <ZombieProjectWarning />

            <PageHero
                eyebrow={t('common.workspace')}
                title={t('common.dashboard')}
                description={t('dashboard.welcome', { name: user?.firstName })}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => navigate(appRoutes.dashboards())}>
                            <PanelsTopLeft className="mr-2 h-4 w-4" />
                            {t('dashboard.open_studio')}
                        </Button>
                        <DashboardCreateButton
                            canCreateProject={canCreateProject}
                            label={t('dashboard.create_project')}
                            tooltip={t('dashboard.create_project_tooltip')}
                            onCreate={() => {
                                sessionStorage.setItem('openCreateProjectDialog', 'true')
                                navigate('/projects')
                            }}
                        />
                    </div>
                }
            >
                <PageMetricGrid>
                    <PageMetric
                        label={t('dashboard.total_projects')}
                        value={totalProjects}
                        icon={FolderKanban}
                        tone="primary"
                    />
                    <PageMetric
                        label={t('dashboard.work_items')}
                        value={totalSuites}
                        icon={Kanban}
                        tone="neutral"
                    />
                    <PageMetric
                        label={t('dashboard.active_runs')}
                        value={totalRuns}
                        icon={CheckCircle2}
                        tone="success"
                    />
                    <PageMetric
                        label={t('dashboard.team_members')}
                        value={totalMembers}
                        icon={Users}
                        tone="warning"
                    />
                </PageMetricGrid>
            </PageHero>

            <section className="enterprise-card !p-0 overflow-hidden" aria-labelledby="my-work-heading">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-6 py-4">
                    <div>
                        <h2 id="my-work-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <ListTodo className="h-4 w-4 text-primary" />
                            {t("dashboard.my_work.title", "İş kuyruğum")}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.my_work.description", "Sana atanmış açık işler ve tamamlanmayı bekleyen testler.")}</p>
                    </div>
                    <Badge variant="secondary">{(myWork?.workItems.length ?? 0) + (myWork?.testItems.length ?? 0)}</Badge>
                </div>
                <div className="grid divide-y divide-border/50 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    <div className="p-4">
                        <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("dashboard.my_work.assigned_items", "Atanmış işler")}</p>
                        <div className="space-y-1">
                            {(myWork?.workItems ?? []).slice(0, 5).map((item) => (
                                <button key={item.id} onClick={() => navigate(appRoutes.resource(item.key))} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted/60">
                                    <span className="min-w-20 font-mono text-xs font-semibold text-primary">{item.key}</span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                                    <Badge variant="outline" className="max-w-28 truncate text-[9px]">{item.status.replaceAll("_", " ")}</Badge>
                                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                                </button>
                            ))}
                            {(myWork?.workItems.length ?? 0) === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">{t("dashboard.my_work.no_items", "Sana atanmış açık iş bulunmuyor.")}</p>}
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("dashboard.my_work.assigned_tests", "Bekleyen testler")}</p>
                        <div className="space-y-1">
                            {(myWork?.testItems ?? []).slice(0, 5).map((item) => (
                                <button key={item.id} onClick={() => navigate(appRoutes.resource(item.testRun.key))} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted/60">
                                    <PlayCircle className="h-4 w-4 shrink-0 text-cyan-600" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.caseTitle || item.testRun.title}</span>
                                    <Badge variant="outline" className="text-[9px]">{item.finalStatus}</Badge>
                                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                                </button>
                            ))}
                            {(myWork?.testItems.length ?? 0) === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">{t("dashboard.my_work.no_tests", "Tamamlanmayı bekleyen atanmış test bulunmuyor.")}</p>}
                        </div>
                    </div>
                </div>
            </section>

            {projects.length > 0 && (
                <section className="enterprise-card !p-0 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-4">
                        <h3 className="text-sm font-semibold text-foreground">{t('common.projects')}</h3>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-primary hover:bg-primary/10" onClick={() => navigate('/projects')}>
                            {t('dashboard.view_all')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="p-6">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {projects.slice(0, 6).map((p) => (
                                <button
                                    key={p.id}
                                    data-testid={`project-card-${p.key}`}
                                    onClick={() => navigate(appRoutes.project(p.key))}
                                    className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-border/70 bg-card p-4 text-left interactive-surface"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                                        <FolderKanban className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground/90 tracking-tight">{p.name}</p>
                                        <p className="mt-1 text-xs font-normal text-muted-foreground">
                                            {t('dashboard.project_stats', {
                                                suites: p._count?.suites || 0,
                                                runs: p._count?.testRuns || 0,
                                            })}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-all -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="grid gap-6 lg:grid-cols-7">
                <div className="enterprise-card !p-0 overflow-hidden lg:col-span-4">
                    <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <BarChart3 className="h-4 w-4 text-primary/70" />
                            {t('dashboard.execution_trend')}
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="min-w-0 h-[300px] sm:h-[350px]">
                            <TestExecutionTrend />
                        </div>
                    </div>
                </div>

                <div className="enterprise-card !p-0 overflow-hidden lg:col-span-3">
                    <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                        <h3 className="text-sm font-semibold text-foreground">{t('dashboard.recent_activity')}</h3>
                    </div>
                    <div className="p-6">
                        <RecentActivityList />
                    </div>
                </div>
            </section>

            {isAdminOrLeader && (
                <section className="space-y-6">
                    <div className="enterprise-card !p-0 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border/50 bg-muted/30 px-6 py-5">
                            <div>
                                <h2 className="text-base font-semibold text-foreground">{t('dashboard.kpi.title')}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.kpi.description')}</p>
                            </div>
                            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                                <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
                                    <SelectTrigger className="h-9 w-full text-[13px] font-medium sm:w-[240px]">
                                        <SelectValue placeholder={t('dashboard.kpi.select_project')} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50">
                                        {projects.map((p) => (
                                            <SelectItem key={p.id} value={p.id} className="text-[12px] font-medium">
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={timeframe} onValueChange={(v: MetricsTimeframe) => setTimeframe(v)}>
                                    <SelectTrigger className="h-9 w-full text-[13px] font-medium sm:w-[160px]">
                                        <SelectValue placeholder={t('dashboard.kpi.timeframe')} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/50">
                                        <SelectItem value="WEEK" className="text-[12px] font-medium">{t('dashboard.kpi.timeframe_week')}</SelectItem>
                                        <SelectItem value="SPRINT" className="text-[12px] font-medium">{t('dashboard.kpi.timeframe_sprint')}</SelectItem>
                                        <SelectItem value="MONTH" className="text-[12px] font-medium">{t('dashboard.kpi.timeframe_month')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-6">
                            {!activeProjectId ? (
                                <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">{t('dashboard.kpi.no_project')}</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* AI Recommendations Panel */}
                                    {managementMetrics?.nextActions && managementMetrics.nextActions.length > 0 && (
                                        <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-5 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                                                    <Sparkles className="h-4.5 w-4.5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">{t('dashboard.kpi.ai_guidance_title')}</h3>
                                                    <p className="text-xs text-muted-foreground">{t('dashboard.kpi.ai_guidance_desc')}</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                {managementMetrics.nextActions.map((action, idx) => (
                                                    <div key={idx} className="group flex gap-3 rounded-lg border border-border/70 bg-background p-3.5 interactive-surface">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                                            action.type.includes('ALERT') ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                                                        }`}>
                                                            {action.type.includes('ALERT') ? <ShieldAlert className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/40">{action.metric}</span>
                                                                <Badge variant="outline" className={`text-[8px] h-3.5 px-1 border-none font-bold ${
                                                                    action.type.includes('ALERT') ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'
                                                                }`}>
                                                                    {action.type.includes('ALERT') ? t('dashboard.kpi.risk_badge') : t('dashboard.kpi.insight_badge')}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs font-medium leading-snug text-foreground/85">
                                                                {action.suggestion}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border border-border/40 bg-background/50 p-5 shadow-sm transition-all hover:border-primary/20">
                                            <div className="mb-3">
                                                <DashboardMetricLabel
                                                    label={t('dashboard.kpi.qgi')}
                                                    tooltip={t('dashboard.kpi.qgi_tooltip')}
                                                />
                                            </div>
                                            <p className="text-3xl font-black text-foreground/90 tabular-nums">{managementMetrics?.qgi?.toFixed(1) ?? '-'}</p>
                                        </div>
                                        <div className="rounded-xl border border-border/40 bg-background/50 p-5 shadow-sm transition-all hover:border-primary/20">
                                            <div className="mb-3">
                                                <DashboardMetricLabel
                                                    label={t('dashboard.kpi.velocity')}
                                                    tooltip={t('dashboard.kpi.velocity_tooltip')}
                                                />
                                            </div>
                                            <p className="text-3xl font-black text-foreground/90 tabular-nums">{managementMetrics?.velocity?.toFixed(1) ?? '-'}</p>
                                        </div>
                                        <div className="rounded-xl border border-border/40 bg-background/50 p-5 shadow-sm transition-all hover:border-primary/20">
                                            <div className="mb-3">
                                                <DashboardMetricLabel
                                                    label={t('dashboard.kpi.fail_rate')}
                                                    tooltip={t('dashboard.kpi.fail_rate_tooltip')}
                                                />
                                            </div>
                                            <p className="text-3xl font-black text-rose-600/80 tabular-nums">{managementMetrics ? `${managementMetrics.failRate.toFixed(1)}%` : '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-background/50 p-5 shadow-sm transition-all hover:border-primary/20">
                                            <div className="mb-3">
                                                <DashboardMetricLabel
                                                    label={t('dashboard.kpi.defect_trend')}
                                                    tooltip={t('dashboard.kpi.defect_trend_tooltip')}
                                                />
                                            </div>
                                            <p className="text-3xl font-black text-amber-600/80 tabular-nums">{managementMetrics ? `${managementMetrics.defectTrend.toFixed(1)}%` : '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {activeProjectId && (
                        <div className="enterprise-card !p-0 overflow-hidden">
                            <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{t('dashboard.kpi.team_performance')}</h3>
                            </div>
                            <div className="p-6">
                                <div className="rounded-xl border border-border/30 bg-background/50 overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="hover:bg-transparent">
                                                <SortableTableHead sortKey="name" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.tester')}</SortableTableHead>
                                                <SortableTableHead sortKey="velocity" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.velocity')}</SortableTableHead>
                                                <SortableTableHead sortKey="passRate" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.pass_rate')}</SortableTableHead>
                                                <SortableTableHead sortKey="failRate" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.fail_rate')}</SortableTableHead>
                                                <SortableTableHead sortKey="retestRate" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.retest_rate')}</SortableTableHead>
                                                <SortableTableHead sortKey="avgDurationMs" activeSortKey={performanceSortBy} direction={performanceSortOrder} onSort={handlePerformanceSort} className="h-11 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('dashboard.kpi.avg_duration')}</SortableTableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedPerformanceMetrics.map(row => (
                                                <TableRow key={row.testerId} className="hover:bg-primary/[0.02]">
                                                    <TableCell className="py-4 text-xs font-bold text-foreground/80">{row.name}</TableCell>
                                                    <TableCell className="py-4 text-right text-xs font-medium tabular-nums">{row.velocity}</TableCell>
                                                    <TableCell className="py-4 text-right text-xs font-bold text-emerald-600/80 tabular-nums">{row.passRate.toFixed(1)}%</TableCell>
                                                    <TableCell className="py-4 text-right text-xs font-bold text-rose-600/80 tabular-nums">{row.failRate.toFixed(1)}%</TableCell>
                                                    <TableCell className="py-4 text-right text-xs font-medium tabular-nums">{row.retestRate.toFixed(1)}%</TableCell>
                                                    <TableCell className="py-4 text-right text-xs font-medium text-muted-foreground/70 tabular-nums">{row.avgDurationMs ? `${Math.round(row.avgDurationMs / 1000)}${t('common.units.seconds')}` : '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(performanceMetrics || []).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-12 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40">
                                                        {t('dashboard.kpi.no_performance_data')}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </motion.div>
    )
}
