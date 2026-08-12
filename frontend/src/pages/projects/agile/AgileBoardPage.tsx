import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { agileService } from '@/services/agile.service';
import { useAuthStore } from "@/store/authStore";
import type { AgileBoardData } from '@/services/agile.service';
import type { Story } from '@/types/agile';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DragStart, DragUpdate, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    AlertCircle,
    CheckCircle,
    Rocket,
    CalendarDays,
    Target,
    GripVertical,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Search,
    Filter,
    SlidersHorizontal,
    X,
    User,
    ShieldAlert,
    Layers,
    TestTube,
    AlertTriangle,
    Workflow,
    Zap,
    BookmarkPlus,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StoryDetailDialog } from './components/StoryDetailDialog';
import { SprintCompletionDialog } from './components/SprintCompletionDialog';
import { useTranslation } from 'react-i18next';
import { validateWorkflowTransition } from '@/utils/agileWorkflowRules';
import { boardColumnService, WORK_ITEM_STATUS_OPTIONS } from '@/services/boardColumn.service';
import type { WorkItemStatus } from '@/services/boardColumn.service';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GlossaryTerm } from "@/components/help/GlossaryTerm";
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { WorkflowDiagram } from './components/WorkflowDiagram';
import { WorkflowPolicyManager } from './components/WorkflowPolicyManager';
import { WorkflowPublishingPanel } from './components/WorkflowPublishingPanel';
import { WorkflowTransitionManager } from './components/WorkflowTransitionManager';
import { WeeklyCapacityPanel } from './components/WeeklyCapacityPanel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { appRoutes } from '@/lib/routes';
import { savedViewService, type SavedView, type SavedViewScope } from '@/services/saved-view.service';
import { workflowSchemeService } from '@/services/workflow-scheme.service';
import { socketService } from '@/services/socket.service';

// ─── Workflow Templates ───────────────────────────────────────────────────────
const WORKFLOW_TEMPLATES: { labelKey: string; icon: string; columns: { nameKey: string; mappedStatus: WorkItemStatus; color: string }[] }[] = [
    {
        labelKey: 'agile_board.templates.software_development',
        icon: '⚡',
        columns: [
            { nameKey: 'agile_board.templates.columns.analysis', mappedStatus: 'IN_ANALYSIS', color: '#8B5CF6' },
            { nameKey: 'agile_board.templates.columns.development', mappedStatus: 'IN_PROGRESS', color: '#3B82F6' },
            { nameKey: 'agile_board.templates.columns.code_review', mappedStatus: 'READY_FOR_TEST', color: '#F59E0B' },
            { nameKey: 'agile_board.templates.columns.qa', mappedStatus: 'QA', color: '#F97316' },
            { nameKey: 'agile_board.templates.columns.done', mappedStatus: 'DONE', color: '#10B981' },
        ]
    },
    {
        labelKey: 'agile_board.templates.multi_environment',
        icon: '🌐',
        columns: [
            { nameKey: 'agile_board.templates.columns.todo', mappedStatus: 'TODO', color: '#6B7280' },
            { nameKey: 'agile_board.templates.columns.development', mappedStatus: 'IN_PROGRESS', color: '#3B82F6' },
            { nameKey: 'agile_board.templates.columns.test_dev', mappedStatus: 'READY_FOR_TEST', color: '#F59E0B' },
            { nameKey: 'agile_board.templates.columns.qa_test', mappedStatus: 'QA', color: '#F97316' },
            { nameKey: 'agile_board.templates.columns.uat', mappedStatus: 'RETEST', color: '#EC4899' },
            { nameKey: 'agile_board.templates.columns.done', mappedStatus: 'DONE', color: '#10B981' },
        ]
    },
    {
        labelKey: 'agile_board.templates.bug_tracking',
        icon: '🐛',
        columns: [
            { nameKey: 'agile_board.templates.columns.open', mappedStatus: 'OPEN', color: '#EF4444' },
            { nameKey: 'agile_board.templates.columns.fixing', mappedStatus: 'IN_PROGRESS', color: '#3B82F6' },
            { nameKey: 'agile_board.templates.columns.fixed', mappedStatus: 'FIXED', color: '#10B981' },
            { nameKey: 'agile_board.templates.columns.retest', mappedStatus: 'RETEST', color: '#F59E0B' },
            { nameKey: 'agile_board.templates.columns.closed', mappedStatus: 'CLOSED', color: '#6B7280' },
        ]
    },
];

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (!error || typeof error !== 'object' || !('response' in error)) return fallback;
    const response = (error as { response?: { data?: { message?: unknown, error?: unknown } } }).response;
    if (typeof response?.data?.error === 'string' && response.data.error.trim()) return response.data.error;
    return typeof response?.data?.message === 'string' && response.data.message.trim() ? response.data.message : fallback;
};

const COLUMN_COLORS = [
    '#6B7280', '#3B82F6', '#8B5CF6', '#EC4899',
    '#F59E0B', '#F97316', '#EF4444', '#10B981',
    '#14B8A6', '#06B6D4', '#84CC16', '#A855F7',
];

// ─── Priority color mapping ──────────────────────────────────────────────────
const priorityConfig: Record<string, { color: string; bg: string; border: string; labelKey: string }> = {
    CRITICAL: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-l-red-500', labelKey: 'story_detail_dialog.priorities.CRITICAL' },
    HIGH: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-l-orange-500', labelKey: 'story_detail_dialog.priorities.HIGH' },
    MEDIUM: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-l-blue-500', labelKey: 'story_detail_dialog.priorities.MEDIUM' },
    LOW: { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-l-slate-400', labelKey: 'story_detail_dialog.priorities.LOW' },
};

interface BoardAssignee {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
}

interface BoardItemWithAssignee {
    assignee?: BoardAssignee | null;
}

interface BoardViewConfig {
    filters: {
        search?: string;
        priority?: string;
        itemType?: string;
        assigneeId?: string;
    };
}
type SavedBoardView = SavedView<BoardViewConfig>;

interface LegacySavedBoardView {
    id: string;
    name: string;
    filters: BoardViewConfig['filters'];
}

const parseAssigneeFilter = (value: string | null): string[] => {
    if (!value || value === 'all') {
        return [];
    }

    return Array.from(
        new Set(value.split(',').map((id) => id.trim()).filter(Boolean))
    );
};

const serializeAssigneeFilter = (assigneeIds: string[]): string | undefined => {
    if (!assigneeIds.length) {
        return undefined;
    }
    return assigneeIds.join(',');
};

const isWeekday = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
};

const calculateBusinessDaysDelta = (from: Date, to: Date): number => {
    if (from.getTime() === to.getTime()) {
        return 0;
    }

    const direction = to > from ? 1 : -1;
    const cursor = new Date(from);
    let businessDayCount = 0;

    while ((direction === 1 && cursor < to) || (direction === -1 && cursor > to)) {
        cursor.setDate(cursor.getDate() + direction);
        if (isWeekday(cursor)) {
            businessDayCount += direction;
        }
    }

    return businessDayCount;
};

const collectAssignees = (data: AgileBoardData): BoardAssignee[] => {
    const assigneesMap = new Map<string, BoardAssignee>();
    const upsertAssignee = (item: BoardItemWithAssignee) => {
        if (item?.assignee?.id) {
            assigneesMap.set(item.assignee.id, item.assignee);
        }
    };

    data.columns.forEach((col) => col.items.forEach(upsertAssignee));
    data.unassignedItems?.forEach(upsertAssignee);

    return Array.from(assigneesMap.values()).sort((a, b) => {
        const fullNameA = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
        const fullNameB = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
        return fullNameA.localeCompare(fullNameB, undefined, { sensitivity: 'base' });
    });
};

const normalizeBoardItemType = (item: Story): NonNullable<Story['type']> => {
    if (item.itemType === 'BUG') {
        return 'bug';
    }

    if (item.itemType === 'TASK') {
        return 'task';
    }

    return 'story';
};

