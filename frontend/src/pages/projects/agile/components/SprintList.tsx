
import type { Sprint, Story } from "@/types/agile";
import { Droppable } from "@hello-pangea/dnd";
import { BacklogItem } from "./BacklogItem";
import { Button } from "@/components/ui/button";
import { CalendarDays, Play, CheckCircle, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sprintService } from "@/services/sprint.service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface SprintListProps {
    sprints: Sprint[];
    stories: Story[];
    projectId: string;
    onStoryClick?: (storyId: string) => void;
    compact?: boolean;
    readOnly?: boolean;
}

export function SprintList({ sprints, stories, projectId, onStoryClick, compact = false, readOnly = false }: SprintListProps) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(sprints.filter((sprint) => sprint.status !== 'ACTIVE').map((sprint) => sprint.id)));
    const orderedSprints = useMemo(() => [...sprints].sort((left, right) => left.status === 'ACTIVE' ? -1 : right.status === 'ACTIVE' ? 1 : new Date(left.startDate).getTime() - new Date(right.startDate).getTime()), [sprints]);

    const startSprintMutation = useMutation({
        mutationFn: (sprintId: string) => sprintService.start(sprintId),
        onSuccess: () => {
            toast.success(t("sprint_list.toast.started"));
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
        }
    });

    const completeSprintMutation = useMutation({
        mutationFn: (sprintId: string) => sprintService.complete(sprintId),
        onSuccess: () => {
            toast.success(t("sprint_list.toast.completed"));
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
        }
    });

    return (
        <div className="space-y-3">
            {orderedSprints.map((sprint) => {
                const sprintStories = stories.filter(s => s.sprintId === sprint.id);
                // Calculate total points
                const totalPoints = sprintStories.reduce((sum, s) => sum + (s.storyPoints ?? s.points ?? 0), 0);
                const capacityRate = sprint.capacityPoints ? Math.round((totalPoints / sprint.capacityPoints) * 100) : null;
                const collapsed = collapsedIds.has(sprint.id) && sprint.status !== 'ACTIVE';

                return (
                    <div key={sprint.id} className="relative rounded-xl border border-border/70 bg-card shadow-sm transition-all hover:shadow-md">
                        {/* Sprint Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-border/70 bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3">
                                        <span className="truncate text-sm font-semibold text-foreground">{sprint.name}</span>
                                        <StatusBadge status={sprint.status} className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider" />
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-enterprise-muted">
                                        <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                                        <span className="font-medium text-[11px] tabular-nums">
                                            {new Date(sprint.startDate).toLocaleDateString(i18n.language)} - {new Date(sprint.endDate).toLocaleDateString(i18n.language)}
                                        </span>
                                        <span className="text-muted-foreground/40">•</span>
                                        <span className="font-bold text-foreground/80 text-[10px] uppercase tracking-wider">{t("sprint_list.issues_count", { count: sprintStories.length })}</span>
                                        <span className="text-muted-foreground/40">•</span>
                                        <span className="font-bold text-foreground/80 text-[10px] uppercase tracking-wider">{t("sprint_list.points_count", { count: totalPoints })}</span>
                                    </div>
                                    {sprint.goal && (
                                        <div className="text-[11px] text-muted-foreground mt-2 font-medium italic opacity-80 border-l-2 border-primary/20 pl-2">
                                            {t("sprint_list.goal", { goal: sprint.goal })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsedIds((current) => { const next = new Set(current); if (next.has(sprint.id)) next.delete(sprint.id); else next.add(sprint.id); return next; })} aria-label={collapsed ? t('common.expand_sidebar') : t('common.close')} title={collapsed ? t('common.expand_sidebar') : t('common.close')}>
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
                                </Button>
                                {sprint.status === 'PLANNED' && (
                                    <PermissionGate permission="sprint.manage" projectId={projectId}>
                                        <Button
                                            size="sm"
                                            className="h-8 gap-2"
                                            onClick={() => startSprintMutation.mutate(sprint.id)}
                                            disabled={startSprintMutation.isPending}
                                        >
                                            <Play className="h-3 w-3" />
                                            {t("sprint_list.start")}
                                        </Button>
                                    </PermissionGate>
                                )}
                                {sprint.status === 'ACTIVE' && (
                                    <PermissionGate permission="sprint.manage" projectId={projectId}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                            onClick={() => completeSprintMutation.mutate(sprint.id)}
                                            disabled={completeSprintMutation.isPending}
                                        >
                                            <CheckCircle className="h-3 w-3" />
                                            {t("sprint_list.complete")}
                                        </Button>
                                    </PermissionGate>
                                )}
                            </div>
                        </div>

                        {sprint.capacityPoints && <div className="border-b bg-muted/5 px-4 py-2"><div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground"><span>{t('sprint_list.capacity', 'Kapasite')}</span><span className={cn(capacityRate && capacityRate > 100 && 'font-semibold text-destructive')}>{totalPoints} / {sprint.capacityPoints} SP · %{capacityRate}</span></div><Progress value={Math.min(100, capacityRate ?? 0)} className={cn("h-1.5", capacityRate && capacityRate > 100 && "[&>div]:bg-destructive")} /></div>}

                        {/* Drop Zone */}
                        <Droppable droppableId={sprint.id} isDropDisabled={readOnly || sprint.status === 'CLOSED'}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "space-y-2 transition-colors",
                                        collapsed ? "min-h-12 p-2" : "min-h-[72px] p-2.5",
                                        snapshot.isDraggingOver ? "bg-primary/[0.08] ring-2 ring-inset ring-primary/20" : "bg-card"
                                    )}
                                >
                                    {!collapsed && sprintStories.map((story, index) => (
                                        <BacklogItem key={story.id} story={story} index={index} onStoryClick={onStoryClick} compact={compact} readOnly={readOnly || sprint.status === 'CLOSED'} />
                                    ))}
                                    {provided.placeholder}

                                    {collapsed && <div className="flex h-8 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">{t('sprint_list.drop_to_collapsed', 'Bu sprint\'e bırakın veya içeriği genişletin')}</div>}
                                    {!collapsed && sprintStories.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed border-border/40 m-3 rounded-xl bg-muted/5">
                                            <div className="p-2 bg-muted/10 rounded-full mb-2">
                                                <CalendarDays className="h-5 w-5 opacity-40" />
                                            </div>
                                            <p className="text-sm font-medium">{t("sprint_list.empty_title")}</p>
                                            <p className="text-xs opacity-60 mt-0.5">{t("sprint_list.empty_description")}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </div>
                );
            })}
        </div>
    );
}
