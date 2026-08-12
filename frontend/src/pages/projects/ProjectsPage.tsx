import { useQuery, useQueryClient } from "@tanstack/react-query"
import { projectService } from "@/services/project.service"
import { Button } from "@/components/ui/button"
import { Folder, Archive, Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table"

import { useState, useEffect, useRef } from "react"
import { CreateProjectWizard } from "./components/CreateProjectWizard"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader, PageToolbar } from "@/components/layout/PageChrome"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid, List } from "lucide-react"

import { useTranslation } from "react-i18next"
import { useDateLocale } from "@/hooks/useDateLocale"
import { useAuthStore } from "@/store/authStore";
import type { Project } from "@/types/project"
import { ProjectCard, ProjectRow } from "./components/ProjectListItems"
import { useShortcuts } from "@/hooks/useShortcuts"
import { logger } from "@/utils/logger";
import { useUrlListState } from "@/hooks/useUrlListState"
import { PageQueryError } from "@/components/layout/PageQueryError"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

interface ProjectListItem extends Project {
    testRuns?: { id: string }[]
}

type ProjectViewMode = "grid" | "list"

function ProjectListSkeleton({ viewMode }: { viewMode: ProjectViewMode }) {
    if (viewMode === "grid") {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="enterprise-card animate-pulse">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-3 w-full" />
                                <div className="mt-4 flex items-center justify-between">
                                    <Skeleton className="h-5 w-16 rounded-full px-2 py-0.5" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <Skeleton className="h-16 rounded-xl" />
                                    <Skeleton className="h-16 rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-card shadow-sm animate-pulse">
            <div className="h-14 border-b border-border/50 bg-muted/40 px-5 flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-16 border-b border-border/50 px-5 flex items-center gap-4">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32 opacity-70" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="ml-auto h-5 w-10" />
                </div>
            ))}
        </div>
    )
}

