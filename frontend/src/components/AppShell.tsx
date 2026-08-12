import { useState, useCallback, useEffect } from "react"
import type { CSSProperties } from "react"
import { Link, useLocation, Outlet, useSearchParams, matchPath } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
    LayoutDashboard,
    FolderKanban,
    LogOut,
    Search,
    ChevronDown,
    PlayCircle,
    Flag,
    Users,
    ListTodo,
    Kanban,
    Sparkles,
    LayoutList,
    Link2,
    BookOpen,
    Settings,
    BarChart2,
    Clock,
    Rocket,
    BarChart3,
    Menu,
    Brain,
    Sun,
    Moon,
    Bot,
    MoreHorizontal,
    Star,
    ShieldCheck,
    Cpu,
    BriefcaseBusiness,
    Inbox,
    PanelsTopLeft,
    LifeBuoy,
    LockKeyhole,
    Siren,
    Activity,
    Bug,
} from "lucide-react"


import { cn } from "@/lib/utils"
import { resourceService } from "@/services/resource.service"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/store/authStore"
import { NotificationCenter } from "@/components/NotificationCenter"


import { AnimatePresence } from "framer-motion"
import { PageTransition } from "./layout/PageTransition"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { TimeTrackerWidget } from "@/components/worklog/TimeTrackerWidget"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { ProjectSelector } from "./navigation/ProjectSelector"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getImageUrl } from "@/services/upload.service"
import { useTheme } from "@/components/theme-provider"
import { Switch } from "@/components/ui/switch"

import {
    TooltipProvider,
} from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

import { BrandLogo } from "@/components/brand/BrandLogo"
import { HelpCenter } from "@/components/help/HelpCenter"
import { GuidedTour } from "@/components/help/GuidedTour"
import { appRoutes, projectTabFromSection, type ProjectTab } from "@/lib/routes"
import { QuickCreate } from "@/components/quick-create"
import { NavigationMemory } from "@/components/navigation/NavigationMemory"
import { actionCenterService } from "@/services/action-center.service"
import {
    isFavoriteLocation,
    toggleFavoriteLocation,
    USER_NAVIGATION_CHANGED_EVENT,
} from "@/lib/user-navigation"
import { queryKeys } from "@/lib/queryKeys"


interface NavItem {
    id: string
    label: string
    icon: React.ElementType
    href: string
    badge?: number
}

interface NavGroup {
    id: "global-navigation" | "workspace" | "admin" | "planning" | "quality" | "collaboration" | "settings"
    label: string
    items: NavItem[]
}

function getGlobalNavGroups(t: TFunction, isAdmin: boolean, actionCount = 0): NavGroup[] {
    const groups: NavGroup[] = [
        {
            id: "global-navigation",
            label: t('common.navigation'),
            items: [
                { id: "dashboard", label: t('common.dashboard'), icon: LayoutDashboard, href: appRoutes.dashboard() },
                { id: "inbox", label: t('action_center.nav'), icon: Inbox, href: appRoutes.inbox(), badge: actionCount },
                { id: "projects", label: t('common.projects'), icon: FolderKanban, href: appRoutes.projects() },
            ]
        },
        {
            id: "workspace",
            label: t('common.workspace'),
            items: [
                { id: "service-desk", label: t('common.service_desk', 'Service Desk'), icon: LifeBuoy, href: "/service-desk" },
                { id: "automation-grid", label: t('common.automation_grid', 'Otomasyon & Grid'), icon: Cpu, href: "/automation-grid" },
                { id: "sla-settings", label: t('common.sla_settings', 'SLA Yönetimi'), icon: ShieldCheck, href: "/settings/sla" },
                { id: "dashboards", label: t('dashboard_studio.nav'), icon: PanelsTopLeft, href: "/dashboards" },
                { id: "runs", label: t('common.test_runs'), icon: PlayCircle, href: "/runs" },
                { id: "milestones", label: t('common.milestones'), icon: Flag, href: "/milestones" },
                { id: "reports", label: t('common.reports'), icon: BarChart3, href: "/reports" },
                { id: "portfolio", label: t('portfolio.nav'), icon: BriefcaseBusiness, href: "/portfolio" },
            ]
        },
    ]

    if (isAdmin) {
        groups.push({
            id: "admin",
            label: t('common.admin'),
            items: [
                { id: "users", label: t('common.users'), icon: Users, href: "/admin/users" },
                { id: "audit", label: t('audit_log.nav'), icon: ShieldCheck, href: "/admin/audit" },
                { id: "security", label: t('common.enterprise_security', 'Kurumsal güvenlik'), icon: LockKeyhole, href: "/admin/security" },
                { id: "security-operations", label: t('common.security_operations', 'Güvenlik operasyonları'), icon: Siren, href: "/admin/security-operations" },
                { id: "operations", label: t('common.operational_resilience', 'Operasyonel dayanıklılık'), icon: Activity, href: "/admin/operations" },
            ]
        })
    }

    return groups
}

