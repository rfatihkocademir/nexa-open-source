export type DashboardScope = 'PERSONAL' | 'PROJECT' | 'ORGANIZATION';

export type DashboardWidgetType =
    | 'KPI_WORK_ITEMS'
    | 'KPI_CRITICAL_BUGS'
    | 'KPI_PASS_RATE'
    | 'KPI_RELEASE_READINESS'
    | 'STATUS_DISTRIBUTION'
    | 'EXECUTION_TREND'
    | 'MY_WORK'
    | 'RISK_ACTIONS'
    | 'PORTFOLIO_HEALTH';

export interface DashboardWidgetCatalogItem {
    type: DashboardWidgetType;
    defaultTitle: string;
    minWidth: number;
    minHeight: number;
    category: 'WORK' | 'QUALITY' | 'RELEASE' | 'PERSONAL' | 'RISK' | 'PORTFOLIO';
}

export interface DashboardWidget {
    id: string;
    dashboardId?: string;
    type: DashboardWidgetType;
    title: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    config: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface DashboardDefinition {
    id: string;
    organizationId: string;
    projectId: string | null;
    ownerId: string;
    name: string;
    description: string | null;
    scope: DashboardScope;
    isDefault: boolean;
    layoutVersion: number;
    filters: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    owner?: { id: string; firstName: string; lastName: string };
    project?: { id: string; key: string; name: string } | null;
    widgets?: DashboardWidget[];
    _count?: { widgets: number };
}

export interface DashboardWidgetResult {
    id: string;
    type: DashboardWidgetType;
    data?: unknown;
    error?: string;
}

export interface DashboardStudioData {
    dashboard: DashboardDefinition & { widgets: DashboardWidget[] };
    widgets: DashboardWidgetResult[];
    generatedAt: string;
}

export interface CreateDashboardInput {
    name: string;
    description?: string;
    scope: DashboardScope;
    projectId?: string;
    cloneFromId?: string;
}

export interface SaveDashboardLayoutInput {
    expectedLayoutVersion?: number;
    widgets: Array<Pick<DashboardWidget, 'id' | 'type' | 'title' | 'positionX' | 'positionY' | 'width' | 'height' | 'config'>>;
}

export interface DashboardKpiData {
    value: number;
    unit?: 'COUNT' | 'PERCENT' | string;
    sampleSize?: number;
}

export interface DashboardSeriesPoint {
    name?: string;
    day?: string;
    value?: number;
    PASS?: number;
    FAIL?: number;
    BLOCK?: number;
    BLOCKED?: number;
    RETEST?: number;
    CONFLICT?: number;
    UNTESTED?: number;
    SKIPPED?: number;
    [key: string]: string | number | undefined;
}

export interface DashboardSeriesData {
    series: DashboardSeriesPoint[];
    portfolios?: number;
}

export interface DashboardMyWorkData {
    workItems: Array<{
        id: string;
        key: string;
        title: string;
        status: string;
        priority: string;
        project?: { key: string; name: string };
    }>;
    testItems: Array<{
        id: string;
        caseTitle: string | null;
        finalStatus: string;
        testRun: { key: string; title: string; project?: { key: string; name: string } | null };
    }>;
}

export interface DashboardRiskData {
    items: Array<{
        id: string;
        title: string;
        description?: string | null;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        status: string;
        dueDate?: string | null;
        actionUrl?: string | null;
        metadata?: Record<string, unknown> | null;
    }>;
}
