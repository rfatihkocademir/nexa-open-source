import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown, Folder, LayoutGrid, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { dashboardService } from "@/services/dashboard.service"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { queryKeys } from "@/lib/queryKeys"
import { appRoutes, type ProjectTab } from "@/lib/routes"

interface ProjectSelectorProps {
    className?: string
    activeProjectId?: string
    activeProjectKey?: string
    activeTab?: ProjectTab
}

const EMPTY_PROJECTS: NonNullable<Awaited<ReturnType<typeof dashboardService.getWorkspaceOverview>>>["projects"] = []

export function ProjectSelector({ className, activeProjectId, activeProjectKey, activeTab = "overview" }: ProjectSelectorProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const { data: overview } = useQuery({
        queryKey: queryKeys.dashboard.overview,
        queryFn: dashboardService.getWorkspaceOverview,
        staleTime: 5 * 60 * 1000,
    })
    const projects = overview?.projects ?? EMPTY_PROJECTS

    const selectedProject = projects.find((project) => project.id === activeProjectId || project.key === activeProjectKey)
    const filteredProjects = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase()
        if (!needle) return projects
        return projects.filter((project) =>
            project.name.toLocaleLowerCase().includes(needle) ||
            project.key.toLocaleLowerCase().includes(needle)
        )
    }, [projects, query])

    const selectProject = (projectId: string) => {
        const project = projects.find((item) => item.id === projectId)
        if (project) navigate(appRoutes.projectTab(project.key, activeTab))
        setOpen(false)
        setQuery("")
    }

    return (
        <DropdownMenu open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery("") }}>
            <DropdownMenuTrigger asChild>
                <Button
                    data-testid="project-selector-dropdown"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={t("common.select_project")}
                    className={cn("h-9 w-[200px] justify-between border-sidebar-border bg-sidebar-accent/40 px-2.5 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground", className)}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[calc(var(--radius)-1px)] bg-sidebar-accent">
                            <Folder className="h-3.5 w-3.5 text-sidebar-foreground/72" />
                        </span>
                        <span className="truncate text-left">
                            {selectedProject ? <><span className="font-mono text-[10px] opacity-60">{selectedProject.key}</span><span className="mx-1.5 opacity-30">·</span>{selectedProject.name}</> : t("common.select_project")}
                        </span>
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[min(360px,calc(100vw-24px))] p-1.5">
                <DropdownMenuLabel className="p-1.5">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            data-testid="project-selector-search"
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            placeholder={t("projects.filter_placeholder")}
                            className="h-9 pl-8"
                            aria-label={t("projects.filter_placeholder")}
                        />
                    </div>
                </DropdownMenuLabel>
                <div className="max-h-72 overflow-y-auto">
                    {filteredProjects.map((project) => (
                        <DropdownMenuItem key={project.id} data-testid={`project-selector-item-${project.key}`} onSelect={() => selectProject(project.id)} className="gap-2.5 py-2">
                            <span className="w-12 shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">{project.key}</span>
                            <span className="min-w-0 flex-1 truncate">{project.name}</span>
                            {selectedProject?.id === project.id && <Check className="h-4 w-4 text-primary" />}
                        </DropdownMenuItem>
                    ))}
                    {filteredProjects.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("common.table.no_results")}</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { navigate(appRoutes.projects()); setOpen(false) }} className="gap-2 font-medium text-primary">
                    <LayoutGrid className="h-4 w-4" />
                    {t("projects.view_all")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