function getProjectNavGroups(t: TFunction, projectId: string, isAdminOrLeader: boolean, projectKey?: string): NavGroup[] {
    const href = (tab: ProjectTab) => projectKey
        ? appRoutes.projectTab(projectKey, tab)
        : `/projects/${projectId}?tab=${tab}`
    const groups: NavGroup[] = [
        {
            id: "planning",
            label: t('project_details.planning'),
            items: [
                { id: "overview", label: t('project_details.overview'), icon: LayoutDashboard, href: href('overview') },
                { id: "backlog", label: t('project_details.backlog'), icon: ListTodo, href: href('backlog') },
                { id: "board", label: t('project_details.agile_board'), icon: Kanban, href: href('board') },
                { id: "bugs", label: t('project_details.bugs'), icon: Bug, href: href('bugs') },
                { id: "milestones", label: t('project_details.milestones'), icon: Flag, href: href('milestones') },
            ]
        },
        {
            id: "quality",
            label: t('project_details.quality'),
            items: [
                { id: "test-cases", label: t('project_details.test_cases'), icon: LayoutList, href: href('test-cases') },
                { id: "runs", label: t('project_details.test_runs'), icon: PlayCircle, href: href('runs') },
                { id: "automation", label: t('common.automation'), icon: Bot, href: href('automation') },
                { id: "traceability", label: t('project_details.rtm'), icon: Link2, href: href('traceability') },
                { id: "timesheet", label: t('project_details.timesheet', 'Zaman Çizelgesi'), icon: Clock, href: href('timesheet') },
                { id: "quality", label: t('project_details.quality_dashboard', 'Kalite Paneli'), icon: BarChart2, href: href('quality') },
            ]
        },
        {
            id: "collaboration",
            label: t('project_details.collaboration'),
            items: [
                { id: "wiki", label: t('project_details.wiki'), icon: BookOpen, href: href('wiki') },
                { id: "project-memory", label: t('common.project_memory'), icon: Brain, href: href('project-memory') },
                { id: "ai-analyst", label: t('project_details.ai_analyst'), icon: Sparkles, href: href('ai-analyst') },
                { id: "releases", label: t('common.release_hub'), icon: Rocket, href: href('releases') },
            ]
        },
    ]

    if (isAdminOrLeader) {
        groups.push({
            id: "settings",
            label: t('project_details.settings'),
            items: [
                { id: "settings", label: t('project_details.settings'), icon: Settings, href: href('settings') },
            ]
        })
    }

    return groups
}

