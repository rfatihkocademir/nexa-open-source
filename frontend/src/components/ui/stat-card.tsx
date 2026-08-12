import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: LucideIcon
    title: string
    value: string | number
    variant?: "primary" | "info" | "success" | "warning" | "error"
    trend?: {
        value: number
        label?: string
    }
}

const variantStyles = {
    primary: {
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
    },
    info: {
        iconBg: "bg-info/10",
        iconColor: "text-info",
    },
    success: {
        iconBg: "bg-success/10",
        iconColor: "text-success",
    },
    warning: {
        iconBg: "bg-warning/10",
        iconColor: "text-warning",
    },
    error: {
        iconBg: "bg-error/10",
        iconColor: "text-error",
    },
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
    ({ className, icon: Icon, title, value, variant = "primary", trend, ...props }, ref) => {
        const styles = variantStyles[variant]

        return (
            <div
                ref={ref}
                className={cn(
                    "group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm interactive-surface",
                    className
                )}
                {...props}
            >
                {/* Background Icon */}
                <div className="absolute right-0 top-0 p-4 opacity-[0.035] transition-opacity duration-200 group-hover:opacity-[0.06]">
                    <Icon className={cn("h-24 w-24", styles.iconColor)} />
                </div>

                {/* Content */}
                <div className="flex items-center gap-4 relative z-10">
                    <div
                        className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-lg",
                            styles.iconBg,
                            styles.iconColor
                        )}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {title}
                        </p>
                        <h3 className="text-2xl font-semibold text-tabular font-heading">
                            {value}
                        </h3>
                        {trend && (
                            <p className={cn(
                                "text-xs font-medium mt-1",
                                trend.value >= 0 ? "text-success" : "text-error"
                            )}>
                                {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                                {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )
    }
)
StatCard.displayName = "StatCard"

export { StatCard }
