
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storyService } from "@/services/story.service";
import { sprintService } from "@/services/sprint.service";
import { epicService } from "@/services/epic.service";
import { StoryStatus, type Story, type Sprint, type Epic } from "@/types/agile";
import { toast } from "sonner";
import { logger } from "@/utils/logger";
import { queryKeys } from "@/lib/queryKeys";

const getMutationErrorMessage = (error: unknown): string => {
    if (typeof error !== "object" || error === null || !("response" in error)) {
        return "Failed to update story";
    }

    const response = error.response;
    if (typeof response !== "object" || response === null || !("data" in response)) {
        return "Failed to update story";
    }

    const data = response.data;
    if (typeof data !== "object" || data === null) {
        return "Failed to update story";
    }

    const message = "error" in data ? data.error : "message" in data ? data.message : undefined;
    return typeof message === "string" ? message : "Failed to update story";
};

export function useAgileBoard(projectId: string, includeDeleted: boolean = false) {
    const queryClient = useQueryClient();
    
    const { data: workItems, isLoading: isLoadingWorkItems } = useQuery({
        queryKey: queryKeys.agile.stories(projectId, includeDeleted),
        queryFn: () => storyService.getAllWorkItems(projectId, includeDeleted),
        enabled: !!projectId,
    });

    const { data: sprints, isLoading: isLoadingSprints } = useQuery({
        queryKey: queryKeys.agile.sprints(projectId),
        queryFn: () => sprintService.getAll(projectId),
        enabled: !!projectId,
    });

    const { data: epics, isLoading: isLoadingEpics } = useQuery({
        queryKey: queryKeys.agile.epics(projectId),
        queryFn: () => epicService.getAll(projectId),
        enabled: !!projectId,
    });

    const updateStoryMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Story> }) =>
            storyService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["bugs", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
            queryClient.invalidateQueries({ queryKey: ["agile-board"] });
        },
        onError: (error: unknown) => {
            const message = getMutationErrorMessage(error);
            toast.error(message);
            logger.error(error);
        }
    });

    const moveStory = (storyId: string, newStatus: StoryStatus) => {
        updateStoryMutation.mutate({
            id: storyId,
            data: { status: newStatus }
        });
    };

    const assignSprintMutation = useMutation({
        mutationFn: ({ storyId, sprintId }: { storyId: string; sprintId: string | null; previousSprintId: string | null }) =>
            storyService.update(storyId, { sprintId }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["bugs", projectId] });
            queryClient.invalidateQueries({ queryKey: ["agile-board"] });
            toast.success("Sprint ataması güncellendi.", {
                action: {
                    label: "Geri al",
                    onClick: () => updateStoryMutation.mutate({ id: variables.storyId, data: { sprintId: variables.previousSprintId } }),
                },
            });
        },
        onError: (error: unknown) => toast.error(getMutationErrorMessage(error)),
    });

    const assignToSprint = (storyId: string, sprintId: string | null) => {
        const previousSprintId = (workItems ?? []).find((story) => story.id === storyId)?.sprintId ?? null;
        assignSprintMutation.mutate({ storyId, sprintId, previousSprintId });
    };

    const assignToEpic = (storyId: string, epicId: string | null) => {
        updateStoryMutation.mutate({
            id: storyId,
            data: { epicId: epicId || undefined }
        });
    };

    const bulkAssignSprintMutation = useMutation({
        mutationFn: ({ storyIds, sprintId }: { storyIds: string[]; sprintId: string | null }) =>
            Promise.all(storyIds.map((id) => storyService.update(id, { sprintId }))),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["bugs", projectId] });
            queryClient.invalidateQueries({ queryKey: ["agile-board"] });
            toast.success(`${variables.storyIds.length} iş kaydı sprint kapsamına taşındı.`);
        },
        onError: (error: unknown) => toast.error(getMutationErrorMessage(error)),
    });

    return {
        // Epics have their own lane and endpoint; every other work item type,
        // including activity records, is eligible for backlog/sprint planning.
        stories: (workItems ?? []).filter((item) => item.itemType !== 'EPIC'),
        sprints: sprints ?? ([] as Sprint[]),
        epics: epics ?? ([] as Epic[]),
        isLoading: isLoadingWorkItems || isLoadingSprints || isLoadingEpics,
        moveStory,
        assignToSprint,
        assignToEpic,
        assignManyToSprint: (storyIds: string[], sprintId: string | null) => bulkAssignSprintMutation.mutateAsync({ storyIds, sprintId }),
        isBulkAssigning: bulkAssignSprintMutation.isPending,
    };
}
