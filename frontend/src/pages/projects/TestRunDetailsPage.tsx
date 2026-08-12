import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2, XCircle, AlertCircle, Play, CheckSquare, Trash2, Download, Loader2, Calendar, Send, AlertTriangle, RotateCcw, Clock, Video, Terminal, Zap, Folder, Plus } from "lucide-react"
import { AppBreadcrumbs } from "@/components/navigation/Breadcrumbs"


import { toast } from "sonner"
import { format } from "date-fns"
import { useAuthStore } from "@/store/authStore";
import { useHotkeys } from "react-hotkeys-hook"
import { exportService } from "@/services/export.service"
import { socketService } from "@/services/socket.service"
import { AddTestCasesDialog } from "./components/AddTestCasesDialog"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { FileAttachment, type UploadedFile } from "@/components/FileAttachment"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHero, PageMetric, PageMetricGrid, PageLoading } from "@/components/layout/PageChrome"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { testRunService } from "@/services/testRun.service"
import type { TestRunItem, ResultStatus } from "@/types/testRun"

import { StatusBadge } from "@/components/ui/status-badge"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TestRunConflicts } from "./components/TestRunConflicts"
import { TestRunComparison } from "./components/TestRunComparison"
import { AnalyzeFailureButton } from "./execution/components/AnalyzeFailureButton"
import { PageBackButton } from "@/components/navigation/PageBackButton"
import { appRoutes } from "@/lib/routes"
import { queryKeys } from "@/lib/queryKeys"

import { motion } from "framer-motion"

import { useTranslation } from "react-i18next"
import { useDateLocale } from "@/hooks/useDateLocale"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

import { CloseRunDialog } from "./components/CloseRunDialog"
import { useAppDialog } from "@/components/ui/app-dialog-context"

interface CaseStepSnapshot {
    action: string
    expected: string
    expectedResult?: string
}

