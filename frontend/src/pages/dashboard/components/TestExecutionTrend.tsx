import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from "recharts"
import { useQuery } from "@tanstack/react-query"
import { dashboardService } from "@/services/dashboard.service"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTranslation } from "react-i18next"

export function TestExecutionTrend() {
    const { t } = useTranslation()
    const isMobile = useIsMobile()
    const { data: summary, isLoading } = useQuery({
        queryKey: ["dashboard", "execution-summary"],
        queryFn: dashboardService.getExecutionSummary,
    })

    const chartData = [
        { name: 'Passed', label: t('report_details.statuses.Passed'), value: summary?.passed ?? 0, color: 'var(--success)' },
        { name: 'Failed', label: t('report_details.statuses.Failed'), value: summary?.failed ?? 0, color: 'var(--error)' },
        { name: 'Blocked', label: t('report_details.statuses.Blocked'), value: summary?.blocked ?? 0, color: 'var(--warning)' },
        { name: 'Skipped', label: t('report_details.statuses.Skipped'), value: summary?.skipped ?? 0, color: 'var(--muted-foreground)' },
    ].filter(item => item.value > 0)

    if (isLoading) {
        return <Skeleton className="w-full h-full rounded-lg" />
    }

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('dashboard.no_test_data')}
            </div>
        )
    }

    return (
        <div className="flex h-full min-w-0 w-full flex-col gap-4 overflow-hidden">
            <div className="min-h-[300px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <defs>
                        <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
                            <stop offset="100%" stopColor="var(--success)" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--error)" stopOpacity={1} />
                            <stop offset="100%" stopColor="var(--error)" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--warning)" stopOpacity={1} />
                            <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="skippedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={1} />
                            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.6} />
                        </linearGradient>
                    </defs>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy={isMobile ? "44%" : "48%"}
                        innerRadius={isMobile ? 48 : 70}
                        outerRadius={isMobile ? 72 : 95}
                        paddingAngle={isMobile ? 5 : 8}
                        dataKey="value"
                        nameKey="label"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => {
                            const gradientId = `${entry.name.toLowerCase()}Gradient`
                            return <Cell key={`cell-${index}`} fill={`url(#${gradientId})`} />
                        })}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(var(--header-rgb), 0.8)",
                            backdropFilter: "blur(8px)",
                            borderColor: "var(--border)",
                            borderRadius: "16px",
                            boxShadow: "var(--shadow-lg)"
                        }}
                        itemStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                    />
                </PieChart>
            </ResponsiveContainer>
            </div>
 
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {chartData.map((item) => (
                    <div
                        key={item.name}
                        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                        <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span>{item.label}</span>
                        <span className="text-foreground">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
