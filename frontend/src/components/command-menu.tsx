import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Command } from "cmdk"
import {
    User, LayoutDashboard, LogOut, PlusCircle,
    FolderKanban, Folder, FileCode, Flag,
    Loader2, Search, Bug, CalendarClock, Clock3, Star, PlayCircle, ListTodo, Inbox, PanelsTopLeft
} from "lucide-react"
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next"
import { dashboardService, type SearchResult } from "@/services/dashboard.service"
import { appRoutes } from "@/lib/routes"
import { openQuickCreate } from "@/lib/quick-create-events"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    getFavoriteLocations,
    getRecentLocations,
    USER_NAVIGATION_CHANGED_EVENT,
    type UserNavigationEntry,
} from "@/lib/user-navigation"

const typeConfig: Record<SearchResult["type"], {
    icon: typeof FolderKanban
    color: string
    labelKey: string
}> = {
    PROJECT: { icon: FolderKanban, color: "text-blue-500", labelKey: "command_menu.category.projects" },
    SUITE: { icon: Folder, color: "text-yellow-500", labelKey: "command_menu.category.suites" },
    CASE: { icon: FileCode, color: "text-emerald-500", labelKey: "command_menu.category.cases" },
    MILESTONE: { icon: Flag, color: "text-orange-500", labelKey: "command_menu.category.milestones" },
    RUN: { icon: PlayCircle, color: "text-cyan-500", labelKey: "command_menu.category.runs" },
    WORK_ITEM: { icon: ListTodo, color: "text-indigo-500", labelKey: "command_menu.category.work_items" },
}