const AgileBoardPage = ({ resourceId, projectKey }: { resourceId?: string; projectKey?: string } = {}) => {
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = resourceId ?? routeProjectId;
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const checkPermission = useAuthStore((state) => state.checkPermission);
    const user = useAuthStore((state) => state.user);
    const canMove = checkPermission(projectId!, 'story:write');
    const searchFilterParam = searchParams.get('search') || '';
    const sprintIdFilter = searchParams.get('sprintId') || undefined;
    const assigneeFilterParam = searchParams.get('assigneeId') || undefined;
    const priorityFilterParam = searchParams.get('priority') || undefined;
    const itemTypeFilterParam = searchParams.get('itemType') || undefined;
    const selectedStoryId = searchParams.get('issue');

    // State
    const [allColumns, setAllColumns] = useState<AgileBoardData['columns']>([]);
    const [columns, setColumns] = useState<AgileBoardData['columns']>([]);
    const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
    const [activeSprint, setActiveSprint] = useState<AgileBoardData['activeSprint']>(null);
    const [activeDrag, setActiveDrag] = useState<{
        type: string;
        draggableId: string;
        sourceId: string;
        destinationId?: string;
        destinationIndex?: number;
    } | null>(null);
    const [confirmTransition, setConfirmTransition] = useState<{
        item: Story;
        destColId: string;
        autoTransitionParentId?: string;
        autoTransitionColumnId?: string;
        message: string;
    } | null>(null);

    // Column Management
    const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
    const [columnDialogMode, setColumnDialogMode] = useState<'create' | 'edit'>('create');
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [columnName, setColumnName] = useState('');
    const [columnMappedStatus, setColumnMappedStatus] = useState<WorkItemStatus | 'none'>('none');
    const [columnColor, setColumnColor] = useState('#6B7280');
    const [columnWipLimit, setColumnWipLimit] = useState<string>('');
    const [columnAllowedTransitions, setColumnAllowedTransitions] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const [isWorkflowDiagramOpen, setIsWorkflowDiagramOpen] = useState(false);
    const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
    const [templateApplyMode, setTemplateApplyMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');

    // Sprint Completion
    const [isSprintCompletionOpen, setIsSprintCompletionOpen] = useState(false);
    const [sprintCompletionStats, setSprintCompletionStats] = useState<import('@/services/agile.service').SprintCompletionStats | null>(null);

    const handleOpenSprintCompletion = async () => {
        if (!activeSprint?.id) return;
        try {
            const stats = await agileService.getSprintCompletionStats(activeSprint.id);
            setSprintCompletionStats(stats);
            setIsSprintCompletionOpen(true);
        } catch {
            toast.error(t('sprint_completion.error'));
        }
    };

    // Dynamic Filters
    const [searchQuery, setSearchQuery] = useState(() => searchFilterParam);
    const [isFiltersOpen, setIsFiltersOpen] = useState(() => Boolean(
        searchFilterParam || priorityFilterParam || itemTypeFilterParam || assigneeFilterParam
    ));
    const [allAssignees, setAllAssignees] = useState<BoardAssignee[]>([]);
    const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);
    const [savedViewName, setSavedViewName] = useState('');
    const [savedViewScope, setSavedViewScope] = useState<SavedViewScope>('PERSONAL');
    const priorityFilter = priorityFilterParam || 'all';
    const typeFilter = itemTypeFilterParam || 'all';
    const selectedAssigneeIds = parseAssigneeFilter(assigneeFilterParam ?? null);

    const draggedItem = useMemo(() => {
        if (!activeDrag || activeDrag.type !== 'ITEM') return null;
        return columns.flatMap(column => column.items).find(item => item.id === activeDrag.draggableId) ?? null;
    }, [activeDrag, columns]);

    const dragValidationByColumn = useMemo(() => {
        const validations = new Map<string, ReturnType<typeof validateWorkflowTransition>>();
        if (!activeDrag || activeDrag.type !== 'ITEM' || !draggedItem) return validations;

        columns.forEach(column => {
            validations.set(
                column.id,
                column.id === activeDrag.sourceId
                    ? { allowed: true }
                    : validateWorkflowTransition(draggedItem, column.id, columns, activeDrag.sourceId)
            );
        });
        return validations;
    }, [activeDrag, columns, draggedItem]);

    // Debounced search
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    const applyClientFilters = useCallback((rawColumns: AgileBoardData['columns']) => {
        const normalizedPriority = priorityFilterParam && priorityFilterParam !== 'all'
            ? priorityFilterParam.toUpperCase()
            : undefined;
        const normalizedItemType = itemTypeFilterParam && itemTypeFilterParam !== 'all'
            ? itemTypeFilterParam.toUpperCase()
            : undefined;
        const normalizedSearch = searchFilterParam.trim().toLowerCase();
        const selectedIds = parseAssigneeFilter(assigneeFilterParam ?? null);

        if (!normalizedPriority && !normalizedItemType && !normalizedSearch && selectedIds.length === 0) {
            return rawColumns;
        }

        return rawColumns.map((column) => ({
            ...column,
            items: column.items.filter((item) => {
                const assigneeId = item.assigneeId ?? item.assignee?.id;
                if (selectedIds.length > 0 && (!assigneeId || !selectedIds.includes(assigneeId))) {
                    return false;
                }

                const itemPriority = String(item.priority ?? '').toUpperCase();
                if (normalizedPriority && itemPriority !== normalizedPriority) {
                    return false;
                }

                const itemType = String(item.itemType ?? '').toUpperCase();
                if (normalizedItemType && itemType !== normalizedItemType) {
                    return false;
                }

                if (normalizedSearch) {
                    const searchable = `${item.title ?? item.name ?? ''} ${item.description ?? ''}`.toLowerCase();
                    if (!searchable.includes(normalizedSearch)) {
                        return false;
                    }
                }

                return true;
            })
        }));
    }, [assigneeFilterParam, itemTypeFilterParam, priorityFilterParam, searchFilterParam]);

    const formatBoardColumns = useCallback((data: AgileBoardData): AgileBoardData['columns'] => {
        const formattedColumns = data.columns.map(col => ({
            ...col,
            items: col.items.map((item) => ({ ...item, type: normalizeBoardItemType(item) }))
        }));

        if (data.unassignedItems?.length > 0 && formattedColumns.length > 0) {
            const firstCol = formattedColumns[0];
            firstCol.items = [
                ...firstCol.items,
                ...data.unassignedItems.map((item) => ({ ...item, type: normalizeBoardItemType(item) }))
            ];
        }

        return formattedColumns;
    }, []);

    const { data: boardData, isLoading, refetch: refetchBoard, error: boardError } = useQuery({
        queryKey: queryKeys.agile.board(projectId, sprintIdFilter),
        queryFn: () => agileService.getBoard(projectId!, { sprintId: sprintIdFilter }),
        enabled: Boolean(projectId),
    });

    const fetchBoard = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.agile.board(projectId, sprintIdFilter) });
        await refetchBoard();
    }, [queryClient, projectId, sprintIdFilter, refetchBoard]);

    useEffect(() => {
        if (!boardData) return;
        setActiveSprint(boardData.activeSprint);
        setAllAssignees(collectAssignees(boardData));
        setAllColumns(formatBoardColumns(boardData));
    }, [boardData, formatBoardColumns]);

    useEffect(() => {
        if (boardError) logger.error('Failed to fetch board', boardError);
    }, [boardError]);

    useEffect(() => {
        setColumns(applyClientFilters(allColumns));
    }, [allColumns, applyClientFilters]);

    useEffect(() => {
        setSearchQuery(searchFilterParam);
    }, [searchFilterParam]);

    useEffect(() => {
        if (searchFilterParam || priorityFilterParam || itemTypeFilterParam || assigneeFilterParam) {
            setIsFiltersOpen(true);
        }
    }, [assigneeFilterParam, itemTypeFilterParam, priorityFilterParam, searchFilterParam]);

    const savedViewQuery = useQuery({
        queryKey: ['saved-views', projectId, 'AGILE_BOARD'],
        queryFn: () => savedViewService.list<BoardViewConfig>(projectId!, 'AGILE_BOARD'),
        enabled: Boolean(projectId),
    });
    const savedViews = savedViewQuery.data ?? [];
    const workflowSchemeQuery = useQuery({
        queryKey: ['workflow-scheme', projectId],
        queryFn: () => workflowSchemeService.get(projectId!),
        enabled: Boolean(projectId),
    });
    const draftWorkflowColumns = workflowSchemeQuery.data?.draftConfig.columns ?? [];
    const saveDraftColumns = async (nextColumns: typeof draftWorkflowColumns) => {
        if (!projectId || !workflowSchemeQuery.data) return;
        await workflowSchemeService.saveDraft(projectId, {
            ...workflowSchemeQuery.data.draftConfig,
            columns: nextColumns.map((column, orderIndex) => ({ ...column, orderIndex })),
        });
        await queryClient.invalidateQueries({ queryKey: ['workflow-scheme', projectId] });
    };
    const migratedProjectsRef = useRef(new Set<string>());

    useEffect(() => {
        if (!projectId || !savedViewQuery.isSuccess || migratedProjectsRef.current.has(projectId)) return;
        migratedProjectsRef.current.add(projectId);
        const storageKey = `nexa-board-views:${projectId}`;
        try {
            const stored = window.localStorage.getItem(storageKey);
            const legacyViews = stored ? JSON.parse(stored) as LegacySavedBoardView[] : [];
            if (!Array.isArray(legacyViews) || legacyViews.length === 0) return;
            void Promise.all(legacyViews.map((view) => savedViewService.save({
                projectId,
                name: view.name,
                viewType: 'AGILE_BOARD',
                scope: 'PERSONAL',
                config: { filters: view.filters },
            }))).then(async () => {
                window.localStorage.removeItem(storageKey);
                await queryClient.invalidateQueries({ queryKey: ['saved-views', projectId, 'AGILE_BOARD'] });
                toast.success(t('agile_board.saved_views.migrated', 'Tarayıcıdaki görünümler hesabınıza taşındı.'));
            }).catch(() => {
                migratedProjectsRef.current.delete(projectId);
            });
        } catch {
            window.localStorage.removeItem(storageKey);
        }
    }, [projectId, queryClient, savedViewQuery.isSuccess, t]);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);

    // ─── WebSocket Real-Time Sync ────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId) return;

        socketService.joinProject(projectId);

        const handleBoardUpdate = (payload: any) => {
            if (payload?.type === 'UPDATE') {
                fetchBoard();
            }
        };

        socketService.on('board_update', handleBoardUpdate);

        return () => {
            socketService.off('board_update', handleBoardUpdate);
            socketService.leaveProject(projectId);
        };
    }, [projectId, fetchBoard]);

    const onDragStart = (start: DragStart) => {
        setActiveDrag({
            type: start.type,
            draggableId: start.draggableId,
            sourceId: start.source.droppableId,
            destinationId: start.source.droppableId,
            destinationIndex: start.source.index,
        });
    };

    const onDragUpdate = (update: DragUpdate) => {
        setActiveDrag(current => current ? {
            ...current,
            destinationId: update.destination?.droppableId,
            destinationIndex: update.destination?.index,
        } : null);
    };

    const onDragEnd = async (result: DropResult) => {
        setActiveDrag(null);
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === 'COLUMN') {
            const newColumns = [...columns];
            const [removed] = newColumns.splice(source.index, 1);
            newColumns.splice(destination.index, 0, removed);
            setColumns(newColumns);
            try {
                const order = new Map(newColumns.map((column, index) => [column.id, index]));
                const draft = [...draftWorkflowColumns].sort((a, b) => (order.get(a.id) ?? a.orderIndex) - (order.get(b.id) ?? b.orderIndex));
                await saveDraftColumns(draft);
                toast.success(t('workflow_versioning.draft_saved'));
            } catch {
                toast.error(t('agile_board.toast.reorder_error'));
                fetchBoard();
            }
            return;
        }

        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;
        const sourceColIndex = columns.findIndex(c => c.id === sourceColId);
        const destColIndex = columns.findIndex(c => c.id === destColId);
        if (sourceColIndex === -1 || destColIndex === -1) return;

        const sourceItems = [...columns[sourceColIndex].items];
        const destItems = sourceColId === destColId ? sourceItems : [...columns[destColIndex].items];
        const [removed] = sourceItems.splice(source.index, 1);

        // ─── Quality Gate Check ──────────────────────────────────────────────────
        const validation = validateWorkflowTransition(removed as Story, destColId, columns, sourceColId);
        if (!validation.allowed) {
            toast.error(validation.message || t('agile_board.workflow.blocked'));
            return;
        }

        if (validation.requireConfirmation) {
            setConfirmTransition({
                item: removed as Story,
                destColId,
                autoTransitionParentId: validation.autoTransitionParentId,
                autoTransitionColumnId: validation.autoTransitionColumnId,
                message: validation.message || t('agile_board.workflow.development_confirmation')
            });
            return;
        }

        const destMappedStatus = columns[destColIndex]?.mappedStatus;
        const updatedStatus = destMappedStatus || removed.status;
        const updatedItem = { ...removed, boardColumnId: destColId, status: updatedStatus };
        destItems.splice(destination.index, 0, updatedItem);

        const newColumns = [...columns];
        newColumns[sourceColIndex] = { ...newColumns[sourceColIndex], items: sourceItems };
        newColumns[destColIndex] = { ...newColumns[destColIndex], items: destItems };
        setColumns(newColumns);

        setAllColumns(prevAll => {
            const sIdx = prevAll.findIndex(c => c.id === sourceColId);
            const dIdx = prevAll.findIndex(c => c.id === destColId);
            if (sIdx === -1 || dIdx === -1) return prevAll;

            const targetMappedStatus = prevAll[dIdx]?.mappedStatus;
            const sItems = [...prevAll[sIdx].items];
            const dItems = sourceColId === destColId ? sItems : [...prevAll[dIdx].items];
            const itemIdx = sItems.findIndex(i => i.id === removed.id);
            if (itemIdx !== -1) {
                const [itemToMove] = sItems.splice(itemIdx, 1);
                dItems.splice(destination.index, 0, {
                    ...itemToMove,
                    boardColumnId: destColId,
                    status: targetMappedStatus || itemToMove.status
                });
                const nextAll = [...prevAll];
                nextAll[sIdx] = { ...nextAll[sIdx], items: sItems };
                nextAll[dIdx] = { ...nextAll[dIdx], items: dItems };
                return nextAll;
            }
            return prevAll;
        });

        try {
            const itemType = removed.type || normalizeBoardItemType(removed);
            await agileService.moveItem(itemType, removed.id, destColId);
            fetchBoard();
            await queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
            if (sourceColId !== destColId) {
                toast.success(t('agile_board.move_success'), {
                    action: {
                        label: t('common.undo'),
                        onClick: async () => {
                            try {
                                await agileService.moveItem(itemType, removed.id, sourceColId);
                                toast.success(t('agile_board.toast.move_undone'));
                                fetchBoard();
                                await queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
                            } catch {
                                toast.error(t('agile_board.toast.undo_error'));
                                fetchBoard();
                            }
                        },
                    },
                });
            }
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('agile_board.toast.move_error')));
            fetchBoard();
        }
    };

    // ─── Column CRUD ─────────────────────────────────────────────────────────────
    const resetColumnForm = () => {
        setColumnName('');
        setColumnMappedStatus('none');
        setColumnColor('#6B7280');
        setColumnWipLimit('');
        setColumnAllowedTransitions([]);
        setEditingColumnId(null);
    };

    const handleCreateColumn = () => {
        setColumnDialogMode('create');
        resetColumnForm();
        setIsColumnDialogOpen(true);
    };

    const handleEditColumn = (column: (typeof draftWorkflowColumns)[number]) => {
        setColumnDialogMode('edit');
        setColumnName(column.name);
        setColumnMappedStatus((column.mappedStatus as WorkItemStatus) || 'none');
        setColumnColor(column.color || '#6B7280');
        setColumnWipLimit(column.wipLimit != null ? String(column.wipLimit) : '');
        setColumnAllowedTransitions(column.allowedTransitions || []);
        setEditingColumnId(column.id);
        setIsColumnDialogOpen(true);
    };

    const handleDeleteColumn = async (columnId: string) => {
        const column = allColumns.find(c => c.id === columnId);
        if (column && column.items.length > 0) {
            toast.error(t('agile_board.toast.delete_error_items'));
            return;
        }
        if (!await confirm({
            description: t('agile_board.confirm_delete_column'),
            confirmLabel: t('common.delete'),
            destructive: true,
        })) return;
        try {
            await saveDraftColumns(draftWorkflowColumns.filter((entry) => entry.id !== columnId));
            toast.success(t('workflow_versioning.draft_saved'));
        } catch {
            toast.error(t('agile_board.toast.delete_error'));
        }
    };

    const handleColumnSubmit = async () => {
        if (!columnName.trim() || !projectId) return;
        setIsSubmitting(true);
        const fields = {
            name: columnName.trim(),
            mappedStatus: columnMappedStatus !== 'none' ? columnMappedStatus as WorkItemStatus : null,
            color: columnColor || null,
            wipLimit: columnWipLimit !== '' ? Number(columnWipLimit) : null,
            allowedTransitions: columnAllowedTransitions,
        };
        try {
            const now = new Date().toISOString();
            const nextColumns = columnDialogMode === 'create'
                ? [...draftWorkflowColumns, { id: crypto.randomUUID(), projectId, orderIndex: draftWorkflowColumns.length, isDefault: false, createdAt: now, updatedAt: now, ...fields }]
                : draftWorkflowColumns.map((column) => column.id === editingColumnId ? { ...column, ...fields } : column);
            await saveDraftColumns(nextColumns);
            toast.success(t('workflow_versioning.draft_saved'));
            setIsColumnDialogOpen(false);
        } catch {
            toast.error(t('agile_board.toast.save_error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApplyTemplate = async (templateIndex: number) => {
        if (!projectId) return;
        const template = WORKFLOW_TEMPLATES[templateIndex];
        if (!template) return;
        const templateName = t(template.labelKey);
        if (!await confirm({
            description: t(`agile_board.templates.confirm_${templateApplyMode.toLowerCase()}`, { name: templateName }),
            confirmLabel: t('common.apply', 'Uygula'),
        })) return;
        setIsApplyingTemplate(true);
        try {
            const generated = template.columns.map((column, index) => ({
                name: t(column.nameKey),
                mappedStatus: column.mappedStatus,
                color: column.color,
                wipLimit: null,
                allowedTransitionStatuses: [
                    template.columns[index - 1]?.mappedStatus,
                    template.columns[index + 1]?.mappedStatus,
                ].filter((status): status is WorkItemStatus => Boolean(status)),
            }));

            // Templates change the live board immediately. The API also remaps
            // work items by their workflow status while replacing/merging columns.
            await boardColumnService.applyTemplate({
                projectId,
                mode: templateApplyMode,
                columns: generated,
            });
            await Promise.all([
                fetchBoard(),
                workflowSchemeService.refreshDraft(projectId),
            ]);
            await queryClient.invalidateQueries({ queryKey: ['workflow-scheme', projectId] });
            toast.success(t('agile_board.templates.applied', { name: templateName }));
            setIsTemplateDialogOpen(false);
        } catch {
            toast.error(t('agile_board.templates.apply_error'));
        } finally {
            setIsApplyingTemplate(false);
        }
    };

    // ─── Filters ─────────────────────────────────────────────────────────────────
    const updateFilters = (updates: Record<string, string | undefined>) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([key, value]) => {
                if (value && value !== 'all') {
                    next.set(key, value);
                } else {
                    next.delete(key);
                }
            });
            return next;
        }, { replace: true });
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            updateFilters({ search: value || undefined });
        }, 400);
    };

    const clearFilters = () => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setSearchQuery('');
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            ['search', 'priority', 'itemType', 'assigneeId'].forEach((key) => next.delete(key));
            return next;
        }, { replace: true });
    };

    const hasActiveFilters = !!searchQuery.trim() || priorityFilter !== 'all' || typeFilter !== 'all' || selectedAssigneeIds.length > 0;
    const activeFilterCount = [
        Boolean(searchQuery.trim()),
        priorityFilter !== 'all',
        typeFilter !== 'all',
        selectedAssigneeIds.length > 0,
    ].filter(Boolean).length;

    const saveViewMutation = useMutation({
        mutationFn: (view: { name: string; scope: SavedViewScope; config: BoardViewConfig }) =>
            savedViewService.save({
                projectId: projectId!,
                name: view.name,
                viewType: 'AGILE_BOARD',
                scope: view.scope,
                config: view.config,
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['saved-views', projectId, 'AGILE_BOARD'] });
            setSavedViewName('');
            setSavedViewScope('PERSONAL');
            setIsSaveViewOpen(false);
            toast.success(t('agile_board.saved_views.saved'));
        },
        onError: () => toast.error(t('agile_board.saved_views.save_error', 'Görünüm kaydedilemedi.')),
    });

    const deleteViewMutation = useMutation({
        mutationFn: (viewId: string) => savedViewService.delete(projectId!, viewId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['saved-views', projectId, 'AGILE_BOARD'] });
            toast.success(t('agile_board.saved_views.deleted', 'Görünüm silindi.'));
        },
        onError: () => toast.error(t('agile_board.saved_views.delete_error', 'Görünüm silinemedi.')),
    });

    const saveCurrentView = () => {
        const name = savedViewName.trim();
        if (!name || !projectId) return;
        saveViewMutation.mutate({
            name,
            scope: savedViewScope,
            config: {
                filters: {
                    search: searchQuery.trim() || undefined,
                    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                    itemType: typeFilter !== 'all' ? typeFilter : undefined,
                    assigneeId: serializeAssigneeFilter(selectedAssigneeIds),
                },
            },
        });
    };

    const applySavedView = (view: SavedBoardView) => {
        const filters = view.config.filters;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setSearchQuery(filters.search ?? '');
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            ['search', 'priority', 'itemType', 'assigneeId'].forEach(key => next.delete(key));
            Object.entries(filters).forEach(([key, value]) => {
                if (value) next.set(key, value);
            });
            return next;
        }, { replace: true });
    };
    const totalItems = columns.reduce((sum, col) => sum + col.items.length, 0);
    const remainingSprintDays = useMemo(() => {
        if (!activeSprint?.endDate) return null;

        const endDate = new Date(activeSprint.endDate);
        if (Number.isNaN(endDate.getTime())) return null;

        const sprintEnd = new Date(endDate);
        sprintEnd.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return calculateBusinessDaysDelta(today, sprintEnd);
    }, [activeSprint?.endDate]);

    const sprintProgressData = useMemo(() => {
        let totalItems = 0;
        let doneItems = 0;
        let totalSP = 0;
        let doneSP = 0;

        const targetCols = allColumns.length > 0 ? allColumns : columns;

        targetCols.forEach((col) => {
            const colNameLower = (col.name || '').toLowerCase();
            const colStatus = String(col.mappedStatus || '').toUpperCase();
            
            const isDoneCol = colStatus === 'DONE' ||
                colStatus === 'CLOSED' ||
                colStatus === 'FIXED' ||
                colNameLower.includes('done') ||
                colNameLower.includes('bitti') ||
                colNameLower.includes('tamamlandı') ||
                colNameLower.includes('closed') ||
                colNameLower.includes('kapatıldı') ||
                colNameLower.includes('fixed') ||
                colNameLower.includes('düzeltildi') ||
                colNameLower.includes('çözüldü') ||
                colNameLower.includes('kapalı') ||
                colNameLower.includes('sonuçlandı');

            col.items?.forEach((item) => {
                totalItems++;
                const points = Number(item.storyPoints || item.points || 0);
                totalSP += points;

                const itemStatus = String(item.status || '').toUpperCase();
                const isItemDone = isDoneCol ||
                    itemStatus === 'DONE' ||
                    itemStatus === 'CLOSED' ||
                    itemStatus === 'FIXED' ||
                    itemStatus === 'RESOLVED';

                if (isItemDone) {
                    doneItems++;
                    doneSP += points;
                }
            });
        });

        const percentByItems = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
        const percentBySP = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : percentByItems;

        return {
            totalItems,
            doneItems,
            totalSP,
            doneSP,
            percentage: percentBySP,
            percentageItems: percentByItems
        };
    }, [allColumns, columns]);

    // ─── No Sprint Empty State ───────────────────────────────────────────────────
    if (!isLoading && columns.length === 0 && !activeSprint) {
        return (
            <div className="flex h-full flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <Rocket className="h-12 w-12 text-primary/60" />
                    </div>
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">{t('agile_board.no_active_sprint_title')}</h2>
                    <p className="text-muted-foreground">{t('agile_board.no_active_sprint_desc')}</p>
                </div>
                <div className="flex gap-4">
                    <Button size="lg" variant="outline" className="gap-2 rounded-lg" onClick={handleCreateColumn}>
                        <Plus className="h-4 w-4" />
                        {t('agile_board.add_column')}
                    </Button>
                    <Button size="lg" className="gap-2 rounded-lg" onClick={() => navigate(projectKey ? appRoutes.projectSection(projectKey, "backlog") : `/projects/${projectId}?tab=backlog`)}>
                        <Target className="h-4 w-4" />
                        {t('agile_board.go_backlog')}
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Main Board ──────────────────────────────────────────────────────────────
    return (
        <div className="absolute inset-0 flex flex-col overflow-hidden">
            {/* ─── Compact Header & Filters ─── */}
            <div data-testid="board-header" className="z-10 shrink-0 border-b border-border/60 bg-card px-3 py-2 sm:px-4">
                <div className="flex min-h-9 items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <Layers className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <div className="flex min-w-0 items-center gap-2">
                                    <h1 className="truncate text-enterprise-header text-base tracking-tight sm:text-lg">{t('agile_board.title')}</h1>
                                    <Badge
                                        variant="outline"
                                        className={activeSprint
                                            ? "h-5 shrink-0 border-success/30 bg-success/10 px-1.5 text-[9px] font-bold uppercase tracking-wider text-success"
                                            : "h-5 shrink-0 border-muted-foreground/30 bg-muted/20 px-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
                                        }
                                    >
                                        {activeSprint ? t('agile_board.active') : t('agile_board.no_active_sprint')}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="hidden max-w-[13rem] truncate font-semibold text-foreground/75 sm:inline">{activeSprint?.name || '-'}</span>
                                    {remainingSprintDays !== null && (
                                        <span className={`hidden items-center gap-1 text-[11px] text-enterprise-muted md:inline-flex ${remainingSprintDays < 0 ? 'font-bold text-destructive' : ''}`}>
                                            <CalendarDays className="h-3 w-3" />
                                            <span className={remainingSprintDays < 0 ? 'font-bold text-destructive' : undefined}>
                                                {remainingSprintDays < 0
                                                    ? t('project_dashboard.active_sprint.overdue')
                                                    : t('project_dashboard.active_sprint.days_left', { count: remainingSprintDays })}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        <span className="hidden rounded-md bg-muted/40 px-2 py-1 text-[10px] font-bold text-muted-foreground sm:inline-flex">
                            {t('agile_board.items_count', { count: totalItems })}
                        </span>
                        {activeSprint && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-success/40 text-success hover:border-success/60 hover:bg-success/10"
                                onClick={handleOpenSprintCompletion}
                                aria-label={t('agile_board.complete_sprint')}
                                title={t('agile_board.complete_sprint')}
                            >
                                <CheckCircle className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant={isFiltersOpen || hasActiveFilters ? "secondary" : "ghost"}
                            size="sm"
                            className={`h-8 gap-1.5 px-2 text-xs ${hasActiveFilters ? 'text-primary' : 'text-muted-foreground'}`}
                            onClick={() => setIsFiltersOpen((open) => !open)}
                            aria-expanded={isFiltersOpen}
                            aria-controls="board-filters"
                            title={t('agile_board.filters.toggle', 'Filtreler')}
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t('agile_board.filters.toggle', 'Filtreler')}</span>
                            {activeFilterCount > 0 && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t('common.more', 'Daha fazla')} title={t('common.more', 'Daha fazla')}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onSelect={() => setIsWorkflowDiagramOpen(true)}>
                                    <Workflow className="mr-2 h-4 w-4" />
                                    {t('agile_board.workflow_diagram.button')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setIsTemplateDialogOpen(true)}>
                                    <Zap className="mr-2 h-4 w-4 text-primary" />
                                    {t('agile_board.templates.button')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={handleCreateColumn} size="sm" className="h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-sm">
                            <Plus className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t('agile_board.add_column')}</span>
                        </Button>
                    </div>
                </div>

                {/* ─── Sprint Progress ─── */}
                {activeSprint && (
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="shrink-0 font-semibold">{sprintProgressData.doneItems}/{sprintProgressData.totalItems}</span>
                        <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/80" role="progressbar" aria-valuenow={sprintProgressData.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={t('agile_board.sprint_progress', 'Sprint İlerlemesi')}>
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
                                style={{ width: `${sprintProgressData.percentage}%` }}
                            />
                        </div>
                        <span className="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">%{sprintProgressData.percentage}</span>
                        {sprintProgressData.totalSP > 0 && (
                            <span className="hidden shrink-0 font-mono text-primary sm:inline">{sprintProgressData.doneSP}/{sprintProgressData.totalSP} SP</span>
                        )}
                    </div>
                )}

                {isFiltersOpen && <div id="board-filters" data-testid="board-filters" role="region" aria-label={t('agile_board.filters.toggle', 'Filtreler')} className="mt-2 border-t border-border/50 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                    {/* Search */}
                        <div className="group relative w-full md:w-56">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/70 transition-colors group-focus-within:text-primary" />
                            <Input
                                placeholder={t('agile_board.search_placeholder')}
                                className="h-8 rounded-md border-border/50 bg-background pl-8 text-xs shadow-none transition-colors hover:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/40"
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    onClick={() => handleSearchChange('')}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="mx-1 hidden h-4 w-px bg-border sm:block" />

                        {/* Assignee filter */}
                        <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${selectedAssigneeIds.length === 0 ? 'border-primary bg-primary/10' : 'border-muted bg-muted/50 hover:border-primary/50'}`}
                                            onClick={() => updateFilters({ assigneeId: undefined })}
                                        >
                                            <User className={`h-3 w-3 ${selectedAssigneeIds.length === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">{t('agile_board.filters.all_assignees')}</TooltipContent>
                                </Tooltip>

                                {allAssignees.map((user) => (
                                    <Tooltip key={user.id}>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const isSelected = selectedAssigneeIds.includes(user.id);
                                                    const nextAssigneeIds = isSelected
                                                        ? selectedAssigneeIds.filter((id) => id !== user.id)
                                                        : [...selectedAssigneeIds, user.id];
                                                    updateFilters({ assigneeId: serializeAssigneeFilter(nextAssigneeIds) });
                                                }}
                                                className="rounded-full"
                                            >
                                                <Avatar
                                                    className={`h-6 w-6 cursor-pointer border-2 transition-colors ${selectedAssigneeIds.includes(user.id) ? 'border-primary ring-2 ring-primary/20' : 'border-muted hover:border-primary/50'}`}
                                                >
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.email ?? user.id}`} />
                                                    <AvatarFallback className="text-[10px] font-medium">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                                </Avatar>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs">{user.firstName} {user.lastName}</TooltipContent>
                                    </Tooltip>
                                ))}

                                {selectedAssigneeIds.length > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                                        {t('agile_board.filters.selected_count', { count: selectedAssigneeIds.length })}
                                    </Badge>
                                )}
                            </div>
                        </TooltipProvider>

                        <div className="mx-1 hidden h-4 w-px bg-border sm:block" />

                        <Select value={priorityFilter} onValueChange={(val) => updateFilters({ priority: val })}>
                            <SelectTrigger className="h-8 w-[118px] gap-1.5 text-xs font-medium">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                <SelectValue placeholder={t('common.priority')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                                <SelectItem value="all">{t('common.all')}</SelectItem>
                                <SelectItem value="CRITICAL"><span className="font-bold text-red-500">{t('story_detail_dialog.priorities.CRITICAL')}</span></SelectItem>
                                <SelectItem value="HIGH"><span className="font-bold text-orange-500">{t('story_detail_dialog.priorities.HIGH')}</span></SelectItem>
                                <SelectItem value="MEDIUM"><span className="font-bold text-blue-500">{t('story_detail_dialog.priorities.MEDIUM')}</span></SelectItem>
                                <SelectItem value="LOW"><span className="font-bold text-slate-500">{t('story_detail_dialog.priorities.LOW')}</span></SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={(val) => updateFilters({ itemType: val })}>
                            <SelectTrigger className="h-8 w-[102px] gap-1.5 text-xs font-medium">
                                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                <SelectValue placeholder={t('common.type')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                                <SelectItem value="all">{t('common.all')}</SelectItem>
                                <SelectItem value="STORY">{t('agile_board.story')}</SelectItem>
                                <SelectItem value="BUG">{t('agile_board.bug')}</SelectItem>
                            </SelectContent>
                        </Select>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t('agile_board.saved_views.title')} title={t('agile_board.saved_views.title')}>
                                    <BookmarkPlus className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>{t('agile_board.saved_views.title')}</DropdownMenuLabel>
                                {savedViews.length === 0 && (
                                    <div className="px-2 py-2 text-xs text-muted-foreground">{t('agile_board.saved_views.empty')}</div>
                                )}
                                {savedViews.map(view => (
                                    <DropdownMenuItem key={view.id} className="flex justify-between gap-2" onSelect={() => applySavedView(view)}>
                                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                                        {view.scope === 'PROJECT' && <Badge variant="secondary" className="h-5 text-[9px]">{t('agile_board.saved_views.project_scope', 'Proje')}</Badge>}
                                        {(view.userId === user?.id || (view.scope === 'PROJECT' && ['ADMIN', 'TEAM_LEADER'].includes(user?.role || ''))) && (
                                            <button
                                                type="button"
                                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                aria-label={t('agile_board.saved_views.delete')}
                                                disabled={deleteViewMutation.isPending}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    deleteViewMutation.mutate(view.id);
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setIsSaveViewOpen(true)} disabled={!hasActiveFilters}>
                                    <BookmarkPlus className="mr-2 h-4 w-4" />
                                    {t('agile_board.saved_views.save_current')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                    {/* Clear */}
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={clearFilters}
                            >
                                <X className="h-3 w-3" />
                                {t('agile_board.clear_filters')}
                            </Button>
                        )}
                    </div>
                </div>}
            </div>

            {/* ─── Board Area ─── */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {activeDrag?.type === 'ITEM' && activeDrag.destinationId
                    ? dragValidationByColumn.get(activeDrag.destinationId)?.allowed === false
                        ? t('agile_board.invalid_drop_target')
                        : t('agile_board.drop_target', {
                            column: columns.find(column => column.id === activeDrag.destinationId)?.name ?? '',
                            position: (activeDrag.destinationIndex ?? 0) + 1,
                        })
                    : ''}
            </div>
            {columns.length > 0 && <div className="flex shrink-0 items-center gap-2 border-b bg-card px-4 py-2 md:hidden">
                <Button type="button" size="icon" variant="outline" aria-label="Önceki kolon" disabled={mobileColumnIndex === 0} onClick={() => { const next = Math.max(0, mobileColumnIndex - 1); setMobileColumnIndex(next); document.getElementById(`board-column-${columns[next].id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); }}><ChevronLeft /></Button>
                <Select value={String(mobileColumnIndex)} onValueChange={(value) => { const next = Number(value); setMobileColumnIndex(next); document.getElementById(`board-column-${columns[next].id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); }}><SelectTrigger aria-label="Gösterilen board kolonu" className="min-w-0 flex-1"><SelectValue /></SelectTrigger><SelectContent>{columns.map((column, index) => <SelectItem key={column.id} value={String(index)}>{index + 1}/{columns.length} · {column.name} ({column.items.length})</SelectItem>)}</SelectContent></Select>
                <Button type="button" size="icon" variant="outline" aria-label="Sonraki kolon" disabled={mobileColumnIndex === columns.length - 1} onClick={() => { const next = Math.min(columns.length - 1, mobileColumnIndex + 1); setMobileColumnIndex(next); document.getElementById(`board-column-${columns[next].id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); }}><ChevronRight /></Button>
            </div>}
            <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                <Droppable droppableId="board" direction="horizontal" type="COLUMN">
                    {(provided) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="flex flex-1 min-h-0 min-w-0 gap-3 overflow-x-auto overflow-y-hidden bg-background p-3 sm:p-4"
                        >
                            {columns.map((col, colIndex) => (
                                <Draggable key={col.id} draggableId={col.id} index={colIndex}>
                                    {(provided, snapshot) => (
                                        <div
                                            id={`board-column-${col.id}`}
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex w-[320px] min-w-[320px] flex-col rounded-[var(--radius-card)] border bg-card transition-[box-shadow,border-color,background-color] duration-200 ease-out ${snapshot.isDragging ? 'border-primary/40 ring-2 ring-primary/15 shadow-lg' : 'border-border/70 shadow-sm'}`}
                                            style={{
                                                ...provided.draggableProps.style,
                                                transition: snapshot.isDropAnimating
                                                    ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                                                    : provided.draggableProps.style?.transition,
                                            }}
                                        >
                                            {/* Column Header */}
                                            <div
                                                {...provided.dragHandleProps}
                                                className="group flex shrink-0 items-center justify-between rounded-t-xl border-b border-border/50 bg-muted/30 px-4 py-3"
                                                style={{ borderTopColor: col.color || undefined, borderTopWidth: col.color ? 3 : undefined, borderTopStyle: col.color ? 'solid' : undefined }}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                                                    {col.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />}
                                                    <span className="text-enterprise-header text-sm truncate">{col.name}</span>
                                                    {(() => {
                                                        const count = col.items?.length || 0;
                                                        const wipOver = col.wipLimit && col.wipLimit > 0 && count > col.wipLimit;
                                                        return (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={`h-6 rounded-lg px-2 font-bold text-[10px] ${wipOver ? 'bg-red-500/20 text-red-600 border border-red-500/40' : 'bg-background/50 text-muted-foreground/80'}`}
                                                                >
                                                                    {count}{col.wipLimit ? `/${col.wipLimit}` : ''}
                                                                </Badge>
                                                                {wipOver && (
                                                                    <TooltipProvider delayDuration={100}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="bottom" className="text-xs">
                                                                                {t('agile_board.wip.exceeded', { count, limit: col.wipLimit })}
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100">
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                            <span className="sr-only">{t('common.actions')}</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-36">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                const draftColumn = draftWorkflowColumns.find((entry) => entry.id === col.id);
                                                                if (draftColumn) handleEditColumn(draftColumn);
                                                            }}
                                                            disabled={!draftWorkflowColumns.some((entry) => entry.id === col.id)}
                                                            className="text-xs"
                                                        >
                                                            <Pencil className="mr-2 h-3.5 w-3.5" />
                                                            {t('common.edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive text-xs"
                                                            onClick={() => handleDeleteColumn(col.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                            {t('common.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            {/* Column Body */}
                                            <Droppable
                                                droppableId={col.id}
                                                type="ITEM"
                                                isDropDisabled={activeDrag?.type === 'ITEM' && dragValidationByColumn.get(col.id)?.allowed === false}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        data-testid={`board-column-${col.name.replace(/\s+/g, '-').toLowerCase()}`}
                                                        className={`relative flex-1 space-y-2 overflow-y-auto rounded-b-xl border-2 border-transparent p-2 transition-[background-color,border-color,box-shadow] duration-300 ease-out ${snapshot.isDraggingOver ? 'border-primary/35 bg-primary/[0.07] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]' : ''}`}
                                                    >
                                                        {activeDrag?.type === 'ITEM' && dragValidationByColumn.get(col.id)?.allowed === false && (
                                                            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-b-xl border-2 border-dashed border-destructive/30 bg-background/75 px-5 text-center" aria-hidden="true">
                                                                <div className="rounded-lg border border-destructive/20 bg-background px-3 py-2 text-xs font-medium text-destructive shadow-sm">
                                                                    <AlertCircle className="mx-auto mb-1 h-4 w-4" />
                                                                    {t('agile_board.invalid_drop_target')}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {snapshot.isDraggingOver && activeDrag?.type === 'ITEM' && (
                                                            <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex h-7 items-center justify-center rounded-lg border border-primary/25 bg-background/95 text-[10px] font-semibold text-primary shadow-md" aria-live="polite">
                                                                {t('agile_board.drop_target', { column: col.name, position: (activeDrag.destinationIndex ?? 0) + 1 })}
                                                            </div>
                                                        )}
                                                        {col.items?.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="flex h-full min-h-[120px] flex-col items-center justify-center py-8 text-center">
                                                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
                                                                    <Layers className="h-4 w-4 text-muted-foreground/40" />
                                                                </div>
                                                                <p className="text-[11px] font-medium text-muted-foreground/50">
                                                                    {t('agile_board.empty_column')}
                                                                </p>
                                                                <p className="mt-0.5 text-[10px] text-muted-foreground/30">
                                                                    {t('agile_board.drag_here')}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {col.items?.map((item, index) => (
                                                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canMove}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        data-testid={`work-item-card-${item.key}`}
                                                                        className="relative"
                                                                        style={{
                                                                            ...provided.draggableProps.style,
                                                                            transition: snapshot.isDropAnimating
                                                                                ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                                                                                : provided.draggableProps.style?.transition,
                                                                        }}
                                                                        onClick={() => {
                                                                            setSearchParams(prev => {
                                                                                const next = new URLSearchParams(prev);
                                                                                next.set('issue', item.key || item.id);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                    >
                                                                        {activeDrag?.type === 'ITEM' && activeDrag.destinationId === col.id && activeDrag.destinationIndex === index && activeDrag.draggableId !== item.id && (
                                                                            <div className="pointer-events-none absolute -top-[5px] left-2 right-2 z-30 flex items-center" aria-hidden="true">
                                                                                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--background))]" />
                                                                                <span className="h-0.5 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]" />
                                                                            </div>
                                                                        )}
                                                                        <Card className={`group/card border-l-[3px] bg-card transition-[border-color,box-shadow] duration-150 ease-out ${snapshot.isDragging ? 'ring-2 ring-primary/30 shadow-lg' : 'hover:border-border-strong'} ${!canMove ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'} ${priorityConfig[item.priority]?.border || 'border-l-transparent'} overflow-hidden`}>
                                                                            <CardContent className="p-4 space-y-3">
                                                                                {/* Header Row: Type & Points */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        {item.type === 'bug' ? (
                                                                                            <Badge variant="outline" className="h-5 shrink-0 gap-1 border-red-500/30 bg-red-500/5 text-[11px] font-medium text-red-500">
                                                                                                <AlertCircle className="w-2.5 h-2.5" />
                                                                                                {t('agile_board.bug')}
                                                                                            </Badge>
                                                                                        ) : (
                                                                                            <Badge variant="outline" className="h-5 shrink-0 gap-1 border-blue-500/30 bg-blue-500/5 text-[11px] font-medium text-blue-500">
                                                                                                <CheckCircle className="w-2.5 h-2.5" />
                                                                                                {t('agile_board.story')}
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                    {(item.storyPoints || item.points) && (
                                                                                        <div className="flex h-5 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-bold text-primary ring-1 ring-inset ring-primary/20">
                                                                                            <span>{item.storyPoints || item.points}</span>
                                                                                            <span className="text-[10px] font-medium opacity-70">SP</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Title */}
                                                                                <p className="text-[14px] font-semibold leading-relaxed text-foreground/90 line-clamp-2 min-h-[2.5rem]">
                                                                                    {item.title || item.name}
                                                                                </p>

                                                                                {/* Footer Stats */}
                                                                                <div className="flex items-center justify-between pt-1">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                                                                            <TestTube className="h-3 w-3" />
                                                                                            <span className="font-bold">{item._count?.testCases || item.testCases?.length || 0}</span>
                                                                                        </div>
                                                                                        {item.priority && priorityConfig[item.priority] && (
                                                                                            <Badge variant="outline" className={`h-5 gap-1 border-none text-[11px] font-medium ${priorityConfig[item.priority].bg} ${priorityConfig[item.priority].color}`}>
                                                                                                {t(priorityConfig[item.priority].labelKey)}
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>

                                                                                    {item.assignee && (
                                                                                        <TooltipProvider delayDuration={200}>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Avatar className="h-6 w-6 border border-border/70">
                                                                                                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${item.assignee.email}`} />
                                                                                                        <AvatarFallback className="text-[9px] font-bold bg-primary/5 text-primary">{item.assignee.firstName?.[0]}</AvatarFallback>
                                                                                                    </Avatar>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent side="bottom" className="text-xs font-medium">
                                                                                                    {item.assignee.firstName} {item.assignee.lastName}
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    )}
                                                                                </div>

                                                                                {/* ID */}
                                                                                <div className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                                                                    {item.key ? item.key : `#${item.id.substring(0, 8)}`}
                                                                                </div>
                                                                            </CardContent>
                                                                        </Card>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {activeDrag?.type === 'ITEM' && activeDrag.destinationId === col.id && activeDrag.destinationIndex === col.items.length && (
                                                            <div className="pointer-events-none flex items-center px-2" aria-hidden="true">
                                                                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--background))]" />
                                                                <span className="h-0.5 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]" />
                                                            </div>
                                                        )}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}


                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <Dialog open={isSaveViewOpen} onOpenChange={setIsSaveViewOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{t('agile_board.saved_views.dialog_title')}</DialogTitle>
                        <DialogDescription>{t('agile_board.saved_views.dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="saved-view-name">{t('agile_board.saved_views.name')}</Label>
                        <Input
                            id="saved-view-name"
                            className="mt-2"
                            value={savedViewName}
                            onChange={event => setSavedViewName(event.target.value)}
                            onKeyDown={event => { if (event.key === 'Enter') saveCurrentView(); }}
                            autoFocus
                        />
                    </div>
                    {['ADMIN', 'TEAM_LEADER'].includes(user?.role || '') && (
                        <div className="space-y-2">
                            <Label id="saved-view-scope-label">{t('agile_board.saved_views.scope', 'Paylaşım')}</Label>
                            <Select value={savedViewScope} onValueChange={(value) => setSavedViewScope(value as SavedViewScope)}>
                                <SelectTrigger aria-labelledby="saved-view-scope-label"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PERSONAL">{t('agile_board.saved_views.personal_scope', 'Yalnızca ben')}</SelectItem>
                                    <SelectItem value="PROJECT">{t('agile_board.saved_views.project_scope_description', 'Projedeki herkes')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveViewOpen(false)} disabled={saveViewMutation.isPending}>{t('common.cancel')}</Button>
                        <Button onClick={saveCurrentView} disabled={!savedViewName.trim() || saveViewMutation.isPending}>{saveViewMutation.isPending ? t('common.saving') : t('common.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Column Config Dialog ─── */}
            <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Workflow className="h-5 w-5 text-primary" />
                            {columnDialogMode === 'create' ? t('agile_board.column_dialog.create_title') : t('agile_board.column_dialog.edit_title')}
                        </DialogTitle>
                        <DialogDescription>{t('agile_board.column_dialog.description')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Name + Color */}
                        <div className="flex gap-3">
                            <div className="flex-1 space-y-1.5">
                                <Label htmlFor="col-name">{t('agile_board.column_dialog.name')}</Label>
                                <Input
                                    id="col-name"
                                    value={columnName}
                                    onChange={(e) => setColumnName(e.target.value)}
                                    placeholder={t('agile_board.column_dialog.name_placeholder')}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{t('agile_board.column_dialog.color')}</Label>
                                <div className="flex flex-wrap gap-1.5 max-w-[160px]">
                                    {COLUMN_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColumnColor(c)}
                                            className={`h-6 w-6 rounded-full border-2 transition-all ${
                                                columnColor === c ? 'border-foreground scale-110' : 'border-transparent'
                                            }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Mapped Status */}
                        <div className="space-y-1.5">
                            <Label>{t('agile_board.column_dialog.status')}</Label>
                            <p className="text-xs text-muted-foreground">{t('agile_board.column_dialog.status_description')}</p>
                            <Select value={columnMappedStatus} onValueChange={(v) => setColumnMappedStatus(v as WorkItemStatus | 'none')}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder={t('agile_board.column_dialog.status_placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('agile_board.column_dialog.no_mapping')}</SelectItem>
                                    {WORK_ITEM_STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: opt.color }} />
                                                {t(opt.labelKey)}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* WIP Limit */}
                        <div className="space-y-1.5">
                            <Label htmlFor="wip-limit"><GlossaryTerm term="WIP">{t('agile_board.column_dialog.wip_limit')}</GlossaryTerm> <span className="text-muted-foreground font-normal">({t('common.optional')})</span></Label>
                            <p className="text-xs text-muted-foreground">{t('agile_board.column_dialog.wip_description')}</p>
                            <Input
                                id="wip-limit"
                                type="number"
                                min={0}
                                value={columnWipLimit}
                                onChange={(e) => setColumnWipLimit(e.target.value)}
                                placeholder={t('agile_board.column_dialog.unlimited')}
                                className="w-32"
                            />
                        </div>

                        <Separator />

                        {/* Allowed Transitions */}
                        <div className="space-y-2">
                            <Label>{t('agile_board.column_dialog.allowed_transitions')}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t('agile_board.column_dialog.allowed_transitions_description')}
                            </p>
                            {allColumns.filter(c => c.id !== editingColumnId).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">{t('agile_board.column_dialog.no_other_columns')}</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border/40 p-3">
                                    {allColumns.filter(c => c.id !== editingColumnId).map(col => (
                                        <div key={col.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`transition-${col.id}`}
                                                checked={columnAllowedTransitions.includes(col.id)}
                                                onCheckedChange={(checked) => {
                                                    setColumnAllowedTransitions(prev =>
                                                        checked
                                                            ? [...prev, col.id]
                                                            : prev.filter(id => id !== col.id)
                                                    );
                                                }}
                                            />
                                            <label htmlFor={`transition-${col.id}`} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color || '#6B7280' }} />
                                                {col.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsColumnDialogOpen(false)} disabled={isSubmitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleColumnSubmit} disabled={isSubmitting || !columnName.trim()}>
                            {isSubmitting ? t('common.saving') : t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Workflow Template Dialog ─── */}
            <Dialog open={isWorkflowDiagramOpen} onOpenChange={setIsWorkflowDiagramOpen}>
                <DialogContent className="max-h-[90vh] max-w-[min(96vw,1200px)] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Workflow className="h-5 w-5 text-primary" />
                            {t('agile_board.workflow_diagram.title')}
                        </DialogTitle>
                        <DialogDescription>{t('agile_board.workflow_diagram.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                        {t('workflow_versioning.draft_notice')}
                    </div>
                    <WorkflowDiagram columns={draftWorkflowColumns} transitions={workflowSchemeQuery.data?.draftConfig.transitions ?? []} />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {draftWorkflowColumns.map((column) => (
                            <div key={column.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{column.name}</div>
                                    <div className="text-xs text-muted-foreground">{t('agile_board.workflow_diagram.transition_count', { count: column.allowedTransitions.length })}</div>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditColumn(column)} aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => void handleDeleteColumn(column.id)} aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" className="min-h-14 border-dashed" onClick={handleCreateColumn}><Plus className="mr-2 h-4 w-4" />{t('agile_board.add_column')}</Button>
                    </div>
                    {projectId && <WorkflowPolicyManager projectId={projectId} />}
                    {projectId && <WorkflowTransitionManager projectId={projectId} />}
                    {projectId && <WorkflowPublishingPanel projectId={projectId} onPublished={fetchBoard} />}
                    {projectId && <WeeklyCapacityPanel projectId={projectId} />}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWorkflowDiagramOpen(false)}>{t('common.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Workflow Template Dialog ─── */}
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            {t('agile_board.templates.dialog_title')}
                        </DialogTitle>
                        <DialogDescription>{t('agile_board.templates.dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>{t('agile_board.templates.apply_mode')}</Label>
                        <Select value={templateApplyMode} onValueChange={(value) => setTemplateApplyMode(value as 'REPLACE' | 'APPEND')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="REPLACE">{t('agile_board.templates.mode_replace')}</SelectItem>
                                <SelectItem value="APPEND">{t('agile_board.templates.mode_merge')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {t(`agile_board.templates.mode_${templateApplyMode === 'REPLACE' ? 'replace' : 'merge'}_description`)}
                        </p>
                    </div>
                    <div className="space-y-3 py-2">
                        {WORKFLOW_TEMPLATES.map((tpl, idx) => (
                            <button
                                key={idx}
                                type="button"
                                disabled={isApplyingTemplate}
                                onClick={() => handleApplyTemplate(idx)}
                                className="w-full rounded-xl border border-border/50 bg-muted/20 p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{tpl.icon}</span>
                                    <span className="font-semibold text-sm">{t(tpl.labelKey)}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {tpl.columns.map((col, ci) => (
                                        <span
                                            key={ci}
                                            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                                            style={{ backgroundColor: col.color }}
                                        >
                                            {t(col.nameKey)}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>{t('common.cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!confirmTransition} onOpenChange={(open) => { if (!open) setConfirmTransition(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{t('common.confirm')}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm text-foreground/80">
                        {confirmTransition?.message}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmTransition(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={async () => {
                                if (confirmTransition) {
                                    const { item, destColId, autoTransitionParentId, autoTransitionColumnId } = confirmTransition;
                                    setConfirmTransition(null);
                                    try {
                                        const itemType = item.type || normalizeBoardItemType(item);
                                        await agileService.moveItem(itemType, item.id, destColId);
                                        if (autoTransitionParentId && autoTransitionColumnId) {
                                            // Move parent to Ready for Test
                                            await agileService.moveItem('story', autoTransitionParentId, autoTransitionColumnId);
                                            toast.success(t('agile_board.toast.parent_transitioned'));
                                        } else {
                                            toast.success(t('agile_board.toast.move_success'));
                                        }
                                        fetchBoard();
                                    } catch (error) {
                                        toast.error(getApiErrorMessage(error, t('agile_board.toast.move_error')));
                                        fetchBoard();
                                    }
                                }
                            }}
                        >
                            {t('common.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <StoryDetailDialog
                storyId={selectedStoryId}
                open={!!selectedStoryId}
                onOpenChange={(open) => { 
                    if (!open) {
                        setSearchParams(prev => {
                            const next = new URLSearchParams(prev);
                            next.delete('issue');
                            return next;
                        });
                    }
                }}
                onUpdate={fetchBoard}
            />

            <SprintCompletionDialog
                open={isSprintCompletionOpen}
                onOpenChange={setIsSprintCompletionOpen}
                stats={sprintCompletionStats}
                onComplete={() => {
                    setSprintCompletionStats(null);
                    fetchBoard();
                }}
            />
        </div>
    );
};

export default AgileBoardPage;
import { logger } from '@/utils/logger';
