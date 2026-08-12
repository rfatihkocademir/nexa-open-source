import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type {
    CreateDashboardInput,
    DashboardDefinition,
    DashboardStudioData,
    DashboardWidgetCatalogItem,
    SaveDashboardLayoutInput,
} from '@/types/dashboard-studio';

const unwrap = <T>(response: unknown): T => (response as ApiResponse<T>).data;

export const dashboardStudioService = {
    getCatalog: async () => unwrap<DashboardWidgetCatalogItem[]>(await api.get('/dashboard-studio/catalog')),
    ensureDefault: async () => unwrap<DashboardDefinition>(await api.post('/dashboard-studio/ensure-default')),
    list: async () => unwrap<DashboardDefinition[]>(await api.get('/dashboard-studio')),
    create: async (input: CreateDashboardInput) => unwrap<DashboardDefinition>(await api.post('/dashboard-studio', input)),
    getData: async (id: string) => unwrap<DashboardStudioData>(await api.get(`/dashboard-studio/${encodeURIComponent(id)}/data`)),
    saveLayout: async (id: string, input: SaveDashboardLayoutInput) =>
        unwrap<DashboardDefinition>(await api.put(`/dashboard-studio/${encodeURIComponent(id)}/layout`, input)),
    setDefault: async (id: string) => unwrap<DashboardDefinition>(await api.put(`/dashboard-studio/${encodeURIComponent(id)}/default`)),
    archive: async (id: string) => {
        await api.delete(`/dashboard-studio/${encodeURIComponent(id)}`);
    },
};