function getGroupToneStyles(groupId: NavGroup["id"]) {
    const accentByGroup: Record<NavGroup["id"], string> = {
        "global-navigation": "var(--primary)",
        workspace: "var(--info)",
        admin: "var(--destructive)",
        planning: "var(--nav-planning)",
        quality: "var(--nav-quality)",
        collaboration: "var(--nav-collaboration)",
        settings: "var(--nav-settings)",
    }

    const strongByGroup: Record<NavGroup["id"], string> = {
        "global-navigation": "var(--primary)",
        workspace: "var(--info)",
        admin: "var(--destructive)",
        planning: "var(--nav-planning-strong)",
        quality: "var(--nav-quality-strong)",
        collaboration: "var(--nav-collaboration-strong)",
        settings: "var(--nav-settings-strong)",
    }

    const softByGroup: Record<NavGroup["id"], string> = {
        "global-navigation": "color-mix(in srgb, var(--primary), transparent 86%)",
        workspace: "color-mix(in srgb, var(--info), transparent 85%)",
        admin: "color-mix(in srgb, var(--destructive), transparent 84%)",
        planning: "var(--nav-planning-soft)",
        quality: "var(--nav-quality-soft)",
        collaboration: "var(--nav-collaboration-soft)",
        settings: "var(--nav-settings-soft)",
    }

    const accent = accentByGroup[groupId]
    const strong = strongByGroup[groupId]
    const soft = softByGroup[groupId]

    return {
        labelStyle: {
            backgroundColor: soft,
            borderColor: `color-mix(in srgb, ${accent}, transparent 76%)`,
            color: strong,
        } satisfies CSSProperties,
        activeStyle: {
            backgroundColor: soft,
            borderColor: `color-mix(in srgb, ${accent}, transparent 70%)`,
            color: strong,
            boxShadow: `0 0 0 1px color-mix(in srgb, ${accent}, transparent 82%)`,
        } satisfies CSSProperties,
        hoverStyle: {
            borderColor: `color-mix(in srgb, ${accent}, transparent 84%)`,
        } satisfies CSSProperties,
    }
}

