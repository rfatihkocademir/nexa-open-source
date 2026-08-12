import * as React from "react"

import { cn } from "@/lib/utils"

type PageMetricTone = "neutral" | "primary" | "success" | "warning" | "danger"

const metricToneStyles: Record<PageMetricTone, { card: string; label: string; icon: string }> = {
    neutral: {
        card: "border-border/75 bg-background/88",
        label: "text-muted-foreground",
        icon: "border-border/75 bg-background text-muted-foreground",
    },
    primary: {
        card: "border-primary/18 bg-primary/6",
        label: "text-primary/85",
        icon: "border-primary/18 bg-primary/8 text-primary",
    },
    success: {
        card: "border-success/20 bg-success/8",
        label: "text-success/90",
        icon: "border-success/20 bg-success/8 text-success",
    },
    warning: {
        card: "border-warning/20 bg-warning/8",
        label: "text-warning/90",
        icon: "border-warning/20 bg-warning/8 text-warning",
    },
    danger: {
        card: "border-destructive/20 bg-destructive/8",
        label: "text-destructive/90",
        icon: "border-destructive/20 bg-destructive/8 text-destructive",
    },
}

interface PageHeroProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
    eyebrow?: React.ReactNode
    title?: React.ReactNode
    description?: React.ReactNode
    actions?: React.ReactNode
    children?: React.ReactNode
}

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
    title?: React.ReactNode
    description?: React.ReactNode
    actions?: React.ReactNode
    meta?: React.ReactNode
}


export function PageHeader({
    title,
    description,
    actions,
    meta,
    className,
    ...props
}: PageHeaderProps) {
    return (
        <section
            className={cn("border-b border-border/75 pb-5", className)}
            {...props}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-enterprise-header text-2xl leading-8">
                        {title}
                    </h1>
                    {description ? (
                        <p className="text-enterprise-muted max-w-3xl">
                            {description}
                        </p>
                    ) : null}
                    {meta ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                            {meta}
                        </div>
                    ) : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </section>
    )
}

export function PageHero({
    eyebrow,
    title,
    description,
    actions,
    children,
    className,
    ...props
}: PageHeroProps) {
    return (
        <section
            className={cn("relative border-b border-border/75 pb-5 sm:pb-6", className)}
            {...props}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2.5">
                    {eyebrow ? (
                        <div className="inline-flex w-fit items-center rounded-md border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-xs font-semibold text-primary">
                            {eyebrow}
                        </div>
                    ) : null}
                    <div className="space-y-2">
                        {title ? (
                            <h1 className="text-enterprise-header text-2xl leading-8">
                                {title}
                            </h1>
                        ) : null}
                        {description ? (
                            <div className="text-enterprise-muted max-w-3xl sm:text-[15px]">
                                {description}
                            </div>
                        ) : null}
                    </div>

                </div>

                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>

            {children ? <div className="mt-5">{children}</div> : null}
        </section>
    )
}

interface PageMetricGridProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

export function PageMetricGrid({ children, className, ...props }: PageMetricGridProps) {
    return (
        <div
            className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
            {...props}
        >
            {children}
        </div>
    )
}

interface PageMetricProps extends React.HTMLAttributes<HTMLDivElement> {
    label: React.ReactNode
    value: React.ReactNode
    hint?: React.ReactNode
    tone?: PageMetricTone
    icon?: React.ElementType
}

export function PageMetric({
    label,
    value,
    hint,
    tone = "neutral",
    icon: Icon,
    className,
    ...props
}: PageMetricProps) {
    const styles = metricToneStyles[tone]

    return (
        <div
            className={cn("rounded-[var(--radius-card)] border p-4 shadow-sm interactive-surface", styles.card, className)}
            {...props}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={cn("text-xs font-medium", styles.label)}>
                        {label}
                    </p>
                    <p className="mt-1.5 text-enterprise-header text-2xl leading-8 tabular-nums">
                        {value}
                    </p>
                    {hint ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {hint}
                        </p>
                    ) : null}
                </div>

                {Icon ? (
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[calc(var(--radius)+2px)] border shadow-sm", styles.icon)}>
                        <Icon className="h-4 w-4" />
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export function PageToolbar({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    return (
        <section
            className={cn("relative overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-card px-4 py-3 shadow-sm sm:px-5", className)}
            {...props}
        >
            {children}
        </section>
    )
}

interface PageLoadingProps {
    hasHero?: boolean
    metricCount?: number
}

export function PageLoading({ hasHero = false, metricCount = 4 }: PageLoadingProps) {
    return (
        <div className="page-stack animate-pulse">
            <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                {hasHero && (
                    <div className="mb-6 space-y-3">
                        <div className="h-4 w-32 rounded bg-muted" />
                        <div className="h-9 w-72 rounded bg-muted" />
                        <div className="h-4 w-[520px] max-w-full rounded bg-muted" />
                    </div>
                )}
                {!hasHero && (
                    <div className="space-y-3">
                        <div className="h-8 w-64 rounded bg-muted" />
                        <div className="h-4 w-96 max-w-full rounded bg-muted" />
                    </div>
                )}
                {metricCount > 0 && (
                    <div className={cn("mt-5 grid gap-3 sm:grid-cols-2", metricCount > 2 ? "xl:grid-cols-4" : "xl:grid-cols-2")}>
                        {Array.from({ length: metricCount }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-border/70 bg-background/80 p-4">
                                <div className="h-3 w-20 rounded bg-muted" />
                                <div className="mt-2 h-7 w-14 rounded bg-muted" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="h-[460px] w-full rounded-xl border border-border/70 bg-card/50" />
        </div>
    )
}

interface PageAsideProps {
    children: React.ReactNode
    title?: string
    className?: string
}

export function PageAside({ children, title, className }: PageAsideProps) {
    return (
        <aside className={cn("rounded-xl border border-border/70 bg-card p-5 shadow-sm", className)}>
            {title && (
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {title}
                </h3>
            )}
            <div className="space-y-4">
                {children}
            </div>
        </aside>
    )
}

interface PageAsideItemProps {
    label: string
    children: React.ReactNode
    className?: string
}

export function PageAsideItem({ label, children, className }: PageAsideItemProps) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <label className="text-xs text-muted-foreground">{label}</label>
            {children}
        </div>
    )
}
