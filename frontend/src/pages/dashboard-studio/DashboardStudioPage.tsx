import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Check,
    Copy,
    Edit3,
    LayoutDashboard,
    Library,
    Loader2,
    MoreHorizontal,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Star,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { PageHeader, PageToolbar } from '@/components/layout/PageChrome';
import { PageQueryError } from '@/components/layout/PageQueryError';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { cn } from '@/lib/utils';
import { dashboardStudioService } from '@/services/dashboard-studio.service';
import { projectService } from '@/services/project.service';
import { useAuthStore } from '@/store/authStore';
import type { DashboardWidget, DashboardWidgetCatalogItem } from '@/types/dashboard-studio';
import { CreateDashboardDialog } from './components/CreateDashboardDialog';
import { DashboardWidgetCard } from './components/DashboardWidgetCard';
import { WidgetLibrarySheet } from './components/WidgetLibrarySheet';
import { widgetSpanClass } from './dashboard-studio-config';

const studioKeys = {
    root: ['dashboard-studio'] as const,
    list: ['dashboard-studio', 'list'] as const,
    catalog: ['dashboard-studio', 'catalog'] as const,
    data: (id: string) => ['dashboard-studio', 'data', id] as const,
};

export default function DashboardStudioPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const client = useQueryClient();
    const { confirm } = useAppDialog();
    const user = useAuthStore((state) => state.user);
    const canCreateProject = user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER';
    const canCreateOrganization = user?.role === 'ADMIN';
    const selectedId = searchParams.get('dashboard') || '';
    const [editingDashboardId, setEditingDashboardId] = useState<string>();
    const [dirty, setDirty] = useState(false);
    const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[] | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [cloneFromId, setCloneFromId] = useState<string>();
    const [libraryOpen, setLibraryOpen] = useState(false);

    useUnsavedChangesWarning(dirty);

    const dashboardsQuery = useQuery({
        queryKey: studioKeys.list,
        queryFn: async () => {
            await dashboardStudioService.ensureDefault();
            return dashboardStudioService.list();
        },
        staleTime: 30_000,
    });
    const catalogQuery = useQuery({ queryKey: studioKeys.catalog, queryFn: dashboardStudioService.getCatalog, staleTime: 30 * 60_000 });
    const projectsQuery = useQuery({
        queryKey: ['projects', 'dashboard-studio-picker'],
        queryFn: () => projectService.getAll(1, 100, 'name', 'asc'),
        enabled: canCreateProject,
        staleTime: 60_000,
    });

    const dashboards = useMemo(() => dashboardsQuery.data ?? [], [dashboardsQuery.data]);
    const catalogByType = useMemo(
        () => new Map((catalogQuery.data ?? []).map((item) => [item.type, item])),
        [catalogQuery.data],
    );
    const activeId = dashboards.some((item) => item.id === selectedId)
        ? selectedId
        : dashboards.find((item) => item.isDefault)?.id || dashboards[0]?.id || '';
    const activeDashboard = dashboards.find((item) => item.id === activeId);
    const editMode = Boolean(activeId && editingDashboardId === activeId);

    useEffect(() => {
        if (!activeId || selectedId === activeId) return;
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('dashboard', activeId);
            return next;
        }, { replace: true });
    }, [activeId, selectedId, setSearchParams]);

    const dataQuery = useQuery({
        queryKey: studioKeys.data(activeId),
        queryFn: () => dashboardStudioService.getData(activeId),
        enabled: Boolean(activeId),
        staleTime: 30_000,
        refetchInterval: editMode ? false : 60_000,
    });

    const serverWidgets = useMemo(() => sortWidgets(dataQuery.data?.dashboard.widgets ?? []), [dataQuery.data?.dashboard.widgets]);
    const widgets = editMode ? (draftWidgets ?? serverWidgets) : serverWidgets;

    const createMutation = useMutation({
        mutationFn: dashboardStudioService.create,
        onSuccess: async (created) => {
            setCreateOpen(false);
            setCloneFromId(undefined);
            setDirty(false);
            setDraftWidgets(null);
            await client.invalidateQueries({ queryKey: studioKeys.root });
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set('dashboard', created.id);
                return next;
            });
            toast.success(t('dashboard_studio.toast.created'));
        },
        onError: (error) => toast.error(errorMessage(error, t('dashboard_studio.toast.create_error'))),
    });

    const saveMutation = useMutation({
        mutationFn: () => dashboardStudioService.saveLayout(activeId, {
            expectedLayoutVersion: dataQuery.data?.dashboard.layoutVersion,
            widgets: normalizeLayout(widgets).map(({ id, type, title, positionX, positionY, width, height, config }) => ({
                id,
                type,
                title,
                positionX,
                positionY,
                width,
                height,
                config,
            })),
        }),
        onSuccess: async () => {
            setDirty(false);
            setEditingDashboardId(undefined);
            setDraftWidgets(null);
            await Promise.all([
                client.invalidateQueries({ queryKey: studioKeys.list }),
                client.invalidateQueries({ queryKey: studioKeys.data(activeId) }),
            ]);
            toast.success(t('dashboard_studio.toast.saved'));
        },
        onError: (error) => toast.error(errorMessage(error, t('dashboard_studio.toast.save_error'))),
    });

    const defaultMutation = useMutation({
        mutationFn: dashboardStudioService.setDefault,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: studioKeys.list });
            toast.success(t('dashboard_studio.toast.default_set'));
        },
        onError: (error) => toast.error(errorMessage(error, t('dashboard_studio.toast.default_error'))),
    });

    const archiveMutation = useMutation({
        mutationFn: dashboardStudioService.archive,
        onSuccess: async () => {
            setDirty(false);
            setEditingDashboardId(undefined);
            setDraftWidgets(null);
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.delete('dashboard');
                return next;
            }, { replace: true });
            await client.invalidateQueries({ queryKey: studioKeys.root });
            toast.success(t('dashboard_studio.toast.archived'));
        },
        onError: (error) => toast.error(errorMessage(error, t('dashboard_studio.toast.archive_error'))),
    });

    const canEdit = Boolean(activeDashboard && user && (
        (activeDashboard.scope === 'PERSONAL' && activeDashboard.ownerId === user.id)
        || (activeDashboard.scope === 'PROJECT' && canCreateProject)
        || (activeDashboard.scope === 'ORGANIZATION' && canCreateOrganization)
    ));
    const canArchive = Boolean(activeDashboard && user && (activeDashboard.ownerId === user.id || user.role === 'ADMIN'));
    const canSetDefault = Boolean(activeDashboard && !activeDashboard.isDefault);

    const selectDashboard = async (id: string) => {
        if (saveMutation.isPending) return;
        if (id === activeId) return;
        if (dirty && !await confirm({
            title: t('dashboard_studio.unsaved.title'),
            description: t('dashboard_studio.unsaved.description'),
            confirmLabel: t('dashboard_studio.unsaved.discard'),
            cancelLabel: t('dashboard_studio.unsaved.keep_editing'),
            destructive: true,
        })) return;
        setDirty(false);
        setEditingDashboardId(undefined);
        setDraftWidgets(null);
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('dashboard', id);
            return next;
        });
    };

    const cancelEditing = async () => {
        if (dirty && !await confirm({
            title: t('dashboard_studio.unsaved.title'),
            description: t('dashboard_studio.unsaved.description'),
            confirmLabel: t('dashboard_studio.unsaved.discard'),
            cancelLabel: t('dashboard_studio.unsaved.keep_editing'),
            destructive: true,
        })) return;
        setDraftWidgets(null);
        setDirty(false);
        setEditingDashboardId(undefined);
    };

    const archiveDashboard = async () => {
        if (!activeDashboard) return;
        const approved = await confirm({
            title: t('dashboard_studio.archive.title'),
            description: t('dashboard_studio.archive.description', { name: activeDashboard.name }),
            confirmLabel: t('dashboard_studio.archive.confirm'),
            cancelLabel: t('common.cancel'),
            destructive: true,
        });
        if (approved) archiveMutation.mutate(activeDashboard.id);
    };

    const updateWidgets = (producer: (current: DashboardWidget[]) => DashboardWidget[]) => {
        setDraftWidgets((current) => normalizeLayout(producer(current ?? serverWidgets)));
        setDirty(true);
    };

    const addWidget = (catalogItem: DashboardWidgetCatalogItem) => {
        const nextIndex = widgets.length;
        updateWidgets((current) => [...current, {
            id: `draft-${crypto.randomUUID()}`,
            type: catalogItem.type,
            title: t(`dashboard_studio.widgets.${catalogItem.type}.title`),
            positionX: 0,
            positionY: nextIndex,
            width: Math.max(catalogItem.minWidth, catalogItem.type.startsWith('KPI_') ? 3 : 6),
            height: Math.max(catalogItem.minHeight, catalogItem.type.startsWith('KPI_') ? 2 : 3),
            config: {},
        }]);
        toast.success(t('dashboard_studio.toast.widget_added'));
    };

    const moveWidget = (index: number, direction: -1 | 1) => updateWidgets((current) => {
        const target = index + direction;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    });

    const onDragEnd = ({ source, destination }: DropResult) => {
        if (!destination || source.index === destination.index) return;
        updateWidgets((current) => {
            const next = [...current];
            const [moved] = next.splice(source.index, 1);
            next.splice(destination.index, 0, moved);
            return next;
        });
    };

    const resizeWidget = (index: number, dimension: 'width' | 'height', delta: -1 | 1) => {
        const widget = widgets[index];
        const definition = catalogQuery.data?.find((item) => item.type === widget.type);
        const minimum = dimension === 'width' ? definition?.minWidth ?? 2 : definition?.minHeight ?? 2;
        updateWidgets((current) => current.map((item, itemIndex) => itemIndex === index
            ? { ...item, [dimension]: Math.min(12, Math.max(minimum, item[dimension] + delta)) }
            : item));
    };

    const beginEditing = async (openLibrary = false) => {
        if (dirty && editingDashboardId && editingDashboardId !== activeId && !await confirm({
            title: t('dashboard_studio.unsaved.title'),
            description: t('dashboard_studio.unsaved.description'),
            confirmLabel: t('dashboard_studio.unsaved.discard'),
            cancelLabel: t('dashboard_studio.unsaved.keep_editing'),
            destructive: true,
        })) return;
        setDirty(false);
        setDraftWidgets(serverWidgets);
        setEditingDashboardId(activeId);
        if (openLibrary) setLibraryOpen(true);
    };

    const generatedAt = dataQuery.data?.generatedAt
        ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dataQuery.data.generatedAt))
        : undefined;

    if (dashboardsQuery.isLoading) {
        return <div className="page-shell page-stack"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-14 rounded-xl" /><div className="grid gap-4 xl:grid-cols-12"><Skeleton className="h-52 xl:col-span-4" /><Skeleton className="h-52 xl:col-span-8" /><Skeleton className="h-72 xl:col-span-6" /><Skeleton className="h-72 xl:col-span-6" /></div></div>;
    }

    if (dashboardsQuery.isError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void dashboardsQuery.refetch()} /></div>;
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={<span className="flex items-center gap-2"><LayoutDashboard className="h-6 w-6 text-primary" />{t('dashboard_studio.title')}</span>}
                description={t('dashboard_studio.description')}
                meta={activeDashboard && <><Badge variant="outline">{t(`dashboard_studio.scope.${activeDashboard.scope}`)}</Badge>{activeDashboard.project && <span>{activeDashboard.project.key} · {activeDashboard.project.name}</span>}{generatedAt && <span>{t('dashboard_studio.generated_at', { date: generatedAt })}</span>}</>}
                actions={<Button data-testid="dashboard-studio-new-btn" onClick={() => { setCloneFromId(undefined); setCreateOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.new_dashboard')}</Button>}
            />

            {!dashboards.length ? (
                <EmptyState
                    icon={LayoutDashboard}
                    title={t('dashboard_studio.empty.title')}
                    description={t('dashboard_studio.empty.description')}
                    action={{ label: t('dashboard_studio.empty.action'), onClick: () => setCreateOpen(true) }}
                />
            ) : (
                <>
                    <PageToolbar className="sticky top-[var(--density-header-height)] z-20">
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={activeId} onValueChange={(id) => void selectDashboard(id)} disabled={saveMutation.isPending}>
                                <SelectTrigger data-testid="dashboard-studio-select" className="min-w-0 flex-1 sm:min-w-56 sm:max-w-80" aria-label={t('dashboard_studio.actions.select_dashboard')}><SelectValue /></SelectTrigger>
                                <SelectContent>{dashboards.map((dashboard) => (
                                    <SelectItem key={dashboard.id} value={dashboard.id}>
                                        <span className="flex items-center gap-2">{dashboard.isDefault && <Star className="h-3.5 w-3.5 fill-current text-amber-500" />}{dashboard.name}</span>
                                    </SelectItem>
                                ))}</SelectContent>
                            </Select>
                            {editMode && dirty && <Badge variant="warning" className="gap-1"><span className="h-1.5 w-1.5 rounded-full bg-current" />{t('dashboard_studio.unsaved.badge')}</Badge>}
                            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
                                {!editMode ? (
                                    <>
                                        <TooltipProvider>
                                            <Tooltip><TooltipTrigger asChild><Button data-testid="dashboard-studio-refresh-btn" variant="outline" size="icon" aria-label={t('dashboard_studio.actions.refresh')} onClick={() => void dataQuery.refetch()} disabled={dataQuery.isFetching}><RefreshCw className={cn('h-4 w-4', dataQuery.isFetching && 'animate-spin')} /></Button></TooltipTrigger><TooltipContent>{t('dashboard_studio.actions.refresh')}</TooltipContent></Tooltip>
                                        </TooltipProvider>
                                        {canEdit && <Button data-testid="dashboard-studio-customize-btn" variant="outline" onClick={() => void beginEditing()}><Edit3 className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.customize')}</Button>}
                                    </>
                                ) : (
                                    <>
                                        <Button data-testid="dashboard-studio-add-widget-btn" variant="outline" onClick={() => setLibraryOpen(true)}><Library className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.add_widget')}</Button>
                                        <Button data-testid="dashboard-studio-cancel-edit-btn" variant="ghost" onClick={() => void cancelEditing()} disabled={saveMutation.isPending}><RotateCcw className="mr-2 h-4 w-4" />{t('common.cancel')}</Button>
                                        <Button data-testid="dashboard-studio-save-btn" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
                                            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('common.save')}
                                        </Button>
                                    </>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button data-testid="dashboard-studio-more-btn" variant="ghost" size="icon" aria-label={t('common.more')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem data-testid="dashboard-studio-clone-option" onSelect={() => { setCloneFromId(activeId); setCreateOpen(true); }}><Copy className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.clone')}</DropdownMenuItem>
                                        {canSetDefault && <DropdownMenuItem data-testid="dashboard-studio-set-default-option" onSelect={() => defaultMutation.mutate(activeId)} disabled={defaultMutation.isPending}><Star className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.set_default')}</DropdownMenuItem>}
                                        {activeDashboard?.isDefault && <DropdownMenuItem disabled><Check className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.is_default')}</DropdownMenuItem>}
                                        {canArchive && <><DropdownMenuSeparator /><DropdownMenuItem data-testid="dashboard-studio-archive-option" className="text-destructive focus:text-destructive" onSelect={() => void archiveDashboard()} disabled={archiveMutation.isPending}><Trash2 className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.archive')}</DropdownMenuItem></>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </PageToolbar>

                    {dataQuery.isError ? (
                        <PageQueryError onRetry={() => void dataQuery.refetch()} />
                    ) : dataQuery.isLoading ? (
                        <div className="grid gap-4 xl:grid-cols-12"><Skeleton className="h-52 xl:col-span-4" /><Skeleton className="h-52 xl:col-span-8" /><Skeleton className="h-72 xl:col-span-6" /><Skeleton className="h-72 xl:col-span-6" /></div>
                    ) : !widgets.length ? (
                        <div className="rounded-xl border border-dashed bg-card">
                            <EmptyState icon={Library} title={t('dashboard_studio.no_widgets.title')} description={t('dashboard_studio.no_widgets.description')} action={canEdit ? { label: t('dashboard_studio.actions.add_widget'), onClick: () => void beginEditing(true) } : undefined} />
                        </div>
                    ) : (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="dashboard-studio-grid" isDropDisabled={!editMode}>
                                {(dropProvided, dropSnapshot) => (
                                    <section
                                        ref={dropProvided.innerRef}
                                        {...dropProvided.droppableProps}
                                        className={cn('grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12', dropSnapshot.isDraggingOver && 'rounded-xl bg-primary/[0.03] ring-1 ring-primary/10')}
                                        aria-label={t('dashboard_studio.widget_grid')}
                                    >
                                        {widgets.map((widget, index) => (
                                            <Draggable key={widget.id} draggableId={widget.id} index={index} isDragDisabled={!editMode}>
                                                {(dragProvided, dragSnapshot) => (
                                                    <div
                                                        ref={dragProvided.innerRef}
                                                        {...dragProvided.draggableProps}
                                                        className={cn('min-w-0', widgetSpanClass(widget.width), dragSnapshot.isDragging && 'z-50 opacity-95 shadow-xl')}
                                                        style={dragProvided.draggableProps.style}
                                                    >
                                                        <DashboardWidgetCard
                                                            widget={widget}
                                                            result={dataQuery.data?.widgets.find((result) => result.id === widget.id)}
                                                            editMode={editMode}
                                                            isFirst={index === 0}
                                                            isLast={index === widgets.length - 1}
                                                            minWidth={catalogByType.get(widget.type)?.minWidth ?? 2}
                                                            minHeight={catalogByType.get(widget.type)?.minHeight ?? 2}
                                                            dragHandleProps={dragProvided.dragHandleProps}
                                                            onMove={(direction) => moveWidget(index, direction)}
                                                            onResize={(dimension, delta) => resizeWidget(index, dimension, delta)}
                                                            onRemove={() => updateWidgets((current) => current.filter((item) => item.id !== widget.id))}
                                                            onTitleChange={(title) => updateWidgets((current) => current.map((item) => item.id === widget.id ? { ...item, title, config: { ...(item.config || {}), defaultTitle: false } } : item))}
                                                            onNavigate={(path) => {
                                                                const target = safeInternalPath(path);
                                                                if (!editMode && target) navigate(target);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {dropProvided.placeholder}
                                    </section>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}
                </>
            )}

            {createOpen && <CreateDashboardDialog
                open={createOpen}
                onOpenChange={(open) => { setCreateOpen(open); if (!open) setCloneFromId(undefined); }}
                dashboards={dashboards}
                projects={(projectsQuery.data?.data ?? []).map(({ id, key, name }) => ({ id, key, name }))}
                canCreateProject={canCreateProject}
                canCreateOrganization={canCreateOrganization}
                isPending={createMutation.isPending}
                projectsLoading={projectsQuery.isLoading}
                initialCloneId={cloneFromId}
                onSubmit={(input) => createMutation.mutate(input)}
            />}
            <WidgetLibrarySheet
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                catalog={catalogQuery.data ?? []}
                loading={catalogQuery.isLoading}
                error={catalogQuery.isError}
                onRetry={() => void catalogQuery.refetch()}
                widgetTypes={widgets.map((widget) => widget.type)}
                widgetCount={widgets.length}
                onAdd={addWidget}
            />
        </div>
    );
}

function sortWidgets(widgets: DashboardWidget[]) {
    return [...widgets].sort((a, b) => a.positionY - b.positionY || a.positionX - b.positionX);
}

function normalizeLayout(widgets: DashboardWidget[]) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    return widgets.map((widget) => {
        const width = Math.min(12, Math.max(2, widget.width));
        const height = Math.min(12, Math.max(2, widget.height));
        if (x > 0 && x + width > 12) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        const normalized = { ...widget, positionX: x, positionY: y, width, height };
        x += width;
        rowHeight = Math.max(rowHeight, height);
        if (x >= 12) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        return normalized;
    });
}

function errorMessage(error: unknown, fallback: string) {
    const apiMessage = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    return fallback;
}

function safeInternalPath(value: string) {
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.origin !== window.location.origin) return undefined;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return undefined;
    }
}
