import { api } from "@/services/api";

export type WorkTypeDefinition = {
    id: string; key: string; name: string; description?: string; baseType: string;
    icon?: string; color?: string; orderIndex: number; isActive: boolean; isSystem: boolean;
};
export type CustomFieldType = "TEXT" | "TEXTAREA" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" | "SELECT" | "MULTI_SELECT" | "USER" | "MULTI_USER" | "URL";
export type CustomFieldDefinition = {
    id: string; key: string; name: string; description?: string; fieldType: CustomFieldType;
    itemTypeKeys: string[]; required: boolean; options?: string[]; isActive: boolean; orderIndex: number;
};
export type WorkConfiguration = { workTypes: WorkTypeDefinition[]; customFields: CustomFieldDefinition[] };

export const workConfigurationService = {
    list: (projectId: string) => api.get<WorkConfiguration>("/work-configuration", { params: { projectId } }) as unknown as Promise<WorkConfiguration>,
    createWorkType: (projectId: string, data: Record<string, unknown>) =>
        api.post("/work-configuration/work-types", { projectId, ...data }),
    updateWorkType: (projectId: string, id: string, data: Record<string, unknown>) =>
        api.patch(`/work-configuration/work-types/${id}`, { projectId, ...data }),
    createCustomField: (projectId: string, data: Record<string, unknown>) =>
        api.post("/work-configuration/custom-fields", { projectId, ...data }),
    updateCustomField: (projectId: string, id: string, data: Record<string, unknown>) =>
        api.patch(`/work-configuration/custom-fields/${id}`, { projectId, ...data }),
    deleteCustomField: (projectId: string, id: string) =>
        api.delete(`/work-configuration/custom-fields/${id}`, { params: { projectId } }),
};
