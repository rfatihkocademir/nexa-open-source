import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Folder, Archive, MoreHorizontal, Pencil, Trash2, ArrowRight, ChevronDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Locale } from "date-fns"
import { TableCell } from "@/components/ui/table"
import { StatusBadge } from "@/components/ui/status-badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { appRoutes } from "@/lib/routes"
import { useTranslation } from "react-i18next"
import type { Project } from "@/types/project"
import { Fragment } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface ProjectListItem extends Project {
    testRuns?: { id: string }[]
}

interface ProjectListItemsProps {
    project: ProjectListItem
    status: "ACTIVE" | "ARCHIVED"
    isExpanded: boolean
    onToggleAccordion: (id: string) => void
    onArchive: (id: string) => void
    onUnarchive: (id: string) => void
    dateLocale: Locale
    index?: number
}

const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
}

export const ProjectActions = ({ 
    project, 
    status, 
    onArchive, 
    onUnarchive, 
    stopPropagation = false 
}: { 
    project: ProjectListItem, 
    status: "ACTIVE" | "ARCHIVED", 
    onArchive: (id: string) => void, 
    onUnarchive: (id: string) => void,
    stopPropagation?: boolean 
}) => {
    const { t } = useTranslation()
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
                >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t('projects.open_menu')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link to={appRoutes.project(project.key)} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t('projects.view_project')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('projects.edit_details')}
                </DropdownMenuItem>
                {status === "ACTIVE" ? (
                    <DropdownMenuItem
                        className="text-amber-600"
                        onClick={(e) => {
                            if (stopPropagation) e.stopPropagation()
                            onArchive(project.id)
                        }}
                    >
                        <Archive className="mr-2 h-4 w-4" />
                        {t('projects.archive_project')}
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        className="text-primary"
                        onClick={(e) => {
                            if (stopPropagation) e.stopPropagation()
                            onUnarchive(project.id)
                        }}
                    >
                        <RotateCcwIcon className="mr-2 h-4 w-4" />
                        {t('projects.unarchive_project')}
                    </DropdownMenuItem>
                )}
                {status === "ARCHIVED" && (
                    <DropdownMenuItem className="text-red-600" onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('projects.delete_project')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const RotateCcwIcon = ({ className }: { className?: string }) => <div className={className}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div>

export const ProjectCard = ({ project, status, isExpanded, onToggleAccordion, onArchive, onUnarchive, dateLocale }: ProjectListItemsProps) => {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const openRuns = project.testRuns?.length || 0
    const membersCount = project.members?.length || 0
    const lastUpdate = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: dateLocale })
    const detailDescription = project.description || t('projects.no_description')
    const shortDescription = detailDescription.length > 140
        ? `${detailDescription.slice(0, 137)}...`
        : detailDescription

    return (
        <article className="enterprise-card group relative">
            <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary transition-colors group-hover:bg-primary/10">
                    {status === "ACTIVE" ? <Folder className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <button
                                type="button"
                                onClick={() => navigate(appRoutes.project(project.key))}
                                className="group/title w-full text-left"
                            >
                                <div className="text-enterprise-header text-base transition-colors group-hover/title:text-primary">{project.name}</div>
                                <div className="text-enterprise-muted mt-1 line-clamp-2">{shortDescription}</div>
                            </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => onToggleAccordion(project.id)}
                            >
                                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                <span className="sr-only">{t('common.more')}</span>
                            </Button>
                            <ProjectActions project={project} status={status} onArchive={onArchive} onUnarchive={onUnarchive} />
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge status={status} />
                        <span className="text-[11px] text-muted-foreground">{t('projects.column_last_update')}: {lastUpdate}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">{t('projects.column_suites')}</div>
                            <div className="mt-1 font-heading text-xl font-bold text-foreground">{project._count?.suites || 0}</div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">{t('projects.column_open_runs')}</div>
                            <div className={cn("mt-1 font-heading text-xl font-bold", openRuns > 0 ? "text-primary" : "text-foreground")}>
                                {openRuns}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">{t('projects.column_members')}</div>
                        {membersCount > 0 ? (
                            <div className="flex items-center gap-2">
                                <div className="inline-flex items-center -space-x-2.5">
                                    {project.members?.slice(0, 4).map((member) => (
                                        <div
                                            key={member.user.id}
                                            title={`${member.user.firstName} ${member.user.lastName}`}
                                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-background text-[10px] font-semibold text-foreground"
                                        >
                                            {getUserInitials(member.user.firstName, member.user.lastName)}
                                        </div>
                                    ))}
                                    {membersCount > 4 && (
                                        <div className="flex h-8 items-center rounded-full border-2 border-card bg-muted px-2 text-[10px] font-bold text-muted-foreground shadow-sm">
                                            +{membersCount - 4}
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-semibold text-foreground">{membersCount}</span>
                            </div>
                        ) : (
                            <span className="text-xs font-medium text-muted-foreground opacity-60">{t('projects.detail_no_members')}</span>
                        )}
                    </div>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 rounded-xl border border-border/70 bg-background/90 p-3 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center rounded-lg border border-border/70 bg-muted/30 px-2 py-1 font-medium text-foreground">
                                            {t('projects.detail_description')}
                                        </span>
                                        <span className="break-words text-muted-foreground">{shortDescription}</span>
                                    </div>
                                    <div className="mt-2 inline-flex items-center rounded-lg border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">
                                        {t('projects.detail_created')}: {new Date(project.createdAt).toLocaleDateString(i18n.language)}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </article>
    )
}

export const ProjectRow = ({ project, status, isExpanded, onToggleAccordion, onArchive, onUnarchive, dateLocale }: ProjectListItemsProps) => {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const openRuns = project.testRuns?.length || 0
    const membersCount = project.members?.length || 0
    const lastUpdate = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: dateLocale })
    const detailDescription = project.description || t('projects.no_description')
    const rowDescription = detailDescription.length > 88
        ? `${detailDescription.slice(0, 85)}...`
        : detailDescription
    const shortDescription = detailDescription.length > 140
        ? `${detailDescription.slice(0, 137)}...`
        : detailDescription

    return (
        <Fragment>
            <tr
                onClick={() => navigate(appRoutes.project(project.key))}
                className="group cursor-pointer border-b border-border/50 bg-card hover:bg-primary/[0.02] transition-colors"
            >
                <TableCell className="px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary shadow-sm transition-all group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:shadow-md">
                            {status === "ACTIVE" ? <Folder className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                            <div className="text-enterprise-header text-[15px] transition-colors group-hover:text-primary">{project.name}</div>
                            <div className="text-enterprise-muted mt-0.5 line-clamp-1">{rowDescription}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground/70 lg:hidden">{t('projects.column_last_update')}: {lastUpdate}</div>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="px-5 py-4">
                    <StatusBadge status={status} />
                </TableCell>
                <TableCell className="hidden px-5 py-4 text-right lg:table-cell">
                    <span className="font-heading text-sm tabular-nums text-foreground">{project._count?.suites || 0}</span>
                </TableCell>
                <TableCell className="px-5 py-4 text-right">
                    <span className={cn("font-heading text-sm tabular-nums", openRuns > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                        {openRuns}
                    </span>
                </TableCell>
                <TableCell className="hidden px-5 py-4 md:table-cell">
                    {membersCount > 0 ? (
                        <div className="flex justify-end">
                            <div className="inline-flex items-center -space-x-2">
                                {project.members?.slice(0, 4).map((member) => (
                                    <div
                                        key={member.user.id}
                                        title={`${member.user.firstName} ${member.user.lastName}`}
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-background text-[10px] font-semibold text-foreground shadow-sm"
                                    >
                                        {getUserInitials(member.user.firstName, member.user.lastName)}
                                    </div>
                                ))}
                                {membersCount > 4 && (
                                    <div className="flex h-8 items-center rounded-full border-2 border-card bg-muted px-2 text-[10px] font-semibold text-muted-foreground shadow-sm">
                                        +{membersCount - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-right text-sm text-muted-foreground">-</div>
                    )}
                </TableCell>
                <TableCell className="hidden px-5 py-4 lg:table-cell">
                    <span className="text-sm text-muted-foreground">{lastUpdate}</span>
                </TableCell>
                <TableCell className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleAccordion(project.id)
                            }}
                        >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                            <span className="sr-only">{t('common.more')}</span>
                        </Button>
                        <ProjectActions project={project} status={status} onArchive={onArchive} onUnarchive={onUnarchive} stopPropagation />
                    </div>
                </TableCell>
            </tr>
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <tr className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="px-5 pb-3 pt-0">
                            <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 rounded-xl border border-border/70 bg-background/90 px-3 py-3 text-xs mb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center rounded-lg border border-border/70 bg-muted/30 px-2 py-1 font-medium text-foreground">
                                            {t('projects.detail_description')}
                                        </span>
                                        <span className="break-words text-muted-foreground">{shortDescription}</span>
                                    </div>
                                    <div className="mt-2 inline-flex items-center rounded-lg border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">
                                        {t('projects.detail_created')}: {new Date(project.createdAt).toLocaleDateString(i18n.language)}
                                    </div>
                                </div>
                            </motion.div>
                        </TableCell>
                    </tr>
                )}
            </AnimatePresence>
        </Fragment>
    )
}
