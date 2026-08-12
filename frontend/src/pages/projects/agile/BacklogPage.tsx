
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Story } from "@/types/agile";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { useAgileBoard } from "@/hooks/useAgileBoard";
import { EpicSidebar } from "./components/EpicSidebar";
import { SprintList } from "./components/SprintList";
import { BacklogItem } from "./components/BacklogItem"; // Ensure this path is correct
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Filter, Eye, EyeOff, Search, CheckSquare2, GripVertical, X, BrainCircuit, ChevronDown, History } from "lucide-react";
import { CreateSprintDialog } from "./components/CreateSprintDialog";
import { StoryDetailDialog } from "./components/StoryDetailDialog";
import { CreateEpicDialog } from "./components/CreateEpicDialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/layout/PageChrome";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { CreateActivityTaskDialog } from './components/CreateActivityTaskDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SprintPlanningDialog } from './components/SprintPlanningDialog';
import { appRoutes } from '@/lib/routes';
import { NqlFilterBar } from './components/NqlFilterBar';

export default function BacklogPage({ resourceId, projectKey }: { resourceId?: string; projectKey?: string } = {}) {
    const { t } = useTranslation();
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = resourceId ?? routeProjectId;
    const [searchParams, setSearchParams] = useSearchParams();
    const [showDeleted, setShowDeleted] = useState(false);
    const { stories, sprints, epics, isLoading, assignToSprint, assignToEpic, assignManyToSprint, isBulkAssigning } = useAgileBoard(projectId!, showDeleted);
    const navigate = useNavigate();
    const aiFocus = searchParams.get('aiFocus');
    const selectedEpicFromQuery = searchParams.get('epicId');
    const selectedStoryId = searchParams.get('issue');
    const nql = searchParams.get('nql') || '';

    const [selectedEpicId, setSelectedEpicId] = useState<string | null>(selectedEpicFromQuery);
    const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
    const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
    const [isCreateActivityOpen, setIsCreateActivityOpen] = useState(false);
    const [isPlanningOpen, setIsPlanningOpen] = useState(false);
    const [showSprintHistory, setShowSprintHistory] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [quickFilter, setQuickFilter] = useState<'ALL' | 'UNASSIGNED' | 'UNTESTED' | 'CRITICAL' | 'READY'>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [nqlResults, setNqlResults] = useState<Story[] | null>(null);
    const [mobileView, setMobileView] = useState<'EPICS' | 'BACKLOG' | 'SPRINTS'>('BACKLOG');
    const [backlogWidth, setBacklogWidth] = useState(() => Number(window.localStorage.getItem('nexa-backlog-lane-width')) || 40);
    const [epicWidth, setEpicWidth] = useState(() => Number(window.localStorage.getItem('nexa-epic-lane-width')) || 272);

    const handleStoryClick = (idOrKey: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('issue', idOrKey);
            return next;
        });
    };

    const visibleStories = useMemo(() => (nql ? nqlResults ?? [] : stories).filter((story) => {
        if (selectedEpicId && story.epicId !== selectedEpicId && story.parentId !== selectedEpicId) return false;
        if (aiFocus === 'critical-bugs' && story.priority !== 'CRITICAL' && (story._count?.bugs ?? 0) === 0) return false;
        const query = searchQuery.trim().toLocaleLowerCase();
        if (query && !`${story.key ?? ''} ${story.title}`.toLocaleLowerCase().includes(query)) return false;
        if (quickFilter === 'UNASSIGNED') return !story.assigneeId;
        if (quickFilter === 'UNTESTED') return (story._count?.testCases ?? 0) === 0;
        if (quickFilter === 'CRITICAL') return story.priority === 'CRITICAL';
        if (quickFilter === 'READY') return ['TODO', 'READY_FOR_TEST'].includes(story.status);
        return true;
    }), [aiFocus, nql, nqlResults, quickFilter, searchQuery, selectedEpicId, stories]);
    const changeNql = useCallback((value: string) => {
        setNqlResults(null);
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (value) next.set('nql', value); else next.delete('nql');
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    const handleNqlResults = useCallback((items: Story[] | null) => setNqlResults(items), []);

    if (isLoading) {
        return <PageLoading metricCount={0} />
    }

    // Separate backlog stories
    const backlogStories = visibleStories.filter((s: Story) => !s.sprintId);
    const activeSprints = sprints.filter(s => s.status !== 'CLOSED');
    const closedSprints = sprints.filter(s => s.status === 'CLOSED');

    const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const container = event.currentTarget.parentElement;
        if (!container) return;
        const bounds = container.getBoundingClientRect();
        const onMove = (moveEvent: PointerEvent) => {
            const percent = Math.max(32, Math.min(55, ((moveEvent.clientX - bounds.left) / bounds.width) * 100));
            setBacklogWidth(percent);
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            setBacklogWidth((value) => { window.localStorage.setItem('nexa-backlog-lane-width', String(value)); return value; });
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };
    const handleEpicResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = epicWidth;
        const onMove = (moveEvent: PointerEvent) => setEpicWidth(Math.max(220, Math.min(360, startWidth + moveEvent.clientX - startX)));
        const onUp = () => {
            window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
            setEpicWidth((value) => { window.localStorage.setItem('nexa-epic-lane-width', String(value)); return value; });
            document.body.style.cursor = ''; document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    };

    const toggleSelection = (id: string, selected: boolean) => setSelectedIds((current) => {
        const next = new Set(current);
        if (selected) next.add(id); else next.delete(id);
        return next;
    });
    const bulkMove = async (sprintId: string) => {
        await assignManyToSprint([...selectedIds], sprintId === 'BACKLOG' ? null : sprintId);
        setSelectedIds(new Set());
    };

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        const destId = destination.droppableId;

        // Handle dropping onto an Epic
        if (destId.startsWith("epic:")) {
            const epicId = destId.split(":")[1];
            assignToEpic(draggableId, epicId);
            return;
        }

        // Handle dropping into Backlog
        if (destId === "backlog") {
            assignToSprint(draggableId, null);
            return;
        }

        // Handle dropping into a Sprint (destId is sprintId)
        // Assume destId is a valid sprint Id if it's not 'backlog' or 'epic:...'
        assignToSprint(draggableId, destId);
    };

    return (
        <div className="page-shell h-full min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-background p-4 lg:flex-row">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl border bg-muted/30 p-1 lg:hidden">
                        {(['EPICS', 'BACKLOG', 'SPRINTS'] as const).map((view) => <Button key={view} variant={mobileView === view ? 'default' : 'ghost'} size="sm" onClick={() => setMobileView(view)}>{view === 'EPICS' ? t('epic_sidebar.title') : view === 'BACKLOG' ? t('backlog_page.title') : t('backlog_page.sprints')}</Button>)}
                    </div>
                    {/* Left Sidebar: Epics */}
                    <div className={cn("min-h-0 flex-1 overflow-hidden lg:block lg:flex-none", mobileView !== 'EPICS' && "hidden")}><EpicSidebar epics={epics} selectedEpicId={selectedEpicId} onSelectEpic={setSelectedEpicId} onCreateEpic={() => setIsCreateEpicOpen(true)} width={epicWidth} /></div>
                    <button type="button" className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex" onPointerDown={handleEpicResizeStart} aria-label={t('backlog_page.resize_epics', 'Epic kolonunu yeniden boyutlandır')} title={t('backlog_page.resize_epics', 'Epic kolonunu yeniden boyutlandır')}><span className="h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-primary" /></button>

                    {/* Main Content: independently scrollable backlog and sprint lanes */}
                    <div className={cn("min-w-0 flex-1 flex-col overflow-hidden enterprise-card p-0 shadow-sm lg:flex", mobileView === 'EPICS' ? "hidden" : "flex")}>
                        {/* Header Toolbar */}
                        <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3.5">
                            <div className="flex min-w-0 items-center gap-4">
                                <h1 className="text-enterprise-header text-[1.4rem]">{t("backlog_page.title")}</h1>
                                <div className="text-enterprise-muted flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]">
                                        {t("backlog_page.issues_count", { count: visibleStories.length })}
                                    </span>
                                    {selectedEpicId && (
                                        <span className="flex items-center gap-1.5 text-primary text-[11px] font-semibold uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-300">
                                            <Filter className="h-3 w-3" />
                                            {t("backlog_page.filtered_by_epic")}
                                        </span>
                                    )}
                                    {aiFocus === 'critical-bugs' && (
                                        <span className="flex items-center gap-1.5 text-destructive text-[11px] font-semibold uppercase tracking-wider">
                                            <Filter className="h-3 w-3" />
                                            {t("backlog_page.ai_focus_critical")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button variant="default" size="sm" className="h-9 gap-2" onClick={() => setIsPlanningOpen(true)}><BrainCircuit className="h-4 w-4" />{t('backlog_page.planning_mode', 'Planlama Modu')}</Button>
                                <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setIsCreateActivityOpen(true)}>
                                    <Plus className="h-3.5 w-3.5" />{t('activity_task.button')}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 gap-2 px-4 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                                    onClick={() => navigate(projectKey ? appRoutes.projectSection(projectKey, "ai") : `/projects/${projectId}?tab=ai-analyst`)}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span className="font-semibold">{t("backlog_page.ai_generate")}</span>
                                </Button>
                                <PermissionGate permission="stories:delete">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowDeleted(!showDeleted)}
                                        className={cn("h-9 px-3 gap-2 text-xs", showDeleted ? "text-red-500" : "text-muted-foreground")}
                                    >
                                        {showDeleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        {showDeleted ? t('common.hide_deleted') : t('common.show_deleted')}
                                    </Button>
                                </PermissionGate>
                                <Button 
                                    size="sm" 
                                    className="h-9 gap-2 px-4"
                                    onClick={() => setIsCreateSprintOpen(true)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span className="font-semibold">{t("backlog_page.create_sprint")}</span>
                                </Button>
                            </div>
                        </header>

                        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden bg-muted/5 p-4 lg:[grid-template-columns:minmax(300px,var(--backlog-width))_8px_minmax(400px,1fr)]" style={{ '--backlog-width': `${backlogWidth}%` } as CSSProperties}>
                            {/* Backlog lane */}
                            <section className={cn("min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:flex", mobileView === 'BACKLOG' ? "flex" : "hidden")} aria-label={t("backlog_page.title")}>
                                <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3.5">
                                    <div>
                                        <h3 className="text-enterprise-header text-sm">{t("backlog_page.title")}</h3>
                                        <p className="text-enterprise-muted text-[11px] mt-0.5">{t("backlog_page.backlog_description")}</p>
                                    </div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em] bg-background/50 px-2.5 py-1 rounded border shadow-sm">
                                        {backlogStories.length} {t("backlog_page.issues")}
                                    </div>
                                </div>

                                <div className="shrink-0 space-y-2 border-b bg-muted/10 p-3">
                                    <NqlFilterBar projectId={projectId!} query={nql} onQueryChange={changeNql} onResults={handleNqlResults} />
                                    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('common.search')} className="h-9 pl-9 pr-9" />{searchQuery && <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setSearchQuery('')} aria-label={t('common.clear_filters')}><X className="h-3.5 w-3.5" /></Button>}</div>
                                    <div className="flex flex-wrap gap-1">{(['ALL','UNASSIGNED','UNTESTED','CRITICAL','READY'] as const).map((filter) => <Button key={filter} size="sm" variant={quickFilter === filter ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setQuickFilter(filter)}>{t(`backlog_page.quick_filters.${filter}`, { defaultValue: filter })}</Button>)}</div>
                                </div>

                                {selectedIds.size > 0 && <div className="flex shrink-0 items-center gap-2 border-b border-primary/20 bg-primary/[0.06] px-3 py-2"><CheckSquare2 className="h-4 w-4 text-primary" /><span className="mr-auto text-xs font-semibold">{selectedIds.size} {t('backlog_page.issues')}</span><Select onValueChange={bulkMove} disabled={isBulkAssigning}><SelectTrigger className="h-8 w-44 bg-background text-xs"><SelectValue placeholder={t('backlog_page.move_to_sprint', 'Sprint\'e taşı')} /></SelectTrigger><SelectContent><SelectItem value="BACKLOG">{t('backlog_page.title')}</SelectItem>{activeSprints.map((sprint) => <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())} aria-label={t('common.cancel')}><X className="h-4 w-4" /></Button></div>}

                                <Droppable droppableId="backlog">
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            data-testid="backlog-scroll-region"
                                            className={cn(
                                                "min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain p-3 transition-colors [scrollbar-gutter:stable]",
                                                snapshot.isDraggingOver ? "bg-primary/8 ring-2 ring-inset ring-primary/20" : "bg-card"
                                            )}
                                        >
                                            {backlogStories.map((story: Story, index: number) => (
                                                <BacklogItem key={story.id} story={story} index={index} onStoryClick={handleStoryClick} compact selected={selectedIds.has(story.id)} onToggleSelection={toggleSelection} />
                                            ))}
                                            {provided.placeholder}

                                            {backlogStories.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                        <span className="text-2xl">📭</span>
                                                    </div>
                                                    <p className="text-sm font-medium">{t("backlog_page.empty_title")}</p>
                                                    <p className="text-xs opacity-70 mt-1">{t("backlog_page.empty_description")}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            </section>

                            <button type="button" className="group hidden cursor-col-resize items-center justify-center lg:flex" onPointerDown={handleResizeStart} aria-label={t('backlog_page.resize_columns', 'Kolonları yeniden boyutlandır')} title={t('backlog_page.resize_columns', 'Kolonları yeniden boyutlandır')}><span className="flex h-12 w-1.5 items-center justify-center rounded-full bg-border transition-colors group-hover:bg-primary"><GripVertical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary-foreground" /></span></button>

                            {/* Sprint lane */}
                            <section className={cn("min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:flex", mobileView === 'SPRINTS' ? "flex" : "hidden")} aria-label={t("backlog_page.sprints")}>
                                <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3.5">
                                    <div>
                                        <h3 className="text-enterprise-header text-sm">{t("backlog_page.sprints")}</h3>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("backlog_page.sprint_lane_description", "Planlanan ve aktif sprintlere iş sürükleyin.")}</p>
                                    </div>
                                    <div className="rounded border bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                        {activeSprints.length} {t("backlog_page.sprints")}
                                    </div>
                                </div>
                                <div data-testid="sprint-scroll-region" className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
                                    <SprintList
                                        sprints={activeSprints}
                                        stories={visibleStories}
                                        projectId={projectId!}
                                        onStoryClick={handleStoryClick}
                                        compact
                                    />
                                    {closedSprints.length > 0 && <div className="mt-4 border-t pt-3"><Button type="button" variant="ghost" className="mb-2 h-9 w-full justify-between px-2" onClick={() => setShowSprintHistory((value) => !value)} aria-expanded={showSprintHistory}><span className="flex items-center gap-2 text-xs font-semibold"><History className="h-4 w-4" />Sprint geçmişi <Badge variant="secondary">{closedSprints.length}</Badge></span><ChevronDown className={cn("h-4 w-4 transition-transform", !showSprintHistory && "-rotate-90")} /></Button>{showSprintHistory && <SprintList sprints={closedSprints} stories={visibleStories} projectId={projectId!} onStoryClick={handleStoryClick} compact readOnly />}</div>}
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Dialogs */}
                    <CreateEpicDialog
                        open={isCreateEpicOpen}
                        onOpenChange={setIsCreateEpicOpen}
                        projectId={projectId!}
                    />
                    <CreateSprintDialog open={isCreateSprintOpen} onOpenChange={setIsCreateSprintOpen} projectId={projectId} />
                    <CreateActivityTaskDialog projectId={projectId!} open={isCreateActivityOpen} onOpenChange={setIsCreateActivityOpen} />
                    <SprintPlanningDialog open={isPlanningOpen} onOpenChange={setIsPlanningOpen} sprints={sprints} applying={isBulkAssigning} onApplyScenario={async (sprintId, workItemIds) => { await assignManyToSprint(workItemIds, sprintId); setIsPlanningOpen(false); }} />
                    <StoryDetailDialog
                        storyId={selectedStoryId}
                        open={!!selectedStoryId}
                        onOpenChange={(open: boolean) => { 
                            if (!open) {
                                setSearchParams(prev => {
                                    const next = new URLSearchParams(prev);
                                    next.delete('issue');
                                    return next;
                                });
                            }
                        }}
                    />
                </DragDropContext>
            </div>
        </div>
    );
}