export function AppShell() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [favoriteVersion, setFavoriteVersion] = useState(0)
    const location = useLocation()
    const user = useAuthStore((state) => state.user)
    const logout = useAuthStore((state) => state.logout)
    const { theme, setTheme } = useTheme()
    const [density, setDensity] = useState<"compact" | "standard" | "comfortable">(() => {
        const saved = window.localStorage.getItem("nexa-ui-density")
        return saved === "compact" || saved === "comfortable" ? saved : "standard"
    })

    useEffect(() => {
        document.documentElement.dataset.density = density
        window.localStorage.setItem("nexa-ui-density", density)
    }, [density])


    const { t } = useTranslation()
    const match = matchPath("/projects/:projectId/*", location.pathname)
    const releaseMatch = matchPath("/projects/:projectId/releases/:releaseId", location.pathname)
    const resourceMatch = matchPath("/b/:resourceKey", location.pathname)
    const projectResourceMatch = matchPath("/p/:projectKey/*", location.pathname) ?? matchPath("/p/:projectKey", location.pathname)
    const canonicalProjectSectionMatch = matchPath("/:teamSlug/:projectSlug/:section", location.pathname)
    const canonicalProjectMatch = canonicalProjectSectionMatch ?? matchPath("/:teamSlug/:projectSlug", location.pathname)
    const canonicalResourceMatch = matchPath("/:teamSlug/:projectSlug/:resourceType/:resourceKey/:titleSlug?", location.pathname)
    const { data: activeResource } = useQuery({
        queryKey: queryKeys.resources.detail(resourceMatch?.params.resourceKey),
        queryFn: () => resourceService.resolve(resourceMatch!.params.resourceKey!),
        enabled: !!resourceMatch?.params.resourceKey,
        staleTime: 5 * 60 * 1000,
    })
    const { data: activeProjectResource } = useQuery({
        queryKey: queryKeys.resources.project(projectResourceMatch?.params.projectKey ?? canonicalProjectMatch?.params.projectSlug),
        queryFn: () => resourceService.resolveProject((projectResourceMatch?.params.projectKey ?? canonicalProjectMatch?.params.projectSlug)!),
        enabled: !!(projectResourceMatch?.params.projectKey ?? canonicalProjectMatch?.params.projectSlug),
        staleTime: 5 * 60 * 1000,
    })
    const canonicalResourceKey = canonicalResourceMatch?.params.resourceKey
    const { data: canonicalResource } = useQuery({
        queryKey: queryKeys.resources.detail(canonicalResourceKey),
        queryFn: () => resourceService.resolve(canonicalResourceKey!),
        enabled: !!canonicalResourceKey,
        staleTime: 5 * 60 * 1000,
    })
    const effectiveResource = activeResource ?? canonicalResource
    const projectId = match?.params.projectId ?? effectiveResource?.projectId ?? activeProjectResource?.id ?? undefined
    const [searchParams] = useSearchParams()
    const resourceTab = effectiveResource?.type === 'RELEASE_CANDIDATE'
        ? 'releases'
        : effectiveResource?.type === 'TEST_CASE'
            ? 'test-cases'
            : effectiveResource?.type === 'TEST_RUN'
            ? 'runs'
                : effectiveResource?.type === 'MILESTONE'
                    ? 'milestones'
                    : effectiveResource?.type === 'WORK_ITEM'
                        ? 'board'
                        : effectiveResource?.type === 'WIKI_PAGE'
                            ? 'wiki'
                        : undefined
    const projectSection = projectResourceMatch ? location.pathname.split('/')[3] : canonicalProjectSectionMatch?.params.section
    const sectionTab = projectTabFromSection(projectSection)
    const activeTab = releaseMatch ? "releases" : (resourceTab || sectionTab || searchParams.get("tab") || "overview")

    const isAdmin = user?.role === 'ADMIN'
    const isAdminOrLeader = isAdmin || user?.role === 'TEAM_LEADER'
    const { data: actionSummary } = useQuery({
        queryKey: queryKeys.actionCenter.summary,
        queryFn: actionCenterService.summary,
        enabled: !projectId,
        staleTime: 30_000,
        refetchInterval: 60_000,
    })

    const navGroups = projectId
        ? getProjectNavGroups(t, projectId, isAdminOrLeader, activeProjectResource?.key ?? effectiveResource?.projectKey ?? undefined)
        : getGlobalNavGroups(t, isAdmin, actionSummary?.open ?? 0)

    const isActive = (item: NavItem) => {
        if (projectId) {
            return activeTab === item.id
        }
        return location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(`${item.href}/`))
    }

    const activeNavGroup = navGroups.find((group) => group.items.some(isActive))
    const activeNavItem = activeNavGroup?.items.find(isActive)
    const currentPath = `${location.pathname}${location.search}`
    const currentIsFavorite = isFavoriteLocation(currentPath)
    const projectPrimaryItemIds = new Set(["overview", "backlog", "board", "test-cases", "runs"])
    const projectNavItems = projectId ? navGroups.flatMap((group) => group.items) : []
    const projectPrimaryItems = projectNavItems.filter((item) => projectPrimaryItemIds.has(item.id))
    const projectMoreGroups = projectId
        ? navGroups
            .map((group) => ({ ...group, items: group.items.filter((item) => !projectPrimaryItemIds.has(item.id)) }))
            .filter((group) => group.items.length > 0)
        : []

    const openCommandMenu = useCallback(() => {
        window.dispatchEvent(new Event("command-menu:open"))
    }, [])

    useEffect(() => {
        const refreshFavorites = () => setFavoriteVersion((value) => value + 1)
        window.addEventListener(USER_NAVIGATION_CHANGED_EVENT, refreshFavorites)
        return () => window.removeEventListener(USER_NAVIGATION_CHANGED_EVENT, refreshFavorites)
    }, [])

    const toggleCurrentFavorite = () => {
        const projectKey = activeProjectResource?.key ?? activeResource?.projectKey
        toggleFavoriteLocation({
            path: currentPath,
            label: projectKey && activeNavItem ? `${projectKey} · ${activeNavItem.label}` : activeNavItem?.label ?? document.title,
            context: projectKey || t("common.navigation"),
        })
        setFavoriteVersion((value) => value + 1)
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
                <NavigationMemory />
                <a
                    href="#main-content"
                    className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
                >
                    {t("common.skip_to_content", "Ana içeriğe geç")}
                </a>
                <header className="sticky top-0 z-40 w-full border-b border-sidebar-border bg-sidebar shadow-sm">
                    <div className="density-header flex items-center justify-between gap-4 px-[var(--layout-gutter)]">
                        <div className="flex items-center gap-6 overflow-hidden min-w-0 flex-1">
                            <Link to="/" className="flex items-center gap-2 shrink-0 group" data-tour="brand">
                                <BrandLogo
                                    markClassName="h-8 w-8 rounded-[var(--radius-card)] border border-sidebar-border shadow-sm"
                                    textClassName="hidden lg:block text-base font-semibold text-sidebar-foreground"
                                />
                            </Link>

                            <Separator orientation="vertical" className="h-6 hidden sm:block bg-sidebar-border/60" />

                            <div className="flex items-center gap-2 min-w-0 max-w-full">
                                {projectId && (
                                    <div className="flex items-center gap-2 min-w-0 shrink-0" data-tour="project-selector">
                                        <ProjectSelector
                                            activeProjectId={projectId}
                                            activeProjectKey={activeProjectResource?.key ?? activeResource?.projectKey ?? undefined}
                                            activeTab={activeTab as ProjectTab}
                                            className="density-control w-[180px] lg:w-[220px]"
                                        />
                                        <Separator orientation="vertical" className="h-6 hidden md:block bg-sidebar-border/60" />
                                    </div>
                                )}

                                <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label={projectId ? t('common.projects') : t('common.navigation')} data-tour="primary-navigation">
                                    {projectId ? (
                                        <>
                                            {projectPrimaryItems.map((item) => {
                                                const active = isActive(item)
                                                return (
                                                    <Button
                                                        key={item.id}
                                                        data-testid={`nav-${item.id}`}
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                        className={cn(
                                                            "density-control gap-1.5 px-2.5 text-sm font-medium transition-colors",
                                                            active
                                                                ? "bg-primary/10 text-primary hover:bg-primary/12 hover:text-primary"
                                                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                                        )}
                                                        title={item.label}
                                                        aria-label={item.label}
                                                    >
                                                        <Link to={item.href} aria-current={active ? "page" : undefined}>
                                                            <item.icon className="h-4 w-4 shrink-0" />
                                                            <span className="hidden 2xl:inline">{item.label}</span>
                                                        </Link>
                                                    </Button>
                                                )
                                            })}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "density-control gap-1.5 px-2.5 text-sm font-medium",
                                                            projectMoreGroups.some((group) => group.items.some(isActive)) && "bg-primary/10 text-primary"
                                                        )}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="hidden xl:inline">{t('common.more')}</span>
                                                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-60 p-1.5">
                                                    {projectMoreGroups.map((group, groupIndex) => (
                                                        <div key={group.id}>
                                                            {groupIndex > 0 && <DropdownMenuSeparator />}
                                                            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                                {group.label}
                                                            </DropdownMenuLabel>
                                                            {group.items.map((item) => {
                                                                const active = isActive(item)
                                                                return (
                                                                    <DropdownMenuItem key={item.id} asChild className={cn("rounded-md", active && "bg-primary/10 text-primary")}>
                                                                        <Link to={item.href} className="flex w-full items-center gap-2.5 py-2" aria-current={active ? "page" : undefined}>
                                                                            <item.icon className="h-4 w-4" />
                                                                            <span>{item.label}</span>
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                )
                                                            })}
                                                        </div>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </>
                                    ) : navGroups.map((group) => (
                                        <DropdownMenu key={group.id}>
                                            <DropdownMenuTrigger asChild>
                                                {(() => {
                                                    const groupActive = group.items.some(isActive)
                                                    const toneStyles = getGroupToneStyles(group.id)
                                                    const groupBadge = group.items.reduce((total, item) => total + (item.badge ?? 0), 0)

                                                    return (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "density-control-sm px-3 gap-1.5 text-[13px] font-medium transition-colors hover:bg-sidebar-accent/50",
                                                                "data-[state=open]:bg-sidebar-accent/70",
                                                                groupActive && "font-bold"
                                                            )}
                                                            style={groupActive ? toneStyles.activeStyle : {}}
                                                            aria-current={groupActive ? "page" : undefined}
                                                        >
                                                            <span className="truncate">{group.label}</span>
                                                            {groupBadge > 0 && (
                                                                <span className="min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground" aria-label={t('action_center.open_count', { count: groupBadge })}>
                                                                    {groupBadge > 99 ? '99+' : groupBadge}
                                                                </span>
                                                            )}
                                                            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                                        </Button>
                                                    )
                                                })()}
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-52 p-1.5">
                                                {group.items.map((item) => {
                                                    const active = isActive(item)
                                                    const toneStyles = getGroupToneStyles(group.id)
                                                    return (
                                                        <DropdownMenuItem
                                                            key={item.id}
                                                            asChild
                                                            className={cn(
                                                                "rounded-[calc(var(--radius)+2px)] transition-all duration-150",
                                                                active ? "font-bold" : "text-muted-foreground"
                                                            )}
                                                            style={active ? toneStyles.activeStyle : {}}
                                                        >
                                                            <Link to={item.href} className="flex items-center gap-2.5 w-full py-2">
                                                                <item.icon className={cn("h-4 w-4", active ? "text-inherit" : "text-muted-foreground/70")} />
                                                                <span>{item.label}</span>
                                                                {(item.badge ?? 0) > 0 && (
                                                                    <span className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
                                                                        {item.badge! > 99 ? '99+' : item.badge}
                                                                    </span>
                                                                )}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )
                                                })}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ))}
                                </nav>

                                {activeNavItem && !projectId && (
                                    <div className="hidden xl:flex min-w-0 items-center gap-2 rounded-[calc(var(--radius)+4px)] border border-sidebar-border bg-sidebar-accent/35 px-3 py-1.5 text-sm text-sidebar-foreground">
                                        <activeNavItem.icon className="h-4 w-4 shrink-0 text-primary" />
                                        <span className="truncate font-medium">{activeNavItem.label}</span>
                                        {(activeNavItem.badge ?? 0) > 0 && (
                                            <span className="min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
                                                {activeNavItem.badge! > 99 ? '99+' : activeNavItem.badge}
                                            </span>
                                        )}
                                    </div>
                                )}
                                
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                    onClick={() => setMobileNavOpen(true)}
                                    aria-label={t('common.navigation')}
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <QuickCreate activeProjectId={projectId} />
                            <button
                                type="button"
                                onClick={openCommandMenu}
                                aria-label={t('common.search')}
                                className="density-control hidden sm:flex w-[var(--density-control-height)] xl:w-48 items-center gap-2 rounded-[calc(var(--radius)+4px)] border border-sidebar-border bg-sidebar-accent/40 px-3 text-left text-sm text-sidebar-foreground transition-all hover:bg-sidebar-accent/60"
                                data-tour="global-search"
                            >
                                <Search className="h-4 w-4 shrink-0 opacity-50" />
                                <span className="hidden xl:block truncate text-sidebar-foreground/60">{t('common.search')}...</span>
                            </button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="hidden sm:inline-flex text-sidebar-foreground/70"
                                onClick={toggleCurrentFavorite}
                                aria-label={currentIsFavorite ? t("common.remove_favorite", "Favorilerden çıkar") : t("common.add_favorite", "Favorilere ekle")}
                                title={currentIsFavorite ? t("common.remove_favorite", "Favorilerden çıkar") : t("common.add_favorite", "Favorilere ekle")}
                                data-favorite-version={favoriteVersion}
                            >
                                <Star className={cn("h-4 w-4", currentIsFavorite && "fill-amber-400 text-amber-500")} />
                            </Button>

                            <NotificationCenter />
                            <HelpCenter projectContext={Boolean(projectId)} context={activeTab} role={user?.role} />
                            
                            <DropdownMenu>

                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="flex items-center gap-2 rounded-full border border-sidebar-border p-0.5 transition-all hover:bg-sidebar-accent/50"
                                        aria-label={t('common.my_account')}
                                        data-tour="account-menu"
                                    >
                                        <Avatar className="h-8 w-8 border border-sidebar-border">
                                            <AvatarImage src={user?.avatarUrl ? getImageUrl(user.avatarUrl) : ""} />
                                            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-medium text-xs">
                                                {user?.firstName?.[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <ChevronDown className="mr-1 h-3 w-3 opacity-50" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72 mt-1">
                                    <DropdownMenuLabel className="flex flex-col">
                                        <span className="text-sm font-semibold">{user?.firstName} {user?.lastName}</span>
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal mt-0.5">
                                            {t(`common.roles.${user?.role || 'TESTER'}`)}
                                        </span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link to="/profile" className="flex items-center gap-2 w-full">
                                            <Settings className="h-4 w-4" />
                                            {t('common.profile')}
                                        </Link>
                                    </DropdownMenuItem>
                                    
                                    <div className="flex items-center justify-between gap-3 px-2 py-2 mb-1">
                                        <div className="flex items-center gap-2">
                                            <Sun className="h-4 w-4 text-muted-foreground" />
                                            <Switch 
                                                checked={theme === "dark"}
                                                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                                            />
                                            <Moon className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <LanguageSwitcher />
                                    </div>

                                    <div className="border-t border-border px-2 py-2">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">{t('common.density.label')}</p>
                                        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted/60 p-1.5">
                                            {(["compact", "standard", "comfortable"] as const).map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => setDensity(option)}
                                                    className={cn(
                                                        "group flex min-w-0 flex-col items-center gap-2 rounded-md border px-1.5 py-2 text-[11px] font-medium transition-all",
                                                        density === option
                                                            ? "border-primary/35 bg-background text-foreground shadow-sm ring-1 ring-primary/10"
                                                            : "border-transparent text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground"
                                                    )}
                                                    aria-pressed={density === option}
                                                >
                                                    <span className="flex h-7 w-10 flex-col justify-center rounded border border-current/20 bg-card px-1" aria-hidden="true">
                                                        {[0, 1, 2].map((line) => (
                                                            <span
                                                                key={line}
                                                                className={cn(
                                                                    "block rounded-full bg-current opacity-45",
                                                                    option === "compact" ? "my-px h-px" : option === "comfortable" ? "my-[2px] h-1" : "my-[1.5px] h-0.5",
                                                                    line === 2 && "w-2/3"
                                                                )}
                                                            />
                                                        ))}
                                                    </span>
                                                    <span className="truncate">{t(`common.density.${option}`)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>


                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        {t('common.logout')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>

                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
                        <SheetHeader className="px-4 py-4 border-b border-sidebar-border flex-row items-center justify-between">
                            <SheetTitle className="text-left py-2">
                                <BrandLogo
                                    markClassName="h-8 w-8 rounded-[calc(var(--radius)+4px)] border border-sidebar-border shadow-sm"
                                    textClassName="text-lg font-bold tracking-[-0.03em] text-sidebar-foreground"
                                />
                            </SheetTitle>
                        </SheetHeader>
                        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
                            {navGroups.map((group) => (
                                <div key={group.id} className="space-y-3">
                                    <div className="px-1 py-1">
                                        <span
                                            className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                                            style={getGroupToneStyles(group.id).labelStyle}
                                        >
                                            {group.label}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {group.items.map((item) => {
                                            const active = isActive(item)
                                            const toneStyles = getGroupToneStyles(group.id)
                                            return (
                                                <Link
                                                    key={item.id}
                                                    to={item.href}
                                                    onClick={() => setMobileNavOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-[calc(var(--radius)+4px)] border px-3 py-2.5 text-sm font-medium transition-all duration-150",
                                                        active
                                                            ? "font-bold shadow-sm"
                                                            : "border-transparent text-sidebar-foreground/74 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                                    )}
                                                    style={active ? toneStyles.activeStyle : {}}
                                                >
                                                    <item.icon className="h-4.5 w-4.5" />
                                                    <span>{item.label}</span>
                                                    {(item.badge ?? 0) > 0 && (
                                                        <span className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
                                                            {item.badge! > 99 ? '99+' : item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </nav>
                        <div className="border-t border-sidebar-border p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2 px-2">
                                <div className="flex items-center gap-2">
                                    <Sun className="h-4.5 w-4.5 text-muted-foreground" />
                                    <Switch 
                                        checked={theme === "dark"}
                                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                                    />
                                    <Moon className="h-4.5 w-4.5 text-muted-foreground" />
                                </div>
                                <LanguageSwitcher />
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full justify-start gap-2 h-11"
                                onClick={() => {
                                    setMobileNavOpen(false)
                                    logout()
                                }}
                            >
                                <LogOut className="h-4.5 w-4.5" />
                                {t('common.logout')}
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>

                <GuidedTour projectContext={Boolean(projectId)} />

                <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 min-w-0">
                    <div className="sr-only" role="status" aria-live="polite">
                        {activeNavItem?.label ?? t("common.navigation")}
                    </div>
                    <div className="density-page-content flex-1 flex flex-col min-h-0 min-w-0 overflow-auto px-[var(--layout-gutter)]">
                        <AnimatePresence mode="wait">
                            <PageTransition key={location.pathname} className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
                                <Outlet />
                            </PageTransition>
                        </AnimatePresence>

                    </div>
                </main>
                <TimeTrackerWidget />
            </div>
        </TooltipProvider>
    )
}
