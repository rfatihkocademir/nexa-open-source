import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
    boardColumnService,
    WORK_ITEM_STATUS_OPTIONS,
    type WorkItemStatus,
} from '@/services/boardColumn.service';

export function useProjectWorkflowStatuses(projectId?: string, currentStatus?: string) {
    const { data: columns = [] } = useQuery({
        queryKey: ['board-columns', projectId],
        queryFn: () => boardColumnService.getByProjectId(projectId!),
        enabled: Boolean(projectId),
        staleTime: 60_000,
    });

    return useMemo(() => {
        const configuredStatuses = new Set<WorkItemStatus>(
            columns.flatMap((column) => column.mappedStatus ? [column.mappedStatus] : []),
        );

        if (currentStatus && WORK_ITEM_STATUS_OPTIONS.some((option) => option.value === currentStatus)) {
            configuredStatuses.add(currentStatus as WorkItemStatus);
        }

        if (configuredStatuses.size === 0) return WORK_ITEM_STATUS_OPTIONS;
        return WORK_ITEM_STATUS_OPTIONS.filter((option) => configuredStatuses.has(option.value));
    }, [columns, currentStatus]);
}
