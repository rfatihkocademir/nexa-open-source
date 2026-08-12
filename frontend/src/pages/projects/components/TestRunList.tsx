import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { PlayCircle, Plus } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import { testRunService } from "@/services/testRun.service"
import { CreateTestRunDialog } from "./CreateTestRunDialog"
import { useTranslation } from "react-i18next"
import { getColumns } from "./test-runs-columns"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/queryKeys"
import { PaginationControls } from "@/components/ui/pagination-controls"

interface TestRunListProps {
    projectId: string
}

export function TestRunList({ projectId }: TestRunListProps) {
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const [page, setPage] = useState(1)
    const aiFocus = searchParams.get('aiFocus')
    const { data: testRuns, isLoading } = useQuery({
        queryKey: [...queryKeys.testRuns(projectId), page],
        queryFn: () => testRunService.getAll(projectId, false, page, 20),
        placeholderData: (previousData) => previousData,
    })

    const columns = getColumns(t)
    const filteredRuns = useMemo(() => {
        const runs = testRuns?.data || []
        if (aiFocus === 'open-runs') {
            return runs.filter((run) => run.status === 'OPEN')
        }
        if (aiFocus === 'failed-runs') {
            return runs.filter((run) => run.failedCount > 0 || run.blockedCount > 0)
        }
        if (aiFocus === 'conflicts') {
            return runs.filter((run) => run.items?.some((item) => item.finalStatus === 'CONFLICT'))
        }
        return runs
    }, [aiFocus, testRuns?.data])

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight">{t('test_run_list.title')}</h3>
                    {aiFocus && (
                        <p className="text-xs text-muted-foreground">
                            {t('test_run_list.ai_focus', { focus: aiFocus.replace(/-/g, ' ') })}
                        </p>
                    )}
                </div>
                {filteredRuns.length > 0 && <CreateTestRunDialog projectId={projectId} />}
            </div>
            {filteredRuns.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card p-12 text-center shadow-sm glass-card flex flex-col items-center justify-center min-h-[350px]">
                    <EmptyState
                        icon={PlayCircle}
                        title={t("test_runs.no_runs_found")}
                        description={t("test_runs.no_runs_desc")}
                        className="py-6"
                    />
                    <div className="mt-2">
                        <CreateTestRunDialog
                            projectId={projectId}
                            trigger={
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t("test_runs.create_first_run")}
                                </Button>
                            }
                        />
                    </div>
                </div>
            ) : (
                <DataTable columns={columns} data={filteredRuns} />
            )}
            <PaginationControls
                currentPage={testRuns?.meta.page ?? page}
                totalPages={testRuns?.meta.totalPages ?? 1}
                onPageChange={setPage}
            />
        </div>
    )
}
