import { useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Calendar, Flag, CheckCircle2, XCircle, AlertCircle, Clock, ArrowRight, Folder } from "lucide-react"
import { AppBreadcrumbs } from "@/components/navigation/Breadcrumbs"


import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { milestoneService } from "@/services/milestone.service"
import { StatusBadge } from "@/components/ui/status-badge"
import { CreateMilestoneDialog } from "./components/CreateMilestoneDialog"
import { useTranslation } from "react-i18next"
import { PageBackButton } from "@/components/navigation/PageBackButton"
import { appRoutes } from "@/lib/routes"
import { useAppDialog } from "@/components/ui/app-dialog-context"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

export default function MilestoneDetailsPage({ resourceId, resourceProjectKey }: { resourceId?: string; resourceProjectKey?: string } = {}) {
    const { t, i18n } = useTranslation()
    const { confirm } = useAppDialog()
    const { milestoneId: routeMilestoneId } = useParams<{ milestoneId: string }>()
    const milestoneId = resourceId ?? routeMilestoneId
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [sortBy, setSortBy] = useState("createdAt")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

    const { data: milestone, isLoading } = useQuery({
        queryKey: ["milestone", milestoneId],
        queryFn: () => milestoneService.getById(milestoneId!),
        enabled: !!milestoneId,
    })

    const sortedRuns = useMemo(() => [...(milestone?.testRuns ?? [])].sort((left, right) => {
        const valueFor = (run: NonNullable<NonNullable<typeof milestone>["testRuns"]>[number]) => {
            if (sortBy === "title") return run.title
            if (sortBy === "status") return run.status
            if (sortBy === "environment") return run.environment
            return run.createdAt
        }
        const result = String(valueFor(left)).localeCompare(String(valueFor(right)))
        return sortOrder === "asc" ? result : -result
    }), [milestone?.testRuns, sortBy, sortOrder])

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setSortBy(field)
        setSortOrder(field === "createdAt" ? "desc" : "asc")
    }

    const closeMilestoneMutation = useMutation({
        mutationFn: () => milestoneService.update(milestoneId!, { status: 'COMPLETED' }),
        onSuccess: () => {
            toast.success(t('milestone_details.completed_success'))
            queryClient.invalidateQueries({ queryKey: ["milestone", milestoneId] })
        },
        onError: () => toast.error(t('milestone_details.close_failed')),
    })

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid gap-4 md:grid-cols-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    if (!milestone) return <div>{t('milestone_details.not_found')}</div>

    // Calculate Statistics
    const totalCases = milestone.testRuns?.reduce((acc, run) => acc + (run._count?.items || 0), 0) || 0

    let totalPassed = 0
    let totalFailed = 0
    let totalBlocked = 0
    let totalUntested = 0

    milestone.testRuns?.forEach(run => {
        run.items.forEach(item => {
            if (item.finalStatus === 'PASS') totalPassed++
            else if (item.finalStatus === 'FAIL') totalFailed++
            else if (item.finalStatus === 'BLOCK') totalBlocked++
            else totalUntested++
        })
    })

    const completionRate = totalCases > 0 ? Math.round(((totalCases - totalUntested) / totalCases) * 100) : 0
    const passRate = (totalCases - totalUntested) > 0 ? Math.round((totalPassed / (totalCases - totalUntested)) * 100) : 0

    return (
        <div className="space-y-5 pb-8">
            {/* Header */}
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <AppBreadcrumbs
                items={[
                    { label: t("common.projects"), href: "/projects", icon: Folder },
                    { label: t("milestone_details.project"), href: resourceProjectKey ? appRoutes.project(resourceProjectKey) : `/projects/${milestone.projectId}` },
                    { label: t("milestone_details.milestones"), icon: Flag },
                    { label: milestone.name }
                ]}
                className="mb-4"
            />


                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant={milestone.status === 'OPEN' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                                {t(`common.statuses.${milestone.status}`)}
                            </Badge>
                        </div>

                        <p className="max-w-2xl text-muted-foreground">
                            {milestone.description || t('milestone_details.no_description')}
                        </p>
                        {milestone.dueDate && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{t('milestone_details.due_date')} {new Date(milestone.dueDate).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <PageBackButton fallbackTo="/milestones" label={t("common.back")} />
                        <CreateMilestoneDialog
                            projectId={milestone.projectId}
                            milestoneToEdit={milestone}
                            trigger={
                                <Button variant="outline" className="rounded-md border-border/70">
                                    {t('milestone_details.edit_milestone')}
                                </Button>
                            }
                        />
                        {milestone.status === 'OPEN' && (
                            <Button
                                onClick={async () => {
                                    if (await confirm({
                                        description: t('milestone_details.confirm_complete'),
                                        confirmLabel: t('milestone_details.complete_release'),
                                    })) {
                                        closeMilestoneMutation.mutate()
                                    }
                                }}
                                disabled={closeMilestoneMutation.isPending}
                                className="rounded-md"
                                data-testid="milestone-complete-btn"
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {t('milestone_details.complete_release')}
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('milestone_details.total_progress')}</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{completionRate}%</div>
                        <Progress value={completionRate} className="h-2 mt-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                            {t('milestone_details.cases_executed', { executed: totalCases - totalUntested, total: totalCases })}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('milestone_details.pass_rate')}</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{passRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {totalPassed} {t('milestone_details.passed')}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('milestone_details.failed')}</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('milestone_details.critical_issues')}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('milestone_details.blocked')}</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{totalBlocked}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('milestone_details.blocking_issues')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Test Runs Table */}
            <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold tracking-tight">{t('milestone_details.linked_test_runs')}</h2>
                </div>
                <div className="rounded-xl border border-border/70 bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableTableHead sortKey="title" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('milestone_details.test_run')}</SortableTableHead>
                                <SortableTableHead sortKey="status" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('milestone_details.status')}</SortableTableHead>
                                <SortableTableHead sortKey="environment" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('milestone_details.environment')}</SortableTableHead>
                                <SortableTableHead sortKey="progress" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false}>{t('milestone_details.progress')}</SortableTableHead>
                                <SortableTableHead sortKey="createdAt" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('milestone_details.created')}</SortableTableHead>
                                <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="w-[50px]">{null}</SortableTableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {milestone.testRuns && milestone.testRuns.length > 0 ? (
                                sortedRuns.map((run) => {
                                    const runTotal = run._count?.items || 0
                                    const runCompleted = run.items.filter(i => i.finalStatus !== 'UNTESTED').length
                                    const runProgress = runTotal > 0 ? Math.round((runCompleted / runTotal) * 100) : 0

                                    return (
                                        <TableRow
                                            key={run.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => navigate(appRoutes.resource(run.key))}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{run.title}</span>
                                                    <span className="text-xs text-muted-foreground">{runTotal} {t('milestone_details.test_cases')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><StatusBadge status={run.status} /></TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{run.environment}</Badge>
                                            </TableCell>
                                            <TableCell className="w-[200px]">
                                                <div className="flex items-center gap-2">
                                                    <Progress value={runProgress} className="h-2" />
                                                    <span className="text-xs text-muted-foreground w-8">{runProgress}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {new Date(run.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon">
                                                    <ArrowRight className="h-4 w-4" />
                                                    <span className="sr-only">{t('reports.view_details')}</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        {t('milestone_details.no_runs_linked')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    )
}
