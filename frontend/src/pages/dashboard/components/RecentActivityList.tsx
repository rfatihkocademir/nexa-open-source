import { useQuery } from "@tanstack/react-query"
import { dashboardService, type RecentActivity } from "@/services/dashboard.service"
import { useTranslation } from "react-i18next"
import { PlayCircle, FileEdit, FlaskConical, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const activityConfig: Record<RecentActivity["type"], {
    icon: typeof PlayCircle
    color: string
    bgColor: string
    labelKey: string
}> = {
    RUN_CREATED: {
        icon: PlayCircle,
        color: "text-primary",
        bgColor: "bg-primary/10",
        labelKey: "dashboard.activity.run_created",
    },
    TEST_EXECUTED: {
        icon: FlaskConical,
        color: "text-success",
        bgColor: "bg-success/10",
        labelKey: "dashboard.activity.test_executed",
    },
    CASE_UPDATED: {
        icon: FileEdit,
        color: "text-info",
        bgColor: "bg-info/10",
        labelKey: "dashboard.activity.case_updated",
    },
}

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return t("dashboard.activity.just_now")
    if (diffMin < 60) return t("dashboard.activity.minutes_ago", { count: diffMin })
    if (diffHour < 24) return t("dashboard.activity.hours_ago", { count: diffHour })
    if (diffDay < 7) return t("dashboard.activity.days_ago", { count: diffDay })
    try {
        return date.toLocaleDateString(t("common.language_code") === "tr" ? "tr-TR" : "en-US")
    } catch {
        return date.toLocaleDateString()
    }
}

export function RecentActivityList() {
    const { t } = useTranslation()

    const { data: activities, isLoading } = useQuery({
        queryKey: ["dashboard", "recent-activities"],
        queryFn: () => dashboardService.getRecentActivities(),
        refetchInterval: () => document.visibilityState === 'visible' ? 30_000 : false,
        refetchIntervalInBackground: false,
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!activities || activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                    {t("dashboard.no_activity")}
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto pr-1">
            {activities.map((activity, index) => {
                const config = activityConfig[activity.type]
                const Icon = config.icon
                return (
                    <div
                        key={activity.id}
                        className={cn(
                            "flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50",
                            index === 0 && "bg-muted/30"
                        )}
                    >
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.bgColor)}>
                            <Icon className={cn("h-4 w-4", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", config.bgColor, config.color)}>
                                    {t(config.labelKey)}
                                </span>
                                {typeof activity.meta?.status === 'string' && (
                                    <StatusBadge status={activity.meta.status} />
                                )}
                            </div>
                            <p className="text-sm font-medium truncate leading-tight">
                                {activity.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground truncate">
                                    {activity.user}
                                </span>
                                <span className="text-xs text-muted-foreground/50">•</span>
                                <span className="text-xs text-muted-foreground/70 shrink-0">
                                    {timeAgo(activity.timestamp, t)}
                                </span>
                            </div>
                            {activity.project && (
                                <span className="inline-block mt-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {activity.project}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const { t } = useTranslation()
    const colorMap: Record<string, string> = {
        PASS: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
        FAIL: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
        BLOCKED: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
        OPEN: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
        CLOSED: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
    }
    const colorClass = colorMap[status] || "text-muted-foreground bg-muted"
    return (
        <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded", colorClass)}>
            {t(`common.statuses.${status}`, { defaultValue: status })}
        </span>
    )
}