export function CommandMenu() {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = React.useState(false)
    const [favoriteLocations, setFavoriteLocations] = React.useState<UserNavigationEntry[]>([])
    const [recentLocations, setRecentLocations] = React.useState<UserNavigationEntry[]>([])
    const navigate = useNavigate()
    const logout = useAuthStore((state) => state.logout)
    const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    React.useEffect(() => {
        const openHandler = () => setOpen(true)
        const toggleHandler = () => setOpen((prev) => !prev)

        window.addEventListener("command-menu:open", openHandler)
        window.addEventListener("command-menu:toggle", toggleHandler)

        return () => {
            window.removeEventListener("command-menu:open", openHandler)
            window.removeEventListener("command-menu:toggle", toggleHandler)
        }
    }, [])

    React.useEffect(() => {
        const refreshNavigationMemory = () => {
            setFavoriteLocations(getFavoriteLocations())
            setRecentLocations(getRecentLocations())
        }
        refreshNavigationMemory()
        window.addEventListener(USER_NAVIGATION_CHANGED_EVENT, refreshNavigationMemory)
        return () => window.removeEventListener(USER_NAVIGATION_CHANGED_EVENT, refreshNavigationMemory)
    }, [])

    // Reset on close
    React.useEffect(() => {
        if (!open) {
            setQuery("")
            setResults([])
            setIsSearching(false)
        }
    }, [open])

    // Debounced search
    React.useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (query.trim().length < 2) {
            setResults([])
            setIsSearching(false)
            return
        }

        setIsSearching(true)
        debounceRef.current = setTimeout(async () => {
            try {
                const data = await dashboardService.globalSearch(query)
                setResults(data)
            } catch {
                setResults([])
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query])

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false)
        command()
    }, [])

    // Group results by type
    const groupedResults = React.useMemo(() => {
        const groups = new Map<SearchResult["type"], SearchResult[]>()
        for (const r of results) {
            const list = groups.get(r.type) || []
            list.push(r)
            groups.set(r.type, list)
        }
        return groups
    }, [results])

    const hasQuery = query.trim().length >= 2
    const resultPath = (item: SearchResult) => {
        const key = typeof item.meta?.key === "string" ? item.meta.key : undefined
        if (key && item.type === "PROJECT") return appRoutes.project(key)
        if (key && (item.type === "CASE" || item.type === "MILESTONE" || item.type === "RUN" || item.type === "WORK_ITEM")) return appRoutes.resource(key)
        return item.path
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-[640px] gap-0 overflow-hidden p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>{t('command_menu.label')}</DialogTitle>
                    <DialogDescription>{t('command_menu.placeholder')}</DialogDescription>
                </DialogHeader>
                <Command shouldFilter={!hasQuery} className="w-full bg-popover">
            <div className="flex items-center border-b px-3 gap-2" cmdk-input-wrapper="">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Command.Input
                    placeholder={t('command_menu.placeholder')}
                    value={query}
                    onValueChange={setQuery}
                    className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
                {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
                    ESC
                </kbd>
            </div>
            <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                    {isSearching ? t('command_menu.searching') : t('command_menu.no_results')}
                </Command.Empty>

                {/* Search results */}
                {hasQuery && Array.from(groupedResults.entries()).map(([type, items]) => {
                    const config = typeConfig[type]
                    return (
                        <Command.Group
                            key={type}
                            heading={t(config.labelKey)}
                            className="text-xs font-medium text-muted-foreground px-2 py-1.5"
                        >
                            {items.map((item) => {
                                const Icon = config.icon
                                return (
                                    <Command.Item
                                        key={item.id}
                                        value={`${item.type}-${item.name}-${item.id}`}
                                        onSelect={() => runCommand(() => navigate(resultPath(item)))}
                                        className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground gap-3"
                                    >
                                        <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="truncate font-medium">{item.name}</span>
                                            {item.detail && (
                                                <span className="text-xs text-muted-foreground truncate">{item.detail}</span>
                                            )}
                                        </div>
                                        {typeof item.meta?.status === 'string' && (
                                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                                {item.meta.status}
                                            </span>
                                        )}
                                    </Command.Item>
                                )
                            })}
                        </Command.Group>
                    )
                })}

                {/* Static shortcuts (when no search query) */}
                {!hasQuery && (
                    <>
                        <Command.Group heading={t('quick_create.title', 'Hızlı oluştur')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                            <Command.Item
                                value="quick-create-task"
                                onSelect={() => runCommand(() => openQuickCreate("TASK"))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                <span>{t('quick_create.task', 'Geliştirme işi')}</span>
                            </Command.Item>
                            <Command.Item
                                value="quick-create-bug"
                                onSelect={() => runCommand(() => openQuickCreate("BUG"))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <Bug className="mr-2 h-4 w-4 text-destructive" />
                                <span>{t('quick_create.bug', 'Bug')}</span>
                            </Command.Item>
                            <Command.Item
                                value="quick-create-activity"
                                onSelect={() => runCommand(() => openQuickCreate("ACTIVITY"))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <CalendarClock className="mr-2 h-4 w-4" />
                                <span>{t('quick_create.activity', 'Operasyon / aktivite')}</span>
                            </Command.Item>
                        </Command.Group>

                        {favoriteLocations.length > 0 && (
                            <Command.Group heading={t('common.favorites', 'Favoriler')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                                {favoriteLocations.slice(0, 6).map((entry) => (
                                    <Command.Item
                                        key={entry.path}
                                        value={`favorite-${entry.label}-${entry.path}`}
                                        onSelect={() => runCommand(() => navigate(entry.path))}
                                        className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                                    >
                                        <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-500" />
                                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                                        {entry.context && <span className="ml-3 max-w-32 truncate text-[10px] text-muted-foreground">{entry.context}</span>}
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {recentLocations.length > 0 && (
                            <Command.Group heading={t('common.recently_visited', 'Son ziyaret edilenler')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                                {recentLocations.slice(0, 6).map((entry) => (
                                    <Command.Item
                                        key={entry.path}
                                        value={`recent-${entry.label}-${entry.path}`}
                                        onSelect={() => runCommand(() => navigate(entry.path))}
                                        className="relative flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                                    >
                                        <Clock3 className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                                        {entry.context && <span className="ml-3 max-w-32 truncate text-[10px] text-muted-foreground">{entry.context}</span>}
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        <Command.Group heading={t('command_menu.suggestions')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                            <Command.Item
                                value="dashboard"
                                onSelect={() => runCommand(() => navigate("/dashboard"))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                <span>{t('command_menu.dashboard')}</span>
                            </Command.Item>
                            <Command.Item
                                value={`${t('action_center.nav')} action-center`}
                                keywords={[t('action_center.description'), 'inbox', 'aksiyon', 'eylem', 'risk']}
                                onSelect={() => runCommand(() => navigate(appRoutes.inbox()))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <Inbox className="mr-2 h-4 w-4" />
                                <span>{t('action_center.nav')}</span>
                            </Command.Item>
                            <Command.Item
                                value={`${t('dashboard_studio.nav')} dashboard-studio`}
                                keywords={[t('dashboard_studio.description'), 'panel', 'özelleştir', 'widget', 'dashboard']}
                                onSelect={() => runCommand(() => navigate(appRoutes.dashboards()))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <PanelsTopLeft className="mr-2 h-4 w-4" />
                                <span>{t('dashboard_studio.nav')}</span>
                            </Command.Item>
                            <Command.Item
                                value="create-project"
                                onSelect={() => runCommand(() => {
                                    sessionStorage.setItem('openCreateProjectDialog', 'true')
                                    navigate("/projects")
                                })}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                <span>{t('command_menu.create_project')}</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Group heading={t('command_menu.settings')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                            <Command.Item
                                value="profile"
                                onSelect={() => runCommand(() => navigate("/settings"))}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <User className="mr-2 h-4 w-4" />
                                <span>{t('command_menu.profile')}</span>
                            </Command.Item>
                            <Command.Item
                                value="logout"
                                onSelect={() => runCommand(() => logout())}
                                className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>{t('command_menu.logout')}</span>
                            </Command.Item>
                        </Command.Group>
                    </>
                )}
            </Command.List>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span>↑↓</span>
                    <span>{t('command_menu.navigate')}</span>
                    <span className="ml-2">↵</span>
                    <span>{t('command_menu.select')}</span>
                </div>
                <span className="text-[10px] opacity-60">{t('common.brand_name')}</span>
            </div>
                </Command>
            </DialogContent>
        </Dialog>
    )
}
