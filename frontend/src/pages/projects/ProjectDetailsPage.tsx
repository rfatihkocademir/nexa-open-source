import { useState, useEffect, lazy, Suspense } from "react"
import { Folder, FolderPlus, LayoutList, Clock3, Users, Loader2, Upload } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams, Link, useSearchParams } from "react-router-dom"
import { useAuthStore } from "@/store/authStore";
import { socketService } from "@/services/socket.service"
import { projectService } from "@/services/project.service"
import { testSuiteService } from "@/services/testSuite.service"
import { milestoneService } from "@/services/milestone.service"

import { formatDistanceToNow } from "date-fns"
import { useDateLocale } from "@/hooks/useDateLocale"
import { PageHero, PageLoading, PageMetric, PageMetricGrid } from "@/components/layout/PageChrome"
import { StatusBadge } from "@/components/ui/status-badge"
import { useTranslation } from "react-i18next"
import { queryKeys } from "@/lib/queryKeys"
import type { ProjectTab } from "@/lib/routes"
import ForbiddenPage from "@/pages/ForbiddenPage"
import { PageQueryError } from "@/components/layout/PageQueryError"
import { Button } from "@/components/ui/button"

// Lazy load tab components
const ProjectDashboard = lazy(() => import("./components/ProjectDashboard").then(m => ({ default: m.ProjectDashboard })))
const AgileBoardPage = lazy(() => import("./agile/AgileBoardPage"))
const BacklogPage = lazy(() => import("./agile/BacklogPage"))
const BugListPage = lazy(() => import("./agile/BugListPage"))
const TraceabilityPage = lazy(() => import("../analytics/TraceabilityPage"))
const TimesheetPage = lazy(() => import("./components/TimesheetPage"))
const QualityDashboard = lazy(() => import("./components/QualityDashboard").then(m => ({ default: m.QualityDashboard })))
const BusinessRequestPage = lazy(() => import("./ai/BusinessRequestPage"))
const WikiPage = lazy(() => import("../wiki/WikiPage"))
const TestSuiteList = lazy(() => import("./components/TestSuiteList").then(m => ({ default: m.TestSuiteList })))
const TestCaseList = lazy(() => import("./components/TestCaseList").then(m => ({ default: m.TestCaseList })))
const CreateSuiteDialog = lazy(() => import("./components/CreateSuiteDialog").then(m => ({ default: m.CreateSuiteDialog })))
const ImportDialog = lazy(() => import("./components/ImportDialog").then(m => ({ default: m.ImportDialog })))
const TestRunList = lazy(() => import("./components/TestRunList").then(m => ({ default: m.TestRunList })))
const AutomationHub = lazy(() => import("./components/AutomationHub").then(m => ({ default: m.AutomationHub })))
const ProjectSettings = lazy(() => import("./components/ProjectSettings").then(m => ({ default: m.ProjectSettings })))
const ProjectIntegrations = lazy(() => import("./components/ProjectIntegrations").then(m => ({ default: m.ProjectIntegrations })))
const MilestoneList = lazy(() => import("./components/MilestoneList").then(m => ({ default: m.MilestoneList })))
const ReleaseHub = lazy(() => import("./components/ReleaseHub"))
const ProjectAssistant = lazy(() => import("./components/ProjectAssistant").then(m => ({ default: m.ProjectAssistant })))

function ProjectContentSuspense({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        }>
            {children}
        </Suspense>
    )
}

