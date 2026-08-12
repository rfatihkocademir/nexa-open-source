import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreVertical, Plus, Trash2, Edit, RotateCcw, Eye, EyeOff, Search, Upload } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
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
import { Skeleton } from "@/components/ui/skeleton"
import { testSuiteService } from "@/services/testSuite.service"
import type { TestSuite } from "@/types/testSuite"
import { CreateSuiteDialog } from "./CreateSuiteDialog"
import { ImportDialog } from "./ImportDialog"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/store/authStore";
import { PermissionGate } from "@/components/auth/PermissionGate"
import { queryKeys } from "@/lib/queryKeys"

interface TestSuiteListProps {
    projectId: string
    onSelectSuite?: (suiteId: string) => void
    selectedSuiteId?: string | null
}

interface TestSuiteNodeProps {
    suite: TestSuite & { deletedAt?: string | null }
    depth?: number
    projectId: string
    onDelete: (id: string, name: string) => void
    onRestore: (id: string) => void
    onSelect: (id: string) => void
    selectedId?: string | null
    isAdmin: boolean
}

function TestSuiteNode({ suite, depth = 0, projectId, onDelete, onRestore, onSelect, selectedId, isAdmin }: TestSuiteNodeProps) {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(true)
    const hasChildren = suite.children && suite.children.length > 0
    const isSelected = suite.id === selectedId
    const isDeleted = !!suite.deletedAt

    return (
        <div className="flex flex-col select-none">
            <div
                role="button"
                className={cn(
                    "group flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer text-sm transition-all duration-200 border border-transparent",
                    isDeleted && "opacity-50 bg-red-500/5 border-red-500/20",
                    !isDeleted && isSelected
                        ? "bg-primary/10 text-primary font-medium border-primary/20 shadow-sm"
                        : !isDeleted && "hover:bg-muted/50 hover:text-foreground text-muted-foreground",
                    depth > 0 && "ml-4"
                )}
                onClick={(e) => {
                    e.stopPropagation()
                    if (!isDeleted) {
                        onSelect(suite.id)
                    }
                }}
            >
                {/* Expand/Collapse Icon */}
                <div
                    className={cn(
                        "p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors",
                        !hasChildren && "invisible"
                    )}
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsExpanded(!isExpanded)
                    }}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                    )}
                </div>

                {/* Folder Icon */}
                {isExpanded ? (
                    <FolderOpen className={cn(
                        "h-4 w-4 transition-colors",
                        isDeleted ? "text-red-400" : isSelected ? "text-primary fill-primary/20" : "text-yellow-500 fill-yellow-500/20"
                    )} />
                ) : (
                    <Folder className={cn(
                        "h-4 w-4 transition-colors",
                        isDeleted ? "text-red-400" : isSelected ? "text-primary fill-primary/20" : "text-yellow-500 fill-yellow-500/20"
                    )} />
                )}

                {/* Suite Name */}
                <span className={cn("flex-1 truncate", isDeleted && "line-through")}>{suite.name}</span>

                {/* Deleted Badge */}
                {isDeleted && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-medium">
                        {t('test_suite_list.deleted')}
                    </Badge>
                )}

                {/* Children Count Badge */}
                {!isDeleted && suite._count?.children ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground group-hover:text-foreground transition-colors">
                        {suite._count.children} ↳
                    </Badge>
                ) : null}

                {/* Case Count Badge */}
                {!isDeleted && suite._count?.testCases ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground transition-colors">
                        {suite._count.testCases}
                    </Badge>
                ) : null}

                {/* Actions (Hidden until hover) */}
                <div className={cn("flex items-center transition-opacity", isSelected || isDeleted ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    {isDeleted && isAdmin ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRestore(suite.id)
                            }}
                            title={t('test_suite_list.restore')}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    ) : !isDeleted && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="h-3 w-3" />
                                    <span className="sr-only">{t('common.actions')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <CreateSuiteDialog
                                    projectId={projectId}
                                    parentId={suite.id}
                                    trigger={
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Plus className="mr-2 h-3.5 w-3.5" />
                                            {t('test_suite_list.add_sub_suite')}
                                        </DropdownMenuItem>
                                    }
                                />
                                <CreateSuiteDialog
                                    projectId={projectId}
                                    suiteToEdit={suite}
                                    trigger={
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Edit className="mr-2 h-3.5 w-3.5" />
                                            {t('test_suite_list.rename')}
                                        </DropdownMenuItem>
                                    }
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete(suite.id, suite.name)
                                    }}
                                >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    {t('test_suite_list.delete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className="flex flex-col border-l border-muted/50 ml-[1.1rem] pl-1">
                    {suite.children?.map((child) => (
                        <TestSuiteNode
                            key={child.id}
                            suite={child as TestSuite & { deletedAt?: string | null }}
                            depth={depth + 1}
                            projectId={projectId}
                            onDelete={onDelete}
                            onRestore={onRestore}
                            onSelect={onSelect}
                            selectedId={selectedId}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function TestSuiteList({ projectId, onSelectSuite, selectedSuiteId }: TestSuiteListProps) {
    const { t } = useTranslation()
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'
    const queryClient = useQueryClient()

    const [showDeleted, setShowDeleted] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [suiteToDelete, setSuiteToDelete] = useState<{ id: string; name: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const { data: suites, isLoading } = useQuery({
        queryKey: queryKeys.testSuites(projectId, showDeleted),
        queryFn: () => testSuiteService.getAll(projectId, showDeleted),
    })

    const openDeleteDialog = (id: string, name: string) => {
        setSuiteToDelete({ id, name })
        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!suiteToDelete) return
        setIsDeleting(true)
        try {
            await testSuiteService.delete(suiteToDelete.id)
            toast.success(t('test_suite_list.delete_success'))
            if (selectedSuiteId === suiteToDelete.id && onSelectSuite) {
                onSelectSuite("")
            }
            await queryClient.invalidateQueries({ queryKey: ["test-suites", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(t('test_suite_list.delete_error'))
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
            setSuiteToDelete(null)
        }
    }

    const handleRestore = async (id: string) => {
        try {
            await testSuiteService.restore(id)
            toast.success(t('test_suite_list.restore_success'))
            await queryClient.invalidateQueries({ queryKey: ["test-suites", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(t('test_suite_list.restore_error'))
        }
    }

    // Build tree from flat list
    const buildTree = useCallback((items: (TestSuite & { deletedAt?: string | null })[]) => {
        const map = new Map<string, TestSuite & { deletedAt?: string | null }>()
        const roots: (TestSuite & { deletedAt?: string | null })[] = []

        // Initialize map with items and empty children array
        items.forEach((item) => {
            map.set(item.id, { ...item, children: [] })
        })

        // Build hierarchy
        items.forEach((item) => {
            const node = map.get(item.id)!
            if (item.parentId) {
                const parent = map.get(item.parentId)
                if (parent) {
                    parent.children?.push(node)
                } else {
                    roots.push(node)
                }
            } else {
                roots.push(node)
            }
        })

        return roots
    }, [])

    const suiteItems = useMemo(() => (suites?.items ?? []).filter((suite) => suite.name !== '__ORPHAN_CASES__'), [suites?.items]);
    const tree = useMemo(() => buildTree(suiteItems), [buildTree, suiteItems])
    const filteredTree = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR')
        if (!normalizedSearch) return tree

        const filterNodes = (nodes: typeof tree): typeof tree => nodes.flatMap((node) => {
            const matchingChildren = filterNodes((node.children ?? []) as typeof tree)
            const matches = node.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)

            if (!matches && matchingChildren.length === 0) return []
            return [{ ...node, children: matches ? node.children : matchingChildren }]
        })

        return filterNodes(tree)
    }, [searchTerm, tree])

    if (isLoading) {
        return (
            <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        )
    }

    if (!isLoading && suiteItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <Folder className="h-8 w-8 text-primary/40" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">{t('dashboard.no_suites')}</h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                    {t('project_details.select_suite_desc')}
                </p>
                <PermissionGate permission="test-suite:write">
                     <CreateSuiteDialog 
                        projectId={projectId} 
                        trigger={
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {t('test_suite_list.create_button')}
                            </Button>
                        }
                    />
                </PermissionGate>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col">
            <div className="mb-3 space-y-2 px-1">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t('test_suite_list.explorer_title')}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground/70">
                        {suiteItems.length} set
                    </span>
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 text-muted-foreground", showDeleted && "text-red-500")}
                            onClick={() => setShowDeleted(!showDeleted)}
                            title={showDeleted ? t('test_suite_list.hide_deleted') : t('test_suite_list.show_deleted')}
                        >
                            {showDeleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2">
                    <CreateSuiteDialog
                        projectId={projectId}
                        trigger={
                            <Button className="h-8 min-w-0 w-full justify-center gap-2 px-2 text-xs">
                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{t('test_suite_list.create_button')}</span>
                            </Button>
                        }
                    />
                    <ImportDialog
                        projectId={projectId}
                        trigger={
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-9 shrink-0"
                                title={t('import_dialog.trigger_button')}
                            >
                                <Upload className="h-3.5 w-3.5" />
                                <span className="sr-only">{t('import_dialog.trigger_button')}</span>
                            </Button>
                        }
                    />
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Test setlerinde ara"
                        aria-label="Test setlerinde ara"
                        className="h-8 bg-muted/20 pl-8 pr-2 text-xs"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                {filteredTree.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <FolderOpen className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm">
                            {searchTerm.trim()
                                ? 'Aramanızla eşleşen test seti yok.'
                                : showDeleted
                                ? t('test_suite_list.no_deleted_suites')
                                : t('test_suite_list.no_suites_found')
                            }
                        </p>
                    </div>
                ) : (
                    filteredTree.map((suite) => (
                        <TestSuiteNode
                            key={suite.id}
                            suite={suite}
                            projectId={projectId}
                            onDelete={openDeleteDialog}
                            onRestore={handleRestore}
                            onSelect={(id) => onSelectSuite && onSelectSuite(id)}
                            selectedId={selectedSuiteId}
                            isAdmin={isAdmin}
                        />
                    ))
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="!bg-background">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('test_suite_list.delete_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('test_suite_list.delete_confirm_message', { name: suiteToDelete?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? t('common.deleting') : t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
import { logger } from "@/utils/logger";
