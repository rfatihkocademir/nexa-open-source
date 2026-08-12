import { api } from "@/services/api";

export type SavedViewScope = "PERSONAL" | "PROJECT";

export type SavedView<TConfig extends object = Record<string, unknown>> = {
    id: string;
    name: string;
    viewType: string;
    scope: SavedViewScope;
    config: TConfig;
    isDefault: boolean;
    userId: string;
    createdAt: string;
    updatedAt: string;
};

export const savedViewService = {
    list: async <TConfig extends object>(projectId: string, viewType: string): Promise<Array<SavedView<TConfig>>> => {
        const response = await api.get<Array<SavedView<TConfig>>>("/saved-views", { params: { projectId, viewType } });
        return response as unknown as Array<SavedView<TConfig>>;
    },
    save: async <TConfig extends object>(data: {
        projectId: string;
        name: string;
        viewType: string;
        scope: SavedViewScope;
        config: TConfig;
        isDefault?: boolean;
    }): Promise<SavedView<TConfig>> => {
        const response = await api.post<SavedView<TConfig>>("/saved-views", data);
        return response as unknown as SavedView<TConfig>;
    },
    delete: async (projectId: string, id: string) => {
        await api.delete(`/saved-views/${id}`, { params: { projectId } });
    },
};
