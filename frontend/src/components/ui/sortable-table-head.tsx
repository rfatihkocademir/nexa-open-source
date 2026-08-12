import type { ReactNode } from "react"
import type { ThHTMLAttributes } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc" | null

interface SortableTableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
    sortKey: string
    activeSortKey?: string
    direction?: SortDirection
    onSort?: (sortKey: string) => void
    sortable?: boolean
    children: ReactNode
}

/** Shared sortable header used by both client- and server-side list tables. */
export function SortableTableHead({
    sortKey,
    activeSortKey,
    direction,
    onSort,
    sortable = true,
    children,
    className,
    ...props
}: SortableTableHeadProps) {
    const isActive = activeSortKey === sortKey
    const isSortable = sortable && Boolean(onSort)

    return (
        <TableHead
            {...props}
            aria-sort={isActive ? direction === "asc" ? "ascending" : "descending" : isSortable ? "none" : undefined}
            className={cn("whitespace-nowrap", className)}
        >
            {isSortable ? (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSort?.(sortKey)}
                    className="h-8 max-w-full justify-start gap-2 px-2 text-left text-[inherit] font-[inherit] uppercase tracking-[inherit] hover:bg-primary/5 hover:text-primary"
                >
                    <span className="truncate">{children}</span>
                    {isActive && direction === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : isActive && direction === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                        {isActive && direction === "asc" ? " (artan)" : isActive && direction === "desc" ? " (azalan)" : " (sıralanabilir)"}
                    </span>
                </Button>
            ) : children}
        </TableHead>
    )
}
