import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { testRunService } from "@/services/testRun.service"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

import { useTranslation } from "react-i18next"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

interface TestRunConflictsProps {
    runId: string
}

export function TestRunConflicts({ runId }: TestRunConflictsProps) {
    const { t } = useTranslation()
    const [sortBy, setSortBy] = useState("testCase")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const { data: conflicts, isLoading } = useQuery({
        queryKey: ["test-run-conflicts", runId],
        queryFn: () => testRunService.getConflicts(runId),
    })

    const sortedConflicts = useMemo(() => [...(conflicts ?? [])].sort((left, right) => {
        const valueFor = (item: NonNullable<typeof conflicts>[number]) => {
            if (sortBy === "manualStatus") return item.manualStatus
            if (sortBy === "automationStatus") return item.automationStatus
            if (sortBy === "finalStatus") return item.finalStatus
            return item.testCase.title
        }
        const result = String(valueFor(left)).localeCompare(String(valueFor(right)))
        return sortOrder === "asc" ? result : -result
    }), [conflicts, sortBy, sortOrder])

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setSortBy(field)
        setSortOrder("asc")
    }

    if (isLoading) {
        return <Skeleton className="h-40 w-full" />
    }

    if (!conflicts || conflicts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/10 py-16 text-center">
                <div className="mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-success/20 bg-success/10">
                        <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('test_run_comparison.conflicts_title')}</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    {t('test_run_comparison.conflicts_desc')}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-warning/20 bg-warning/10 p-4 text-warning">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                    {t('test_run_comparison.conflicts_found', { count: conflicts.length })}
                </span>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead sortKey="testCase" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('test_run_comparison.test_case')}</SortableTableHead>
                            <SortableTableHead sortKey="manualStatus" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('test_run_comparison.manual_status')}</SortableTableHead>
                            <SortableTableHead sortKey="automationStatus" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('test_run_comparison.automation_status')}</SortableTableHead>
                            <SortableTableHead sortKey="finalStatus" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('test_run_comparison.final_status')}</SortableTableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedConflicts.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.testCase.title}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getStatusColor(item.manualStatus)}>
                                        {item.manualStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getStatusColor(item.automationStatus)}>
                                        {item.automationStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getStatusColor(item.finalStatus)}>
                                        {item.finalStatus}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function getStatusColor(status: string) {
    switch (status) {
        case 'PASS': return "bg-green-100 text-green-800"
        case 'FAIL': return "bg-red-100 text-red-800"
        case 'BLOCKED': return "bg-orange-100 text-orange-800"
        default: return "bg-gray-100 text-gray-800"
    }
}