export default function ProjectsPage() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const user = useAuthStore((state) => state.user)
    const dateLocale = useDateLocale()
    const searchInputRef = useRef<HTMLInputElement>(null)
    const canCreateProject = user?.role === 'TEAM_LEADER' || user?.role === 'ADMIN'
    const { getString, getNumber, setValue, setValues } = useUrlListState()
    const searchQuery = getString("q")

    useShortcuts({
        onSearchFocus: () => searchInputRef.current?.focus(),
        onOpenCreate: () => canCreateProject && setCreateDialogOpen(true)
    })
    const page = getNumber("page", 1)
    const [limit] = useState(10)
    const sortBy = getString("sort", "createdAt")
    const sortOrder: "asc" | "desc" = getString("order", "desc") === "asc" ? "asc" : "desc"
    const status = getString("status", "ACTIVE") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
    const viewMode: ProjectViewMode = getString("view", "list") === "grid" ? "grid" : "list"

    useEffect(() => {
        const shouldOpen = sessionStorage.getItem('openCreateProjectDialog') === 'true'
        if (shouldOpen && canCreateProject) {
            setTimeout(() => {
                sessionStorage.removeItem('openCreateProjectDialog')
                setCreateDialogOpen(true)
            }, 300)
        }
    }, [canCreateProject])

    const { data: response, isLoading, isError, refetch } = useQuery({
        queryKey: ["projects", page, limit, sortBy, sortOrder, status],
        queryFn: () => projectService.getAll(page, limit, sortBy, sortOrder, status),
    })

    const projects: ProjectListItem[] = (response?.data || []) as ProjectListItem[]
    const meta = response?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 }

    const handleArchiveProject = async (id: string) => {
        try {
            await projectService.archive(id)
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
            toast.success(t('projects.archive_success'))
        } catch (error) {
            toast.error(t('projects.archive_error'))
            logger.error(error)
        }
    }

    const handleUnarchiveProject = async (id: string) => {
        try {
            await projectService.unarchive(id)
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
            toast.success(t('projects.unarchive_success'))
        } catch (error) {
            toast.error(t('projects.unarchive_error'))
            logger.error(error)
        }
    }

    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setValue("order", sortOrder === "asc" ? "desc" : "asc", "desc")
            return
        }
        setValues({ sort: field, order: "asc" }, { sort: "createdAt", order: "desc" })
    }

    const toggleProjectAccordion = (projectId: string) => {
        setExpandedProjectId((current) => (current === projectId ? null : projectId))
    }

    const renderProjectList = (projects: ProjectListItem[], status: "ACTIVE" | "ARCHIVED") => {
        if (!projects.length) {
            const isActiveTab = status === "ACTIVE"
            return (
                <section className="enterprise-card border-dashed">
                    <EmptyState
                        icon={isActiveTab ? Folder : Archive}
                        title={isActiveTab ? t('projects.no_active_projects') : t('projects.no_archived_projects')}
                        description={isActiveTab ? t('projects.no_active_projects_desc') : t('projects.no_archived_projects_desc')}
                        action={isActiveTab && !projects.length && canCreateProject ? {
                            label: t('dashboard.create_project'),
                            onClick: () => setCreateDialogOpen(true),
                        } : undefined}
                        className="py-20"
                    />
                </section>
            )
        }

        if (viewMode === "grid") {
            return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project, index) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            status={status}
                            isExpanded={expandedProjectId === project.id}
                            onToggleAccordion={toggleProjectAccordion}
                            onArchive={handleArchiveProject}
                            onUnarchive={handleUnarchiveProject}
                            dateLocale={dateLocale}
                            index={index}
                        />
                    ))}
                </div>
            )
        }

        return (
            <>
                <div className="space-y-3 md:hidden">
                    {projects.map((project, index) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            status={status}
                            isExpanded={expandedProjectId === project.id}
                            onToggleAccordion={toggleProjectAccordion}
                            onArchive={handleArchiveProject}
                            onUnarchive={handleUnarchiveProject}
                            dateLocale={dateLocale}
                            index={index}
                        />
                    ))}
                </div>

                <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-card shadow-sm md:block">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <SortableTableHead sortKey="name" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="px-5">
                                    {t('projects.column_project')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="status" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="px-5">
                                    {t('projects.column_status')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="suites" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="hidden px-5 text-right lg:table-cell">
                                    {t('projects.column_suites')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="openRuns" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="px-5 text-right">
                                    {t('projects.column_open_runs')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="members" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="hidden px-5 text-right md:table-cell">
                                    {t('projects.column_members')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="updatedAt" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden px-5 lg:table-cell">
                                    {t('projects.column_last_update')}
                                </SortableTableHead>
                                <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="px-5 text-right">
                                    {t('common.actions')}
                                </SortableTableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="[&_tr]:border-border/70">
                            {projects.map((project, index) => (
                                <ProjectRow
                                    key={project.id}
                                    project={project}
                                    status={status}
                                    isExpanded={expandedProjectId === project.id}
                                    onToggleAccordion={toggleProjectAccordion}
                                    onArchive={handleArchiveProject}
                                    onUnarchive={handleUnarchiveProject}
                                    dateLocale={dateLocale}
                                    index={index}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </>
        )
    }

    if (isLoading) {
        return (
            <div className="page-shell page-stack">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-48 rounded-lg" />
                        <Skeleton className="ml-auto h-10 w-64 rounded-lg" />
                    </div>
                    <ProjectListSkeleton viewMode={viewMode} />
                </div>
            </div>
        )
    }

    if (isError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void refetch()} /></div>
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t('projects.portfolio_title')}
                description={t('projects.portfolio_description')}
                actions={
                    canCreateProject ? (
                        <Button data-testid="project-create-btn" onClick={() => setCreateDialogOpen(true)} className="h-10 px-4">
                            <Plus className="mr-2 h-4 w-4" />
                            {t('dashboard.create_project')}
                        </Button>
                    ) : (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Button data-testid="project-create-btn" disabled variant="secondary" className="h-10 rounded-lg">{t('dashboard.create_project')}</Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('dashboard.create_project_tooltip')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )
                }
                meta={
                    <>
                        <span>{t('projects.summary_total_in_tab')}: <span className="font-semibold text-foreground">{meta.total}</span></span>
                        <span className="text-border">•</span>
                        <span>{t('projects.summary_visible')}: <span className="font-semibold text-foreground">{filteredProjects.length}</span></span>
                    </>
                }
            />

            <CreateProjectWizard
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            <Tabs value={status} onValueChange={(val) => setValue("status", val, "ACTIVE")} className="w-full space-y-5">
                <PageToolbar className="p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <TabsList className="h-9 rounded-[var(--radius-card)] bg-muted/60 p-0.5">
                            <TabsTrigger data-testid="project-tab-active" value="ACTIVE" className="h-8 rounded-[var(--radius-control)] px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('projects.active_projects')}</TabsTrigger>
                            <TabsTrigger data-testid="project-tab-archived" value="ARCHIVED" className="h-8 rounded-[var(--radius-control)] px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('projects.archived_projects')}</TabsTrigger>
                        </TabsList>

                        <div className="relative w-full lg:ml-auto lg:max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                            <Input
                                data-testid="project-search-input"
                                aria-label={t('projects.filter_placeholder')}
                                ref={searchInputRef}
                                placeholder={t('projects.filter_placeholder')}
                                className="h-9 rounded-[var(--radius-control)] border-border bg-card pl-9 pr-10 shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setValue("q", e.target.value)}
                            />
                            <div className="pointer-events-none absolute right-3 top-2.5 hidden items-center gap-1 rounded-md border border-border/50 bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground opacity-100 sm:flex">
                                <span>/</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-[var(--radius-card)] border border-border bg-card p-0.5 lg:ml-2">
                            <Button
                                data-testid="project-view-list"
                                variant={viewMode === "list" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-8 w-8 rounded-md"
                                onClick={() => setValue("view", "list", "list")}
                                aria-label={t('projects.view_as_list')}
                                aria-pressed={viewMode === "list"}
                                title={t('projects.view_as_list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                data-testid="project-view-grid"
                                variant={viewMode === "grid" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-8 w-8 rounded-md"
                                onClick={() => setValue("view", "grid", "list")}
                                aria-label={t('projects.view_as_grid')}
                                aria-pressed={viewMode === "grid"}
                                title={t('projects.view_as_grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 lg:ml-2">
                            {filteredProjects.length} / {meta.total}
                        </div>
                    </div>
                </PageToolbar>

            {renderProjectList(filteredProjects, status)}
            </Tabs>

            {meta.totalPages > 1 && (
                <div className="rounded-[var(--radius-card)] border border-border/70 bg-card px-4 py-2 shadow-sm">
                    <PaginationControls
                        currentPage={page}
                        totalPages={meta.totalPages}
                        onPageChange={(nextPage) => setValue("page", nextPage, 1)}
                    />
                </div>
            )}

        </div>
    )
}
