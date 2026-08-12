import { api } from './api';
import type { ApiResponse } from '@/types/api';

export interface ImportResult {
    success: boolean;
    message: string;
    importedCount: number;
    errors?: string[];
}

export const importService = {
    importExcel: async (projectId: string, file: File): Promise<ImportResult> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const response = await api.post<ApiResponse<ImportResult>>('/import/excel', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return (response as unknown as ApiResponse<ImportResult>).data;
    },
};
