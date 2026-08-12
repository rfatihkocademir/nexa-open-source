import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"
import { Plus, Edit, Trash2, PlayCircle, Download, ArrowUpDown, AlertTriangle, FolderInput, RotateCcw, Eye, EyeOff, MoreHorizontal } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { exportService } from "@/services/export.service"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { BulkActionsBar } from "./BulkActionsBar"
import { testCaseService } from "@/services/testCase.service"
import { testRunService } from "@/services/testRun.service"
import { appRoutes } from "@/lib/routes"
import type { TestCase, Priority, CaseStatus } from "@/types/testCase"
import { TestCaseDialog } from "./TestCaseDialog"
import { useAuthStore } from "@/store/authStore";
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useTranslation } from "react-i18next"
import { MoveTestCaseDialog } from "./MoveTestCaseDialog"
import { TagManager } from "./TagManager"

interface TestCaseListProps {
    suiteId: string
    projectId: string
}

const PriorityBadge = ({ priority }: { priority: Priority }) => {
    const { t } = useTranslation()
    const colors: Record<Priority, string> = {
        LOW: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
        HIGH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
        CRITICAL: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    }
    return <Badge variant="outline" className={`${colors[priority]} font-medium`}>{t(`common.statuses.${priority}`)}</Badge>
}

const StatusBadge = ({ status }: { status: CaseStatus }) => {
    const { t } = useTranslation()
    const colors: Record<CaseStatus, string> = {
        DRAFT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        PENDING: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
        APPROVED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
        REVISE: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    }
    return <Badge variant="outline" className={`${colors[status]} font-medium`}>{t(`common.statuses.${status}`)}</Badge>
}

