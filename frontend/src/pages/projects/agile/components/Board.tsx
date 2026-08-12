import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useMemo, useState } from "react";
import { BoardColumn } from "./BoardColumn";
import { useAgileBoard } from "@/hooks/useAgileBoard";
import { StoryStatus, type Story, type Sprint } from "@/types/agile";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StoryDetailDialog } from "./StoryDetailDialog";
import { useTranslation } from "react-i18next";

type BoardColumnData = {
    id: StoryStatus;
    title: string;
    items: Story[];
};

const COLUMNS_ORDER: Array<{ id: StoryStatus }> = [
    { id: StoryStatus.TODO },
    { id: StoryStatus.DEVELOPMENT },
    { id: StoryStatus.WAITING_FOR_INFO },
    { id: StoryStatus.READY_FOR_TEST },
    { id: StoryStatus.IN_TEST },
    { id: StoryStatus.DONE },
];

export function Board({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const { stories, sprints, isLoading, moveStory } = useAgileBoard(projectId);
    const [selectedSprintId, setSelectedSprintId] = useState<string>();
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

    const effectiveSelectedSprintId = selectedSprintId
        ?? sprints.find((sprint: Sprint) => sprint.status === "ACTIVE")?.id
        ?? "all";

    const columns = useMemo<Record<StoryStatus, BoardColumnData>>(() => {
        const newColumns = {} as Record<StoryStatus, BoardColumnData>;
        const filteredStories = effectiveSelectedSprintId === "all"
            ? stories
            : stories.filter((story: Story) => story.sprintId === effectiveSelectedSprintId);

        COLUMNS_ORDER.forEach((column) => {
            newColumns[column.id] = {
                id: column.id,
                title: t(`board.columns.${column.id}`),
                items: filteredStories.filter((story: Story) => story.status === column.id),
            };
        });

        return newColumns;
    }, [effectiveSelectedSprintId, stories, t]);

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;

        if (source.droppableId === destination.droppableId) {
            return;
        }

        moveStory(draggableId, destination.droppableId as StoryStatus);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t("board.sprint_label")}</span>
                    <select
                        className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={effectiveSelectedSprintId}
                        onChange={(e) => setSelectedSprintId(e.target.value)}
                    >
                        <option value="all">{t("board.all_issues")}</option>
                        {sprints.map((sprint: Sprint) => (
                            <option key={sprint.id} value={sprint.id}>
                                {sprint.name} ({sprint.status})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex h-full gap-4 min-w-fit pb-4">
                    {COLUMNS_ORDER.map((colConfig) => {
                        const column = columns[colConfig.id];
                        if (!column) return null;
                        return <BoardColumn key={column.id} column={column} onItemClick={setSelectedStoryId} />;
                    })}
                </div>
            </DragDropContext>
            <StoryDetailDialog
                storyId={selectedStoryId}
                open={!!selectedStoryId}
                onOpenChange={(open) => { if (!open) setSelectedStoryId(null); }}
            />
        </div>
    );
}
