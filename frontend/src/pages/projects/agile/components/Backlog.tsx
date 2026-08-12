import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useAgileBoard } from "@/hooks/useAgileBoard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays } from "lucide-react";
import { type Story, type Sprint } from "@/types/agile";
import { sprintService } from "@/services/sprint.service";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateSprintDialog } from "./CreateSprintDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sparkles } from "lucide-react";
import { BacklogItem } from "./BacklogItem";
import { StoryDetailDialog } from "./StoryDetailDialog";
import { useTranslation } from "react-i18next";
import { logger } from "@/utils/logger";

export function Backlog({ projectId }: { projectId: string }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { stories, sprints, isLoading, assignToSprint } = useAgileBoard(projectId);
    const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
    const queryClient = useQueryClient();

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

    if (isLoading) {
        return <LoadingSpinner size="lg" />;
    }

    // Group stories by sprint
    const backlogStories = stories?.filter((s: Story) => !s.sprintId) || [];

    // Sort sprints: Active first, then Planned, then Completed? 
    // Usually Backlog view shows Active and Planned.
    const activeSprints = sprints?.filter((s: Sprint) => s.status === 'ACTIVE' || s.status === 'PLANNED') || [];

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        // Determine destination sprintId (or null for backlog)
        const destSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId;

        // Optimistic update would require updating the story's sprintId via API
        // moveStory currently moves status. I need a function to move Sprint.
        // I'll need to update useAgileBoard to support 'assignToSprint'.
        logger.info("Moving to sprint:", destSprintId);
        assignToSprint(draggableId, destSprintId);
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{t("backlog_page.title")}</h2>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => navigate(`/projects/${projectId}?tab=ai-analyst`)}
                        className="h-10 rounded-lg border-primary/30 bg-primary/5 px-4 text-primary hover:bg-primary/10"
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t("backlog_page.ai_generate")}
                    </Button>
                    <Button 
                        onClick={() => setIsCreateSprintOpen(true)}
                        className="h-10 rounded-lg px-4"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("backlog_page.create_sprint")}
                    </Button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="space-y-4">
                    {activeSprints.map((sprint: Sprint) => (
                        <div key={sprint.id} className="border rounded-lg bg-card">
                            <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-4">
                                    <span className="font-semibold">{sprint.name}</span>
                                    <Badge variant={sprint.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                        {sprint.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" />
                                        {new Date(sprint.startDate).toLocaleDateString(i18n.language)} - {new Date(sprint.endDate).toLocaleDateString(i18n.language)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sprint.status === 'PLANNED' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => startSprintMutation.mutate(sprint.id)}
                                            disabled={startSprintMutation.isPending}
                                        >
                                            {t("sprint_list.start")}
                                        </Button>
                                    )}
                                    {sprint.status === 'ACTIVE' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => completeSprintMutation.mutate(sprint.id)}
                                            disabled={completeSprintMutation.isPending}
                                        >
                                            {t("sprint_list.complete")}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <Droppable droppableId={sprint.id}>
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="p-2 min-h-[50px] space-y-2"
                                    >
                                        {stories
                                            ?.filter((s: Story) => s.sprintId === sprint.id)
                                            .map((story: Story, index: number) => (
                                                <BacklogItem key={story.id} story={story} index={index} onStoryClick={setSelectedStoryId} />
                                            ))}
                                        {provided.placeholder}
                                        {stories?.filter((s: Story) => s.sprintId === sprint.id).length === 0 && (
                                            <div className="text-center text-xs text-muted-foreground py-4 border-2 border-dashed rounded-md">
                                                {t("sprint_list.empty_description")}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}

                    <div className="border rounded-lg bg-card mt-8">
                        <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                            <span className="font-semibold">{t("backlog_page.title")}</span>
                            <span className="text-xs text-muted-foreground">{t("backlog_page.issues_count", { count: backlogStories.length })}</span>
                        </div>
                        <Droppable droppableId="backlog">
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="p-2 min-h-[100px] space-y-2"
                                >
                                    {backlogStories.map((story: Story, index: number) => (
                                        <BacklogItem key={story.id} story={story} index={index} onStoryClick={setSelectedStoryId} />
                                    ))}
                                    {provided.placeholder}
                                    {backlogStories.length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-8">
                                            {t("backlog_page.empty_title")}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </div>
                </div>
            </DragDropContext>
            <CreateSprintDialog 
                open={isCreateSprintOpen} 
                onOpenChange={setIsCreateSprintOpen} 
            />
            <StoryDetailDialog
                storyId={selectedStoryId}
                open={!!selectedStoryId}
                onOpenChange={(open) => { if (!open) setSelectedStoryId(null); }}
            />
        </div>
    );
}
