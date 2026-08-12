import { api } from "@/services/api";

export type RequirementOption = {
    id: string;
    title: string;
    status: string;
    type: string;
    projectId: string;
};

export const requirementService = {
    getByProject: async (projectId: string): Promise<RequirementOption[]> => {
        const response = await api.get<RequirementOption[]>("/requirements", { params: { projectId } });
        return response as unknown as RequirementOption[];
    },
};
