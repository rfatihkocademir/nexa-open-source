import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, AlertCircle, PlayCircle, Archive, HelpCircle, type LucideIcon } from "lucide-react"
import type { ResultStatus, RunStatus } from "@/types/testRun"

interface StatusBadgeProps {
    status: ResultStatus | RunStatus | string
    className?: string
    showIcon?: boolean
}

import { useTranslation } from "react-i18next"

export const StatusBadge = ({ status, className, showIcon = true }: StatusBadgeProps) => {
    const { t } = useTranslation()
    const config: Record<string, { variant: "success" | "destructive" | "warning" | "info" | "secondary" | "outline"; icon: LucideIcon }> = {
        PASS: { variant: "success", icon: CheckCircle2 },
        FAIL: { variant: "destructive", icon: AlertCircle },
        BLOCK: { variant: "warning", icon: AlertCircle },
        BLOCKED: { variant: "warning", icon: AlertCircle },
        SKIPPED: { variant: "secondary", icon: HelpCircle },
        UNTESTED: { variant: "secondary", icon: Clock },
        OPEN: { icon: PlayCircle, variant: "info" },
        COMPLETED: { icon: CheckCircle2, variant: "success" },
        ARCHIVED: { icon: Archive, variant: "outline" },
        ACTIVE: { icon: CheckCircle2, variant: "success" },
        LOW: { variant: "outline", icon: HelpCircle },
        MEDIUM: { variant: "warning", icon: AlertCircle },
        HIGH: { variant: "destructive", icon: AlertCircle },
        CRITICAL: { variant: "destructive", icon: AlertCircle },
    }

    const { variant, icon: Icon } = config[status] || { variant: "outline", icon: HelpCircle }

    return (
        <Badge variant={variant} className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", className)}>
            {showIcon && Icon && <Icon className="h-3 w-3" />}
            {t(`common.statuses.${status}`, { defaultValue: status })}
        </Badge>
    )
}