export function TestCaseList({ suiteId, projectId }: TestCaseListProps) {
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
    const [editingCase, setEditingCase] = useState<TestCase | undefined>(undefined)
    const [moveTestCaseId, setMoveTestCaseId] = useState<string | null>(null)
    const [rowSelection, setRowSelection] = useState({})

    // Soft Delete State
    const [showDeleted, setShowDeleted] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [testCaseToDelete, setTestCaseToDelete] = useState<string | null>(null)
    const [isHardDelete, setIsHardDelete] = useState(false)

    // Inline Creation State (Moved to top)
    const [newCaseTitle, setNewCaseTitle] = useState("")
    const [newCasePriority, setNewCasePriority] = useState<Priority>("MEDIUM")

    // const [isCreating, setIsCreating] = useState(false)

    const queryClient = useQueryClient()
    const user = useAuthStore((state) => state.user)
    const canApprove = useAuthStore((state) => state.checkPermission(projectId, 'test:approve'))

    const { data: testCases, isLoading } = useQuery({
        queryKey: queryKeys.testCases(suiteId, showDeleted),
        queryFn: () => testCaseService.getAll(suiteId, showDeleted),
        enabled: !!suiteId,
    })

    const createMutation = useMutation({
        mutationFn: (data: { title: string; priority: Priority; suiteId: string }) =>
            testCaseService.create({ ...data, steps: [] }),
        onSuccess: async () => {
            toast.success(t('test_case_list.create_success'))
            setNewCaseTitle("")
            await queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => toast.error(t('test_case_list.create_error'))
    })

    const deleteMutation = useMutation({
        mutationFn: async ({ id, hardDelete }: { id: string, hardDelete: boolean }) => {
            await testCaseService.delete(id, hardDelete)
        },
        onSuccess: async () => {
            toast.success(t('test_case_list.delete_success'))
            setDeleteDialogOpen(false)
            setTestCaseToDelete(null)
            setIsHardDelete(false)
            await queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => {
            toast.error(t('test_case_list.delete_error'))
            setDeleteDialogOpen(false)
        }
    })

    const restoreMutation = useMutation({
        mutationFn: (id: string) => testCaseService.restore(id),
        onSuccess: async () => {
            toast.success(t('test_case_list.restore_success'))
            await queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => toast.error(t('test_case_list.restore_error'))
    })

    const handleDeleteClick = (id: string) => {
        setTestCaseToDelete(id)
        setIsHardDelete(false)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = () => {
        if (testCaseToDelete) {
            deleteMutation.mutate({ id: testCaseToDelete, hardDelete: isHardDelete })
        }
    }

    const handleRestore = useCallback((id: string) => {
        restoreMutation.mutate(id)
    }, [restoreMutation])

    const handleEdit = (testCase: TestCase) => {
        setEditingCase(testCase)
        setIsDialogOpen(true)
    }

    const handleMove = (id: string) => {
        setMoveTestCaseId(id)
        setIsMoveDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingCase(undefined)
        setIsDialogOpen(true)
    }

    const handleAutomation = useCallback((testCase: TestCase) => {
        navigate(`${appRoutes.resource(testCase.key)}?tab=automation`, {
            state: { from: `${location.pathname}${location.search}` },
        })
    }, [location.pathname, location.search, navigate])

    const handleInlineCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCaseTitle.trim()) return
        createMutation.mutate({
            title: newCaseTitle,
            priority: newCasePriority,
            suiteId
        })
    }

    const quickRunMutation = useMutation({
        mutationFn: (testCaseId: string) => testRunService.createQuickRun(testCaseId),
        onSuccess: (data) => {
            toast.success(t('test_case_list.quick_run_success'))
            navigate(`${appRoutes.resource(data.key)}?autoStart=true`, {
                state: { from: `${location.pathname}${location.search}` },
            })
        },
        onError: () => toast.error(t('test_case_list.quick_run_error')),
    })

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: CaseStatus }) => {
            if (status === 'APPROVED') return testCaseService.approve(id)
            if (status === 'REVISE') return testCaseService.requestRevision(id)
            return testCaseService.update(id, { status })
        },
        onSuccess: async () => {
            toast.success(t('test_case_list.status_update_success'))
            await queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => toast.error(t('test_case_list.status_update_error')),
    })

    const bulkDeleteMutation = useMutation({
        mutationFn: (hardDelete: boolean) =>
            testCaseService.bulkDelete(Object.keys(rowSelection), hardDelete),
        onSuccess: () => {
            toast.success(t('test_case_list.delete_success'))
            setRowSelection({})
            queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => toast.error(t('test_case_list.delete_error'))
    })

    const bulkStatusMutation = useMutation({
        mutationFn: (status: CaseStatus) =>
            testCaseService.bulkUpdateStatus(Object.keys(rowSelection), status),
        onSuccess: () => {
            toast.success(t('test_case_list.status_update_success'))
            setRowSelection({})
            queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        },
        onError: () => toast.error(t('test_case_list.status_update_error'))
    })

    const columns = useMemo<ColumnDef<TestCase>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label={t('test_case_list.select_all')}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label={t('test_case_list.select_row')}
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "title",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="hover:bg-transparent pl-0"
                    >
                        {t('test_case_list.title_column')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const hasSteps = row.original.hasSteps
                return (
                    <div className="flex items-center gap-2 group">
                        <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <span className="text-[10px] font-bold">{row.original.key?.split("-")[0] || "TC"}</span>
                        </div>
                        <div className="min-w-0">
                            <Link
                                to={appRoutes.resource(row.original.key)}
                                state={{ from: `${location.pathname}${location.search}` }}
                                className="font-medium hover:text-primary transition-colors"
                            >
                                {row.getValue("title")}
                            </Link>
                            {row.original.key && (
                                <div className="font-mono text-[11px] text-muted-foreground">{row.original.key}</div>
                            )}
                        </div>
                        {!hasSteps && (
                            <div title={t('test_case_list.no_steps_defined')} className="text-orange-500">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "priority",
            header: t('test_case_list.priority_column'),
            cell: ({ row }) => <PriorityBadge priority={row.getValue("priority")} />,
        },
        {
            accessorKey: "tags",
            header: t('test_case_list.tags_column'),
            cell: ({ row }) => {
                const tags = row.original.tags?.map(t => t.tag) || []
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <TagManager
                            testCaseId={row.original.id}
                            projectId={projectId}
                            currentTags={tags}
                        />
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: t('test_case_list.status_column'),
            cell: ({ row }) => {
                const status = row.getValue("status") as CaseStatus
                const id = row.original.id

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                <StatusBadge status={status} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id, status: 'DRAFT' })}>
                                <StatusBadge status="DRAFT" />
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id, status: 'PENDING' })}>
                                <StatusBadge status="PENDING" />
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={!canApprove}
                                onClick={() => updateStatusMutation.mutate({ id, status: 'APPROVED' })}
                            >
                                <StatusBadge status="APPROVED" />
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id, status: 'REVISE' })}>
                                <StatusBadge status="REVISE" />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
        {
            accessorKey: "author",
            header: t('test_case_list.author_column'),
            cell: ({ row }) => {
                const author = row.original.author
                return author ? (
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                            {author.firstName[0]}
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {author.firstName} {author.lastName}
                        </span>
                    </div>
                ) : "-"
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const testCase = row.original
                const isDeleted = !!testCase.deletedAt

                if (isDeleted) {
                    return (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title={t('test_case_list.restore_tooltip')}
                                onClick={() => handleRestore(testCase.id)}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    )
                }

                return (
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title={testCase.status === 'APPROVED'
                                ? t('test_case_list.quick_run_tooltip')
                                : t('test_case_list.quick_run_requires_approval')}
                            onClick={() => quickRunMutation.mutate(testCase.id)}
                            disabled={quickRunMutation.isPending || testCase.status !== 'APPROVED'}
                        >
                            <PlayCircle className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title={t('test_case_list.automation_tooltip')}
                            onClick={() => handleAutomation(testCase)}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title={t('test_case_list.edit_tooltip')}
                            onClick={() => handleEdit(testCase)}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                            title={t('common.move')}
                            onClick={() => handleMove(testCase.id)}
                        >
                            <FolderInput className="h-4 w-4" />
                        </Button>
                        <PermissionGate permission="test:delete">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title={t('test_case_list.delete_tooltip')}
                                onClick={() => handleDeleteClick(testCase.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </PermissionGate>
                    </div>
                )
            },
        },
    ], [canApprove, handleAutomation, handleRestore, location.pathname, location.search, projectId, quickRunMutation, t, updateStatusMutation])





    const [selectedTags, setSelectedTags] = useState<string[]>([])

    const { data: projectTags = [] } = useQuery({
        queryKey: ['tags', projectId],
        queryFn: async () => {
            // We need to import api or tagService. 
            // Since we don't have tagService in frontend yet, we can use api directly or create it.
            // For now, let's assume we can fetch it. 
            // Actually, TagManager fetches it too. 
            // Let's use api here.
            const { api } = await import("@/services/api");
            const res = await api.get(`/tags?projectId=${projectId}`);
            return res.data.data || res.data;
        },
        enabled: !!projectId
    })

    const filteredTestCases = useMemo(() => {
        if (!testCases) return []
        if (selectedTags.length === 0) return testCases

        return testCases.filter(tc => {
            const caseTagIds = tc.tags?.map(t => t.tag.id) || []
            // Match ANY selected tag (OR logic) or ALL (AND logic)? 
            // Usually OR for tags filter.
            return selectedTags.some(tagId => caseTagIds.includes(tagId))
        })
    }, [testCases, selectedTags])

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-muted-foreground">
                    {t('test_case_list.cases_count', { count: filteredTestCases.length })}
                </h3>
                <div className="flex gap-2">
                    <Button
                            size="sm"
                            className="h-8"
                            onClick={handleCreate}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('test_case_list.create_manual_button')}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-dashed">
                                <Plus className="mr-2 h-4 w-4" />
                                {t('test_case_list.filter_tags')}
                                {selectedTags.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 rounded-lg px-1 font-normal">
                                        {selectedTags.length}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuLabel>{t('test_case_list.filter_tags_label')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {projectTags.map((tag: any) => (
                                <DropdownMenuItem
                                    key={tag.id}
                                    onSelect={(e) => {
                                        e.preventDefault()
                                        setSelectedTags(prev =>
                                            prev.includes(tag.id)
                                                ? prev.filter(id => id !== tag.id)
                                                : [...prev, tag.id]
                                        )
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Checkbox checked={selectedTags.includes(tag.id)} />
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                        <span>{tag.name}</span>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                            {selectedTags.length > 0 && (
                                <>
                                    <DropdownMenuItem
                                        onSelect={() => setSelectedTags([])}
                                        className="justify-center text-center font-medium text-primary hover:text-primary hover:bg-primary/5 cursor-pointer"
                                    >
                                        {t('common.clear_filters')}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="hidden sm:inline">Daha fazla</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportService.exportTestCases(projectId)}>
                                <Download className="mr-2 h-3.5 w-3.5" />
                                {t('test_case_list.export_button')}
                            </DropdownMenuItem>
                            {user?.role === 'ADMIN' && (
                                <DropdownMenuItem onClick={() => setShowDeleted(!showDeleted)}>
                                    {showDeleted ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                                    {showDeleted ? t('test_case_list.hide_deleted') : t('test_case_list.show_deleted')}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <>
                    {/* Inline Creation Row (TestRail Style) */}
                    <PermissionGate permission="test:write">
                        <div className="bg-muted/30 p-3 rounded-lg border border-dashed border-muted-foreground/25">
                            <form onSubmit={handleInlineCreate} className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder={t('test_case_list.inline_create_placeholder_existing')}
                                        className="w-full bg-transparent border-none focus:outline-none text-sm h-9"
                                        value={newCaseTitle}
                                        onChange={(e) => setNewCaseTitle(e.target.value)}
                                    // autoFocus // Removed autofocus to avoid jumpiness
                                    />
                                </div>
                                <select
                                    className="h-8 text-xs bg-transparent border rounded-lg px-2 focus:outline-none"
                                    value={newCasePriority}
                                    onChange={(e) => setNewCasePriority(e.target.value as Priority)}
                                >
                                    <option value="LOW">{t('test_case_list.priority_low')}</option>
                                    <option value="MEDIUM">{t('test_case_list.priority_medium')}</option>
                                    <option value="HIGH">{t('test_case_list.priority_high')}</option>
                                    <option value="CRITICAL">{t('test_case_list.priority_critical')}</option>
                                </select>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!newCaseTitle.trim() || createMutation.isPending}
                                    className="h-8"
                                >
                                    <Plus className="mr-2 h-3.5 w-3.5" />
                                    {t('test_case_list.add_case_button')}
                                </Button>
                            </form>
                        </div>
                    </PermissionGate>

                    <DataTable
                        columns={columns}
                        data={filteredTestCases || []}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        getRowId={(row) => row.id}
                    />

                    <BulkActionsBar
                        selectedCount={Object.keys(rowSelection).length}
                        onDelete={(hardDelete) => bulkDeleteMutation.mutate(hardDelete)}
                        onStatusChange={(status) => bulkStatusMutation.mutate(status)}
                        isDeleting={bulkDeleteMutation.isPending}
                        isUpdating={bulkStatusMutation.isPending}
                        canApprove={canApprove}
                        onClearSelection={() => setRowSelection({})}
                    />
                </>
            )}

            <TestCaseDialog
                suiteId={suiteId}
                projectId={projectId}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                testCaseToEdit={editingCase}
            />
            {moveTestCaseId && (
                <MoveTestCaseDialog
                    open={isMoveDialogOpen}
                    onOpenChange={setIsMoveDialogOpen}
                    testCaseId={moveTestCaseId}
                    currentSuiteId={suiteId}
                    projectId={projectId}
                />
            )}

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('test_case_list.delete_confirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isHardDelete
                                ? t('test_case_list.permanent_delete_confirm')
                                : t('test_case_list.delete_confirm_soft')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex items-center space-x-2 py-4">
                        <Checkbox
                            id="hard-delete"
                            checked={isHardDelete}
                            onCheckedChange={(checked) => setIsHardDelete(checked === true)}
                        />
                        <Label htmlFor="hard-delete" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('test_case_list.permanent_delete_warning')}
                        </Label>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className={isHardDelete ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
