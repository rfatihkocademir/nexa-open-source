import { Bell, Trash2, CheckCheck, Inbox } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect } from "react"
import { socketService } from "@/services/socket.service"
import { projectService } from "@/services/project.service"
import { appRoutes, type ProjectTab } from "@/lib/routes"
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationService } from "@/services/notification.service"
import type { Notification, NotificationListResponse } from "@/services/notification.service"
import type { NotificationPayload } from "@/services/socket.service"
import { formatDistanceToNow } from "date-fns"
import { tr, enUS } from "date-fns/locale"

export function NotificationCenter() {
    const { t, i18n } = useTranslation()
    const token = useAuthStore((state) => state.token)
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const translateNotificationToken = (value: string, data?: Record<string, unknown>) => {
        if (i18n.exists(value)) return t(value, data)
        if (!value.includes('.')) return value

        return value
            .split('.')
            .pop()
            ?.replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, character => character.toUpperCase()) ?? value
    }

    // Query for notifications
    const { data } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationService.list(1, 100), // Fetch last 100 for now
        enabled: !!token,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    })

    const notifications = data?.notifications || []
    const unreadCount = data?.unreadCount || 0

    // Mutations
    const markReadMutation = useMutation({
        mutationFn: notificationService.markAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    const markAllReadMutation = useMutation({
        mutationFn: notificationService.markAllAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    const deleteMutation = useMutation({
        mutationFn: notificationService.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    // Socket connection
    useEffect(() => {
        if (token) {
            socketService.connect(token)

            const handleNotification = (payload: NotificationPayload) => {
                // Optimistically update cache
                queryClient.setQueryData<NotificationListResponse>(['notifications'], (old) => {
                    const base = old || { notifications: [], unreadCount: 0, total: 0, page: 1, totalPages: 1 }

                    const newNotification: Notification = {
                        id: payload.id || `local-${Date.now()}`,
                        title: payload.title,
                        message: payload.message,
                        type: payload.type === 'ERROR'
                            ? 'error'
                            : payload.type === 'CONFLICT_DETECTED'
                                ? 'warning'
                                : payload.type === 'INFO'
                                    ? 'info'
                                    : 'success',
                        read: false,
                        createdAt: payload.createdAt || new Date().toISOString(),
                        data: payload.data
                    }

                    return {
                        ...base,
                        notifications: [newNotification, ...base.notifications],
                        unreadCount: base.unreadCount + 1,
                        total: base.total + 1,
                        page: base.page || 1,
                        totalPages: base.totalPages || 1
                    }
                })

                const notificationType = payload.data?.type
                const projectId = payload.data?.projectId
                if (projectId && notificationType) {
                    if (['business-request-analyzed', 'business-request-needs-info', 'business-request-analysis-failed'].includes(notificationType)) {
                        queryClient.invalidateQueries({ queryKey: ['business-requests', projectId] })
                    }

                    if (['testcases-generated', 'testcases-generation-failed', 'testcases-queued'].includes(notificationType)) {
                        queryClient.invalidateQueries({ queryKey: ['stories'] })
                        queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] })
                        if (typeof payload.data?.storyId === 'string') {
                            queryClient.invalidateQueries({ queryKey: ['story-detail', payload.data.storyId] })
                        }
                    }

                    if (notificationType === 'epics-generated' || notificationType === 'needs-info') {
                        queryClient.invalidateQueries({ queryKey: ['business-requests', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['stories', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['agile-board', projectId] })
                        queryClient.invalidateQueries({ queryKey: ['board-items', projectId] })
                    }
                }
            }

            socketService.on('notification', handleNotification)

            return () => {
                socketService.off('notification', handleNotification)
                // Don't disconnect here as other components might use it
            }
        }
    }, [token, queryClient])

    const handleNotificationClick = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation()

        if (!notification.read) {
            markReadMutation.mutate(notification.id)
        }

        // Navigate based on data
        if (notification.data) {
            const projectId = typeof notification.data.projectId === "string" ? notification.data.projectId : undefined
            const project = projectId
                ? await queryClient.fetchQuery({
                    queryKey: ["project", projectId],
                    queryFn: () => projectService.getById(projectId),
                    staleTime: 5 * 60 * 1000,
                }).catch(() => null)
                : null
            const projectTarget = (tab: ProjectTab, params?: Record<string, string | undefined>) =>
                project ? appRoutes.projectTab(project.key, tab, params) : projectId ? `/projects/${projectId}?tab=${tab}` : appRoutes.projects()

            if (notification.data.testRunId) {
                navigate(`/runs/${notification.data.testRunId}`)
            } else if (typeof notification.data.requestId === "string" && projectId) {
                navigate(projectTarget("ai-analyst", { requestId: notification.data.requestId }))
            } else if (typeof notification.data.suiteId === "string" && projectId) {
                navigate(projectTarget("test-cases", { suiteId: notification.data.suiteId }))
            } else if (notification.data.type === 'testcases-queued' && projectId) {
                navigate(projectTarget("test-cases"))
            } else if (projectId) {
                navigate(project ? appRoutes.project(project.key) : `/projects/${projectId}`)
            } else if (notification.data.milestoneId) {
                navigate(`/milestones/${notification.data.milestoneId}`)
            }
        }
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        deleteMutation.mutate(id)
    }

    const dateLocale = i18n.language?.startsWith('tr') ? tr : enUS

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={t('notifications.title')} title={t('notifications.title')}>
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">{t('notifications.title')}</span>
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(380px,calc(100vw-2rem))]">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>{t('notifications.title')}</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto p-1 text-muted-foreground hover:text-primary gap-1"
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={markAllReadMutation.isPending}
                        >
                            <CheckCheck className="h-3 w-3" />
                            {t('notifications.mark_all_read')}
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                            <Bell className="h-8 w-8 opacity-20" />
                            {t('notifications.empty')}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className={`flex flex-col items-start p-4 cursor-pointer border-b last:border-0 relative group focus:bg-accent ${!notification.read ? 'bg-muted/30' : ''}`}
                                    onClick={(e) => handleNotificationClick(notification, e)}
                                >
                                    <div className="flex items-start justify-between w-full gap-2">
                                        <span className={`font-semibold text-sm leading-none ${notification.type === 'warning' ? 'text-warning' :
                                            notification.type === 'success' ? 'text-success' :
                                                notification.type === 'error' ? 'text-destructive' :
                                                    'text-info'
                                            }`}>
                                            {translateNotificationToken(notification.title) as React.ReactNode}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateLocale })}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed pr-6">
                                        {(() => {
                                            const data = notification.data ? { ...notification.data } : {};
                                            if (typeof data.dueDate === "string" || typeof data.dueDate === "number") {
                                                data.dueDate = new Date(data.dueDate).toLocaleDateString(i18n.language);
                                            }
                                            return translateNotificationToken(notification.message, data) as React.ReactNode;
                                        })()}
                                    </p>

                                    {!notification.read && (
                                        <div className="absolute left-1 top-4 h-1 w-1 rounded-full bg-primary" />
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                                        onClick={(e) => handleDelete(e, notification.id)}
                                        aria-label={t('notifications.delete')}
                                        title={t('notifications.delete')}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                        <span className="sr-only">{t('notifications.delete')}</span>
                                    </Button>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center gap-2 py-2.5 font-medium text-primary" onSelect={() => navigate('/inbox')}>
                    <Inbox className="h-4 w-4" />
                    {t('notifications.open_action_center')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