export default function ProjectDetailsPage({ resourceId, defaultTab, initialWikiPageId }: { resourceId?: string; defaultTab?: ProjectTab; initialWikiPageId?: string } = {}) {
    const { t } = useTranslation()
    const { projectId: routeProjectId } = useParams<{ projectId: string }>()
    const projectId = resourceId ?? routeProjectId
    const [searchParams] = useSearchParams()
    const queryClient = useQueryClient()
    
    const activeTab: ProjectTab = defaultTab || (searchParams.get("tab") as ProjectTab) || "overview"
    const suiteIdFromUrl = searchParams.get("suiteId")
    const dateLocale = useDateLocale()

    const user = useAuthStore((state) => state.user)
    const isAdminOrLeader = user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER'

    const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(suiteIdFromUrl)
    const effectiveSelectedSuiteId = suiteIdFromUrl || selectedSuiteId

    const { data: project, isLoading, isError, refetch } = useQuery({
        queryKey: ["project", projectId],
        queryFn: () => projectService.getById(projectId!),
        enabled: !!projectId,
    })

    const suitesQueryProjectId = project?.id ?? ""
    const { data: suiteCatalog } = useQuery({
        queryKey: queryKeys.testSuites(suitesQueryProjectId, false),
        queryFn: () => testSuiteService.getAll(suitesQueryProjectId, false),
        enabled: activeTab === "test-cases" && !!suitesQueryProjectId,
    })
    const selectedSuiteName = suiteCatalog?.items.find((suite) => suite.id === effectiveSelectedSuiteId)?.name

    // Pre-fetching strategy for data freshness
    useEffect(() => {
        if (!projectId) return

        if (activeTab === 'test-cases') {
            queryClient.prefetchQuery({
                queryKey: queryKeys.testSuites(projectId, false),
                queryFn: () => testSuiteService.getAll(projectId, false)
            })
        }
        
        if (activeTab === 'milestones') {
            queryClient.prefetchQuery({
                queryKey: ["milestones", projectId],
                queryFn: () => milestoneService.getAll(projectId)
            })
        }
    }, [projectId, activeTab, queryClient])

    useEffect(() => {
        if (projectId) {
            socketService.joinProject(projectId)
            return () => {
                socketService.leaveProject(projectId)
            }
        }
    }, [projectId])

    if (isLoading) {
        return <PageLoading hasHero metricCount={4} />
    }

    if (isError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void refetch()} /></div>
    }

    if (!project) {
        return (
            <div className="page-shell">
                <div className="flex h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 text-muted-foreground">
                    <h2 className="text-2xl font-bold">{t('project_details.not_found')}</h2>
                    <p>{t('project_details.not_found_desc')}</p>
                    <Link data-testid="return-to-projects-link" to="/projects" className="mt-4 text-primary hover:underline">{t('project_details.return_to_projects')}</Link>
                </div>
            </div>
        )
    }

    const tabLabelMap: Record<string, string> = {
        overview: t('project_details.overview'),
        backlog: t('project_details.backlog'),
        board: t('project_details.agile_board'),
        bugs: t('project_details.bugs'),
        milestones: t('project_details.milestones'),
        "test-cases": t('project_details.test_cases'),
        runs: t('project_details.test_runs'),
        automation: t('project_details.automation'),
        traceability: t('project_details.rtm'),
        timesheet: 'Zaman Çizelgesi',
        quality: 'Quality Dashboard',
        wiki: t('project_details.wiki'),
        "ai-analyst": t('project_details.ai_analyst'),
        releases: t('common.release_hub'),
        "project-memory": t('common.project_memory'),
        settings: t('project_details.settings'),
    }
    const activeSectionLabel = tabLabelMap[activeTab] || t('project_details.overview')
    const membersCount = project.members?.length || 0
    const updatedAtDate = project.updatedAt ? new Date(project.updatedAt) : null
    const lastUpdate = updatedAtDate && !Number.isNaN(updatedAtDate.getTime())
        ? formatDistanceToNow(updatedAtDate, { addSuffix: true, locale: dateLocale })
        : "-"

    // ─── Content Renderer ─────────────────────────────────────────────────────
    const renderContent = () => {
        switch (activeTab) {
            case "overview":
                return <ProjectContentSuspense><ProjectDashboard projectId={project.id} projectKey={project.key} /></ProjectContentSuspense>

            case "backlog":
                return <ProjectContentSuspense><BacklogPage resourceId={project.id} projectKey={project.key} /></ProjectContentSuspense>

            case "board":
                return <ProjectContentSuspense><AgileBoardPage resourceId={project.id} projectKey={project.key} /></ProjectContentSuspense>

            case "bugs":
                return <ProjectContentSuspense><BugListPage projectId={project.id} /></ProjectContentSuspense>

            case "ai-analyst":
                return (
                    <div className="page-shell h-full">
                        <ProjectContentSuspense><BusinessRequestPage resourceId={project.id} projectKey={project.key} /></ProjectContentSuspense>
                    </div>
                )

                case "project-memory":
                    return (
                    <div className="page-shell h-full min-h-0">
                        <ProjectContentSuspense>
                            <ProjectAssistant projectId={project.id} />
                        </ProjectContentSuspense>
                    </div>
                )

            case "test-cases":
                return (
                    <div className="page-shell h-full min-h-0">
                        <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(270px,320px)_minmax(0,1fr)]">
                            {/* Suite Sidebar */}
                            <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:min-h-0">
                                <div className="border-b border-border/70 bg-muted/10 px-4 py-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                                            <Folder className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-foreground">
                                                {t('dashboard.test_suites')}
                                            </h3>
                                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                                Testlerini klasörlerde düzenle
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                    <ProjectContentSuspense>
                                        <TestSuiteList
                                            projectId={project.id}
                                            onSelectSuite={setSelectedSuiteId}
                                            selectedSuiteId={effectiveSelectedSuiteId}
                                        />
                                    </ProjectContentSuspense>
                                </div>
                            </aside>

                            {/* Case List */}
                            <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:min-h-0">
                                {effectiveSelectedSuiteId ? (
                                    <div className="flex min-h-0 flex-1 flex-col">
                                        <div className="flex items-center justify-between border-b border-border/70 bg-muted/10 px-5 py-4">
                                            <div>
                                                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                                    <Folder className="h-3.5 w-3.5 text-primary" />
                                                    Test seti
                                                </div>
                                                <h3 className="max-w-2xl truncate text-lg font-semibold text-foreground" title={selectedSuiteName ?? undefined}>
                                                    {selectedSuiteName ?? t('project_details.test_cases')}
                                                </h3>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Test senaryolarını oluşturun, düzenleyin ve çalıştırın.
                                                </p>
                                            </div>
                                            <span className="hidden items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                                                <LayoutList className="h-3.5 w-3.5" />
                                                Senaryo listesi
                                            </span>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                                            <ProjectContentSuspense>
                                                <TestCaseList suiteId={effectiveSelectedSuiteId} projectId={project.id} />
                                            </ProjectContentSuspense>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex min-h-0 flex-1 flex-col bg-muted/[0.04]">
                                        <div className="flex items-center justify-between border-b border-border/70 px-5 py-5 sm:px-7">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                                                    Test yönetimi
                                                </p>
                                                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                                    {t('project_details.test_cases')}
                                                </h2>
                                            </div>
                                            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
                                                <span className="h-2 w-2 rounded-full bg-amber-400" />
                                                Bir set seçilmedi
                                            </span>
                                        </div>

                                        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6 sm:p-10">
                                            <div className="w-full max-w-lg text-center">
                                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                                                    <LayoutList className="h-7 w-7 text-primary" />
                                                </div>
                                                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
                                                    Bir test seti seçin
                                                </h3>
                                                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                                                    Senaryoları görüntülemek için soldaki gezginden bir test seti açın. Henüz setiniz yoksa hemen yeni bir tane oluşturabilirsiniz.
                                                </p>
                                                <div className="mt-7 flex flex-wrap justify-center gap-3">
                                                    <CreateSuiteDialog
                                                        projectId={project.id}
                                                        trigger={
                                                            <Button size="sm" className="h-9 gap-2">
                                                                <FolderPlus className="h-4 w-4" />
                                                                Yeni test seti
                                                            </Button>
                                                        }
                                                    />
                                                    <ImportDialog
                                                        projectId={project.id}
                                                        trigger={
                                                            <Button variant="outline" size="sm" className="h-9 gap-2">
                                                                <Upload className="h-4 w-4" />
                                                                İçe aktar
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                                <p className="mt-6 text-xs text-muted-foreground/75">
                                                    veya soldan mevcut bir seti seçin
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                )

            case "runs":
                return (
                    <div className="page-shell">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                            <ProjectContentSuspense><TestRunList projectId={project.id} /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "automation":
                return <ProjectContentSuspense><AutomationHub projectId={project.id} /></ProjectContentSuspense>

            case "traceability":
                return (
                    <div className="page-shell">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                            <ProjectContentSuspense><TraceabilityPage /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "timesheet":
                return (
                    <div className="page-shell h-full min-h-0">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6 h-full flex flex-col">
                            <ProjectContentSuspense><TimesheetPage projectId={project.id} /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "quality":
                return (
                    <div className="page-shell">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                            <ProjectContentSuspense><QualityDashboard projectId={project.id} /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "milestones":
                return (
                    <div className="page-shell">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                            <ProjectContentSuspense><MilestoneList projectId={project.id} /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "wiki":
                return <ProjectContentSuspense><WikiPage resourceProjectId={project.id} initialPageId={initialWikiPageId} /></ProjectContentSuspense>

            case "releases":
                return (
                    <div className="page-shell">
                        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                            <ProjectContentSuspense><ReleaseHub resourceId={project.id} /></ProjectContentSuspense>
                        </div>
                    </div>
                )

            case "settings":
                if (!isAdminOrLeader) return <ForbiddenPage />
                return (
                    <div className="space-y-6">
                        <ProjectContentSuspense>
                            <ProjectSettings project={project} />
                            <ProjectIntegrations projectId={project.id} />
                        </ProjectContentSuspense>
                    </div>
                )

            default:
                return <ProjectContentSuspense><ProjectDashboard projectId={project.id} projectKey={project.key} /></ProjectContentSuspense>
        }
    }

    // Some tabs need full-bleed layout to use vertical space completely.
    // Also, when not on overview, we want to maximize space since the hero is hidden.
    const isFullBleed = activeTab !== 'overview'

    if (isFullBleed) {
        const contentOwnsHeading = ['backlog', 'board', 'bugs', 'automation', 'ai-analyst'].includes(activeTab)
        return (
            <div className={`relative flex h-full min-h-0 min-w-0 flex-1 flex-col ${activeTab === 'quality' ? 'overflow-x-hidden overflow-y-auto' : 'overflow-hidden'} animate-in fade-in-50 duration-300`}>
                {!contentOwnsHeading && <h1 className="sr-only">{project.name} · {activeSectionLabel}</h1>}
                {renderContent()}
            </div>
        )
    }

    return (
        <div className="page-shell animate-in page-stack fade-in-50 duration-300">
            <PageHero
                eyebrow={t('projects.brand_label')}
                title={project.name}
                description={project.description || t('projects.no_description')}
                actions={
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge status={project.status} />
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-muted-foreground shadow-sm">
                            <Clock3 className="h-3 w-3" />
                            {t('projects.column_last_update')}: {lastUpdate}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-muted-foreground shadow-sm">
                            {t('project_details.current_section')}: <span className="ml-1 font-medium text-foreground">{activeSectionLabel}</span>
                        </span>
                    </div>
                }
            >
                <PageMetricGrid>
                    <PageMetric
                        label={t('projects.column_suites')}
                        value={project._count?.suites || 0}
                        icon={Folder}
                    />
                    <PageMetric
                        label={t('project_details.test_cases')}
                        value={project._count?.testCases || 0}
                        icon={LayoutList}
                    />
                    <PageMetric
                        label={t('project_details.test_runs')}
                        value={project._count?.testRuns || 0}
                        icon={Clock3}
                    />
                    <PageMetric
                        label={t('projects.column_members')}
                        value={membersCount}
                        icon={Users}
                    />
                </PageMetricGrid>
            </PageHero>

            {renderContent()}
        </div>
    )
}
