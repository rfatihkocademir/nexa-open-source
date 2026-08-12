import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps {
    icon?: LucideIcon
    title: string
    description?: string
    action?: {
        label: string
        onClick: () => void
    }
    className?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({
    className,
    icon: Icon = SearchX,
    title,
    description,
    action,
}) => {
    return (
        <div className={cn("flex flex-col items-center justify-center px-4 py-16 text-center", className)}>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted/50">
                <Icon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            </div>

            <h3 className="mb-2 text-base font-semibold text-foreground">
                {title}
            </h3>

            {description && (
                <p className="mb-6 max-w-sm text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            )}

            {action && (
                <div>
                    <Button onClick={action.onClick} size="sm" className="h-9 px-4">
                        {action.label}
                    </Button>
                </div>
            )}
        </div>
    )
}
EmptyState.displayName = "EmptyState"

export { EmptyState }