export default function TestRunDetailsPage({ resourceId, resourceProjectKey }: { resourceId?: string; resourceProjectKey?: string } = {}) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const dateLocale = useDateLocale()
    const { runId: routeRunId } = useParams<{ runId: string }>()
    const runId = resourceId ?? routeRunId
    const user = useAuthStore((state) => state.user)
    const isAdminOrLeader = user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER'
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [selectedItem, setSelectedItem] = useState<TestRunItem | null>(null)
    const [executionComment, setExecutionComment] = useState("")
    const [evidenceFiles, setEvidenceFiles] = useState<UploadedFile[]>([])
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [closeRunDialogOpen, setCloseRunDialogOpen] = useState(false)
    const [resetDialogOpen, setResetDialogOpen] = useState(false)
    const [itemToReset, setItemToReset] = useState<string | null>(null)
    const [executionSortBy, setExecutionSortBy] = useState("title")
    const [executionSortOrder, setExecutionSortOrder] = useState<"asc" | "desc">("asc")

    const { data: testRun, isLoading } = useQuery({
        queryKey: ["test-run", runId],
        queryFn: () => testRunService.getById(runId!),
        enabled: !!runId,
    })

    useEffect(() => {
        const projectId = testRun?.projectId
        if (projectId) {
            socketService.joinProject(projectId)
            return () => {
                socketService.leaveProject(projectId)
            }
        }
    }, [testRun?.projectId])

    const [searchParams] = useSearchParams()
    const autoStart = searchParams.get('autoStart') === 'true'

    const filteredItems = useMemo(() => {
        if (!testRun?.items) return []
        if (isAdminOrLeader) return testRun.items
        // Filter items where the logged-in user is the ASSIGNEE
        return testRun.items.filter(item => item.assigneeId === user?.id)
    }, [testRun, isAdminOrLeader, user])

    const sortedFilteredItems = useMemo(() => [...filteredItems].sort((left, right) => {
        const valueFor = (item: TestRunItem) => {
            if (executionSortBy === "priority") return item.casePriority || item.testCase.priority || ""
            if (executionSortBy === "manualStatus") return item.manualStatus || ""
            if (executionSortBy === "automationStatus") return item.automationStatus || ""
            if (executionSortBy === "finalStatus") return item.finalStatus || ""
            if (executionSortBy === "assignee") return item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : ""
            return item.caseTitle || item.testCase.title
        }
        const result = String(valueFor(left)).localeCompare(String(valueFor(right)))
        return executionSortOrder === "asc" ? result : -result
    }), [executionSortBy, executionSortOrder, filteredItems])

    const handleExecutionSort = (field: string) => {
        if (executionSortBy === field) {
            setExecutionSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setExecutionSortBy(field)
        setExecutionSortOrder("asc")
    }

    // Auto-start logic
    useEffect(() => {
        if (autoStart && filteredItems.length === 1 && !selectedItem) {
            const nextItem = filteredItems[0]
            const timer = window.setTimeout(() => {
                setSelectedItem(nextItem)
            }, 0)
            // Clear the autoStart param to prevent re-opening on close
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('autoStart')
            navigate({ search: newParams.toString() }, { replace: true })
            return () => window.clearTimeout(timer)
        }
    }, [autoStart, filteredItems, selectedItem, navigate, searchParams])

    const isMyWorkComplete = useMemo(() => {
        if (filteredItems.length === 0) return false
        return filteredItems.every(item => item.manualStatus !== 'UNTESTED')
    }, [filteredItems])

    // Calculate Progress
    const progressPercentage = useMemo(() => {
        if (!testRun?.items || testRun.items.length === 0) return 0
        const completed = testRun.items.filter(item => item.finalStatus !== 'UNTESTED').length
        return Math.round((completed / testRun.items.length) * 100)
    }, [testRun])

    const filteredStats = useMemo(() => {
        const passed = filteredItems.filter(item => item.finalStatus === 'PASS').length
        const failed = filteredItems.filter(item => item.finalStatus === 'FAIL').length
        const blocked = filteredItems.filter(item => item.finalStatus === 'BLOCK').length
        const untested = filteredItems.filter(item => item.finalStatus === 'UNTESTED').length
        const total = filteredItems.length
        return {
            passed,
            failed,
            blocked,
            untested,
            passedPercent: total > 0 ? (passed / total) * 100 : 0,
            failedPercent: total > 0 ? (failed / total) * 100 : 0,
            blockedPercent: total > 0 ? (blocked / total) * 100 : 0,
        }
    }, [filteredItems])

    const invalidateRunListQueries = async () => {
        const invalidations = [
            queryClient.invalidateQueries({ queryKey: ["testRuns"] }),
        ]
        if (testRun?.projectId) {
            invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.testRuns(testRun.projectId) }))
        }
        await Promise.all(invalidations)
    }

    const triggerAutomationMutation = useMutation({
        mutationFn: () => testRunService.triggerAutomation(runId!),
        onSuccess: async () => {
            toast.success(t('test_run_details.automation_triggered'))
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
        },
        onError: () => toast.error(t('test_run_details.automation_failed')),
    })

    const triggerItemAutomationMutation = useMutation({
        mutationFn: (itemId: string) => testRunService.triggerItemAutomation(itemId),
        onSuccess: async () => {
            toast.success(t('test_run_details.item_automation_triggered'))
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
        },
        onError: () => toast.error(t('test_run_details.item_automation_failed')),
    })

    const notifyCompletionMutation = useMutation({
        mutationFn: () => testRunService.notifyCompletion(runId!),
        onSuccess: () => {
            toast.success(t('test_run_details.admin_notified'))
        },
        onError: () => toast.error(t('test_run_details.admin_notify_failed')),
    })

    const handleRunAutomation = (itemId: string) => {
        triggerItemAutomationMutation.mutate(itemId)
    }

    const [stepStatuses, setStepStatuses] = useState<Record<number, ResultStatus>>({})

    const handleExecute = (item: TestRunItem) => {
        if (testRun?.status === 'COMPLETED' || testRun?.status === 'ARCHIVED') {
            toast.warning(t('test_run_details.run_closed_warning'))
            return
        }

        setSelectedItem(item)
        setExecutionComment("")
        setEvidenceFiles([])

        // Load previous results if available
        if (item.results && item.results.length > 0) {
            const latestResult = item.results[0]
            if (latestResult.stepResults && Array.isArray(latestResult.stepResults)) {
                const statuses: Record<number, ResultStatus> = {}
                latestResult.stepResults.forEach((res) => {
                    statuses[res.stepIndex] = res.status
                })
                setStepStatuses(statuses)
            } else {
                setStepStatuses({})
            }
        } else {
            setStepStatuses({})
        }
    }

    const toggleStepStatus = (index: number, status: ResultStatus) => {
        setStepStatuses(prev => ({
            ...prev,
            [index]: prev[index] === status ? 'UNTESTED' : status
        }))
    }

    const addResultMutation = useMutation({
        mutationFn: ({ status }: { status: ResultStatus }) => {
            // Convert stepStatuses map to array
            const stepResults = Object.entries(stepStatuses).map(([index, stepStatus]) => ({
                stepIndex: parseInt(index),
                status: stepStatus as ResultStatus
            }))

            return testRunService.addResult(selectedItem!.id, {
                status,
                comment: executionComment,
                evidenceUrl: evidenceFiles.length > 0 ? evidenceFiles[0].url : undefined,
                attachmentIds: evidenceFiles.length > 0 ? evidenceFiles.map((f) => f.id) : undefined,
                stepResults: stepResults.length > 0 ? stepResults : undefined
            })
        },
        onSuccess: async () => {
            toast.success(t('test_run_details.result_submitted'))

            // Auto-advance logic
            if (selectedItem && filteredItems.length > 0) {
                const currentIndex = filteredItems.findIndex(item => item.id === selectedItem.id)
                if (currentIndex !== -1 && currentIndex < filteredItems.length - 1) {
                    // Move to next item
                    const nextItem = filteredItems[currentIndex + 1]
                    setSelectedItem(nextItem)
                    // Reset form state for next item
                    setExecutionComment("")
                    setEvidenceFiles([])
                    setStepStatuses({})
                } else {
                    // End of list, close dialog
                    setSelectedItem(null)
                    setExecutionComment("")
                    setEvidenceFiles([])
                    setStepStatuses({})
                }
            } else {
                setSelectedItem(null)
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
        },
        onError: (error) => {
            logger.error(error)
            toast.error(t('test_run_details.result_failed'))
        },
    })

    const closeRunMutation = useMutation({
        mutationFn: () => testRunService.update(runId!, { status: 'COMPLETED' }),
        onSuccess: async () => {
            toast.success(t('test_run_details.run_closed'))
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
        },
        onError: () => toast.error(t('test_run_details.run_close_failed')),
    })

    const deleteRunMutation = useMutation({
        mutationFn: () => testRunService.delete(runId!),
        onSuccess: () => {
            toast.success(t('test_run_details.run_deleted'))
            navigate(testRun?.projectId ? `/projects/${testRun.projectId}` : `/dashboard`)
        },
        onError: () => toast.error(t('test_run_details.run_delete_failed')),
    })

    const deleteItemMutation = useMutation({
        mutationFn: (itemId: string) => testRunService.deleteItem(itemId),
        onSuccess: async () => {
            toast.success(t('test_run_details.item_deleted'))
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
        },
        onError: () => toast.error(t('test_run_details.item_delete_failed')),
    })

    const resetItemMutation = useMutation({
        mutationFn: (itemId: string) => testRunService.addResult(itemId, { status: 'UNTESTED' }),
        onSuccess: async () => {
            toast.success(t('test_run_details.reset_success'))
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["test-run", runId] }),
                invalidateRunListQueries(),
            ])
            if (selectedItem) {
                setSelectedItem(null) // Close dialog if open
            }
        },
        onError: () => toast.error(t('test_run_details.result_failed')),
    })

    const claimItemMutation = useMutation({
        mutationFn: (itemId: string) => testRunService.assignItem(itemId, user!.id),
        onSuccess: async () => {
            toast.success(t('test_run_details.claim_success'))
            await queryClient.invalidateQueries({ queryKey: ["test-run", runId] })
        },
        onError: () => toast.error(t('test_run_details.claim_failed')),
    })

    const submitResult = (status: ResultStatus) => {
        addResultMutation.mutate({ status })
    }

    const executionSteps = useMemo<CaseStepSnapshot[]>(() => {
        const rawSteps = selectedItem?.caseSteps || selectedItem?.testCase.steps
        if (!Array.isArray(rawSteps)) return []
        return rawSteps.map((step: CaseStepSnapshot & { name?: string }) => ({
            ...step,
            action: step.action || step.name || '',
            expected: step.expected || step.expectedResult || '',
            expectedResult: step.expectedResult || step.expected || '',
        }))
    }, [selectedItem])

    useHotkeys('p', () => submitResult('PASS'), { enabled: !!selectedItem })
    useHotkeys('f', () => submitResult('FAIL'), { enabled: !!selectedItem })
    useHotkeys('b', () => submitResult('BLOCK'), { enabled: !!selectedItem })

    if (isLoading) {
        return <PageLoading hasHero metricCount={4} />
    }

    if (!testRun) {
        return <div>{t('test_run_details.not_found')}</div>
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex min-w-0 flex-col gap-5"
        >
            {/* Header Section */}
            <PageHero
                eyebrow={
                    <AppBreadcrumbs
                        items={[
                            { label: t("common.projects"), href: "/projects", icon: Folder },
                            { label: t("test_run_details.project"), href: resourceProjectKey ? appRoutes.project(resourceProjectKey) : testRun.projectId ? `/projects/${testRun.projectId}` : "/dashboard" },
                            { label: testRun.title, icon: Zap }
                        ]}
                        className="mb-0"
                    />
                }

                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={testRun.status} />
                        <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground border-border font-normal">
                            {testRun.environment}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {testRun.startDate ? format(new Date(testRun.startDate), "d MMM yyyy", { locale: dateLocale }) : "-"}
                        </span>
                    </span>
                }
                actions={
                    <div className="flex flex-wrap gap-2">
                        <PageBackButton
                            fallbackTo={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "runs") : testRun.projectId ? `/projects/${testRun.projectId}?tab=runs` : "/runs"}
                            label={t("common.back")}
                        />
                        {!isAdminOrLeader && (
                            <Button
                                data-testid="test-run-complete-btn"
                                variant="success"
                                onClick={() => notifyCompletionMutation.mutate()}
                                disabled={!isMyWorkComplete || notifyCompletionMutation.isPending}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {t('test_run_details.complete_my_tests')}
                            </Button>
                        )}

                        {testRun.status === 'OPEN' && (
                            <Button
                                data-testid="test-run-automation-btn"
                                variant="info"
                                onClick={async () => {
                                    if (await confirm({
                                        description: t('test_run_details.confirm_automation'),
                                        confirmLabel: t('test_run_details.run_automation'),
                                    })) {
                                        triggerAutomationMutation.mutate()
                                    }
                                }}
                                disabled={triggerAutomationMutation.isPending}
                            >
                                {triggerAutomationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                {t('test_run_details.run_automation')}
                            </Button>
                        )}

                        {testRun.status === 'OPEN' && isAdminOrLeader && (
                            <AddTestCasesDialog
                                testRunId={testRun.id}
                                projectId={testRun.projectId}
                                trigger={
                                    <Button data-testid="test-run-add-cases-btn" variant="success">
                                        <CheckSquare className="mr-2 h-4 w-4" />
                                        {t('test_run_details.add_cases')}
                                    </Button>
                                }
                            />
                        )}

                        <Button
                            data-testid="test-run-export-btn"
                            variant="secondary"
                            onClick={() => exportService.exportTestRunResults(runId!)}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {t('test_run_details.export')}
                        </Button>

                        {testRun.status === 'OPEN' && isAdminOrLeader && (
                            <Button
                                data-testid="test-run-close-btn"
                                variant="destructive"
                                onClick={() => setCloseRunDialogOpen(true)}
                                disabled={closeRunMutation.isPending}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                {t('test_run_details.close')}
                            </Button>
                        )}
                        {isAdminOrLeader && (
                            <Button
                                data-testid="test-run-delete-btn"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={deleteRunMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t('common.delete')}</span>
                            </Button>
                        )}
                    </div>
                }
            >
                {progressPercentage === 100 && testRun.status === 'OPEN' && (
                    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <div>
                                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">{t('test_run_details.ready_to_close_title')}</h4>
                                <p className="text-xs text-green-600/80 dark:text-green-400/80">{t('test_run_details.ready_to_close_desc')}</p>
                            </div>
                        </div>

                        {isAdminOrLeader && (
                            <Button
                                variant="success"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => setCloseRunDialogOpen(true)}
                                disabled={closeRunMutation.isPending}
                            >
                                {t('test_run_details.close_run_button')}
                            </Button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <PageMetricGrid>
                            <PageMetric
                                label={t('test_run_details.passed')}
                                value={filteredStats.passed}
                                tone="success"
                                icon={CheckCircle2}
                            />
                            <PageMetric
                                label={t('test_run_details.failed')}
                                value={filteredStats.failed}
                                tone="danger"
                                icon={XCircle}
                            />
                            <PageMetric
                                label={t('test_run_details.blocked')}
                                value={filteredStats.blocked}
                                tone="warning"
                                icon={AlertCircle}
                            />
                            <PageMetric
                                label={t('test_run_details.untested')}
                                value={filteredStats.untested}
                                tone="neutral"
                                icon={Clock}
                            />
                        </PageMetricGrid>
                    </div>

                    <div className="bg-background/40 rounded-xl border border-border/50 p-4 flex flex-col justify-center gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('test_run_details.progress')}</h3>
                            <span className="text-lg font-bold text-primary">{progressPercentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden flex">
                            <div style={{ width: `${filteredStats.passedPercent}%` }} className="bg-green-500 h-full" />
                            <div style={{ width: `${filteredStats.failedPercent}%` }} className="bg-red-500 h-full" />
                            <div style={{ width: `${filteredStats.blockedPercent}%` }} className="bg-orange-500 h-full" />
                        </div>
                    </div>
                </div>
            </PageHero>

            <Tabs defaultValue="execution" className="w-full">
                <TabsList className="h-auto w-full justify-start gap-3 overflow-x-auto rounded-none border-b bg-transparent p-0 pb-1 sm:gap-6">
                    <TabsTrigger
                        data-testid="test-run-tab-execution"
                        value="execution"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
                    >
                        {t('test_run_details.execution_list')}
                    </TabsTrigger>
                    <TabsTrigger
                        data-testid="test-run-tab-conflicts"
                        value="conflicts"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
                    >
                        {t('test_run_details.conflicts')}
                    </TabsTrigger>
                    <TabsTrigger
                        data-testid="test-run-tab-comparison"
                        value="comparison"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
                    >
                        {t('test_run_details.comparison_report')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="execution" className="mt-6">
                    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                        <Table className="min-w-[620px] md:min-w-0">
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <SortableTableHead sortKey="title" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} className="pl-6">{t('test_run_details.test_case')}</SortableTableHead>
                                    <SortableTableHead sortKey="priority" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} className="hidden md:table-cell">{t('test_run_details.priority')}</SortableTableHead>
                                    <SortableTableHead sortKey="manualStatus" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} className="hidden sm:table-cell">{t('test_run_details.manual')}</SortableTableHead>
                                    <SortableTableHead sortKey="automationStatus" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} className="hidden lg:table-cell">{t('test_run_details.automation')}</SortableTableHead>
                                    <SortableTableHead sortKey="finalStatus" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort}>{t('test_run_details.final_status')}</SortableTableHead>
                                    <SortableTableHead sortKey="assignee" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} className="hidden xl:table-cell">{t('test_run_details.assignee')}</SortableTableHead>
                                    <SortableTableHead sortKey="actions" activeSortKey={executionSortBy} direction={executionSortOrder} onSort={handleExecutionSort} sortable={false} className="w-[120px] text-right pr-6">{t('common.actions')}</SortableTableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length > 0 ? (
                                    sortedFilteredItems.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={`cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                                            onClick={() => handleExecute(item)}
                                        >
                                            <TableCell className="font-medium pl-6">
                                                <div className="flex flex-col gap-1">
                                                    <span>{item.caseTitle || item.testCase.title}</span>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                        <span className="md:hidden">{item.casePriority || item.testCase.priority}</span>
                                                        <span className="sm:hidden">{item.manualStatus}</span>
                                                        {item.assignee ? <span className="xl:hidden">{item.assignee.firstName}</span> : null}
                                                    </div>

                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <Badge variant="outline" className="font-normal">{item.casePriority || item.testCase.priority}</Badge>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell"><StatusBadge status={item.manualStatus} /></TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {item.automationStatus ? (
                                                    <StatusBadge status={item.automationStatus} />
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell><StatusBadge status={item.finalStatus} /></TableCell>
                                             <TableCell className="hidden xl:table-cell">
                                                {item.assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium">
                                                            {item.assignee.firstName[0]}
                                                        </div>
                                                        <span className="text-sm text-muted-foreground">{item.assignee.firstName}</span>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            claimItemMutation.mutate(item.id)
                                                        }}
                                                        disabled={claimItemMutation.isPending}
                                                    >
                                                        {claimItemMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                                        {t('test_run_details.claim')}
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()} className="pr-6">
                                                <div className="flex justify-end gap-2">

                                                    <PermissionGate permission="test:execute">
                                                        <Button
                                                            data-testid="test-run-execute-item-btn"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleExecute(item)}
                                                            title={t('test_run_details.manual_run')}
                                                            className="h-8 w-8 p-0 rounded-full border-primary/20 hover:bg-primary hover:text-white text-primary transition-colors"
                                                        >
                                                            <Play className="h-3.5 w-3.5 ml-0.5" />
                                                        </Button>
                                                    </PermissionGate>

                                                    <PermissionGate permission="test:execute">
                                                        <Button
                                                            data-testid="test-run-automation-item-btn"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRunAutomation(item.id)}
                                                            title={t('test_run_details.run_automation')}
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-secondary"
                                                            disabled={triggerItemAutomationMutation.isPending}
                                                        >
                                                            {triggerItemAutomationMutation.isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <CheckSquare className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                    </PermissionGate>

                                                    {item.finalStatus === 'FAIL' && item.results && item.results[0] && (
                                                        <AnalyzeFailureButton
                                                            testResultId={item.results[0].id}
                                                            projectId={testRun.projectId || ""}
                                                            className="h-8 w-auto px-2 rounded-full"
                                                        />
                                                    )}
                                                    {item.finalStatus !== 'UNTESTED' && (
                                                        <Button
                                                            data-testid="test-run-reset-item-btn"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setItemToReset(item.id)
                                                                setResetDialogOpen(true)
                                                            }}
                                                            title={t('test_run_details.reset_tooltip')}
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                                                            disabled={resetItemMutation.isPending}
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {item.finalStatus === 'UNTESTED' && isAdminOrLeader && (
                                                        <Button
                                                            data-testid="test-run-delete-item-btn"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={async (e) => {
                                                                e.stopPropagation()
                                                                if (await confirm({
                                                                    description: t('test_run_details.confirm_delete_item'),
                                                                    confirmLabel: t('common.delete'),
                                                                    destructive: true,
                                                                })) {
                                                                    deleteItemMutation.mutate(item.id)
                                                                }
                                                            }}
                                                            title={t('common.delete')}
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                                                            disabled={deleteItemMutation.isPending}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <CheckSquare className="h-8 w-8 mb-2 opacity-20" />
                                                <p>{t('test_run_details.no_cases_assigned')}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="conflicts" className="mt-6">
                    <TestRunConflicts runId={runId!} />
                </TabsContent>

                <TabsContent value="comparison" className="mt-6">
                    <TestRunComparison runId={runId!} />
                </TabsContent>
            </Tabs>

            {/* Execution Dialog */}
            <Dialog open={!!selectedItem} onOpenChange={(open) => {
                if (!open) {
                    setSelectedItem(null)
                    setEvidenceFiles([])
                }
            }}>
                <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                                {selectedItem?.casePriority || selectedItem?.testCase.priority}
                            </Badge>
                        </div>

                        <DialogTitle className="text-xl">
                            {selectedItem?.caseTitle || selectedItem?.testCase.title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[70vh] space-y-6 overflow-y-auto p-4 custom-scrollbar sm:p-6">
                        {/* Automation Results */}
                        {selectedItem?.automationStatus && (selectedItem.videoUrl || selectedItem.errorOutput) && (
                            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <Zap className="h-4 w-4" /> {t('test_run_details.automation_evidence', 'Automation Evidence')}
                                </h4>
                                {selectedItem.videoUrl && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Video className="h-3.5 w-3.5" /> {t('test_run_details.execution_video', 'Execution Video')}
                                        </div>
                                        <div className="overflow-hidden rounded-lg border bg-black">
                                            <video src={selectedItem.videoUrl} controls className="w-full max-h-96 object-contain" />
                                        </div>
                                    </div>
                                )}
                                {selectedItem.errorOutput && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Terminal className="h-3.5 w-3.5" /> {t('test_run_details.console_output', 'Console Output')}
                                        </div>
                                        <div className="rounded-md bg-muted/50 p-3 overflow-x-auto text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                                            {selectedItem.errorOutput}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border/40">
                                <CheckSquare className="h-4 w-4 text-primary" /> {t('test_run_details.test_steps')}
                            </h4>
                            <Table className="min-w-[640px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[10%]">#</TableHead>
                                        <TableHead className="w-[35%]">{t('test_run_details.action')}</TableHead>
                                        <TableHead className="w-[35%]">{t('test_run_details.expected_result')}</TableHead>
                                        <TableHead className="w-[20%] text-right">{t('common.status')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {executionSteps.map((step, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>{step.action}</TableCell>
                                            <TableCell>{step.expected}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant={stepStatuses[index] === 'PASS' ? "default" : "ghost"}
                                                        className={`h-8 w-8 ${stepStatuses[index] === 'PASS' ? 'bg-green-600 hover:bg-green-700' : 'text-gray-400 hover:text-green-600'}`}
                                                        onClick={() => toggleStepStatus(index, 'PASS')}
                                                        title={t('test_run_details.pass')}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant={stepStatuses[index] === 'FAIL' ? "default" : "ghost"}
                                                        className={`h-8 w-8 ${stepStatuses[index] === 'FAIL' ? 'bg-red-600 hover:bg-red-700' : 'text-gray-400 hover:text-red-600'}`}
                                                        onClick={() => toggleStepStatus(index, 'FAIL')}
                                                        title={t('test_run_details.fail')}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant={stepStatuses[index] === 'BLOCK' ? "default" : "ghost"}
                                                        className={`h-8 w-8 ${stepStatuses[index] === 'BLOCK' ? 'bg-orange-600 hover:bg-orange-700' : 'text-gray-400 hover:text-orange-600'}`}
                                                        onClick={() => toggleStepStatus(index, 'BLOCK')}
                                                        title={t('test_run_details.block')}
                                                    >
                                                        <AlertCircle className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-2">
                                <Label className="text-foreground/80">{t('test_run_details.execution_notes')}</Label>
                                <Textarea
                                    placeholder={t('test_run_details.notes_placeholder')}
                                    value={executionComment}
                                    onChange={(e) => setExecutionComment(e.target.value)}
                                    className="resize-none h-32"
                                />
                            </div>

                            <div className="space-y-2">
                                <FileAttachment
                                    label={t('test_run_details.evidence')}
                                    files={evidenceFiles}
                                    onUpload={(file) => setEvidenceFiles(prev => [...prev, file])}
                                    onRemove={(id) => setEvidenceFiles(prev => prev.filter(f => f.id !== id))}
                                    maxFiles={5}
                                    allowVideo={true}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-4 bg-muted/20 flex-col sm:flex-row gap-3 border-t">
                        <div className="flex-1 flex gap-3">
                            <Button
                                data-testid="test-run-dialog-fail-btn"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => submitResult('FAIL')}
                                disabled={addResultMutation.isPending}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                {t('test_run_details.fail')}
                            </Button>
                            <Button
                                data-testid="test-run-dialog-block-btn"
                                variant="warning"
                                className="flex-1"
                                onClick={() => submitResult('BLOCK')}
                                disabled={addResultMutation.isPending}
                            >
                                <AlertCircle className="mr-2 h-4 w-4" />
                                {t('test_run_details.block')}
                            </Button>
                        </div>
                        <Button
                            data-testid="test-run-dialog-pass-btn"
                            variant="success"
                            className="flex-1"
                            onClick={() => submitResult('PASS')}
                            disabled={addResultMutation.isPending}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {t('test_run_details.pass_test_case')}
                        </Button>
                        {selectedItem?.finalStatus === 'FAIL' && selectedItem?.results?.[0] && (
                            <AnalyzeFailureButton
                                testResultId={selectedItem.results[0].id}
                                projectId={testRun.projectId || ""}
                                className="flex-1"
                            />
                        )}
                        {selectedItem?.finalStatus !== 'UNTESTED' && (
                            <Button
                                data-testid="test-run-dialog-reset-btn"
                                variant="outline"
                                onClick={() => {
                                    setItemToReset(selectedItem!.id)
                                    setResetDialogOpen(true)
                                }}
                                disabled={resetItemMutation.isPending}
                                title={t('test_run_details.reset_tooltip')}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-primary" />
                            {t('test_run_details.reset_confirm_title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('test_run_details.reset_confirm_desc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setItemToReset(null)
                            setResetDialogOpen(false)
                        }}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (itemToReset) {
                                    resetItemMutation.mutate(itemToReset)
                                    setItemToReset(null)
                                    setResetDialogOpen(false)
                                }
                            }}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {t('test_run_details.reset_confirm_btn')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            {t('test_runs.delete_run_title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 pt-2">
                            <p>{t('test_runs.delete_run_desc')}</p>
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium border border-destructive/20">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>{t('test_runs.delete_run_risk_1')}</li>
                                    <li>{t('test_runs.delete_run_risk_2')}</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteRunMutation.mutate()}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={deleteRunMutation.isPending}
                        >
                            {deleteRunMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <CloseRunDialog
                open={closeRunDialogOpen}
                onOpenChange={setCloseRunDialogOpen}
                onConfirm={() => {
                    closeRunMutation.mutate()
                    setCloseRunDialogOpen(false)
                }}
                isPending={closeRunMutation.isPending}
            />
        </motion.div >
    )
}
import { logger } from "@/utils/logger";
