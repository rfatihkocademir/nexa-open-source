import {
    Activity,
    Bug,
    CircleGauge,
    ClipboardCheck,
    FolderKanban,
    ListTodo,
    ShieldAlert,
    Target,
    Workflow,
    type LucideIcon,
} from 'lucide-react';
import type { DashboardWidgetType } from '@/types/dashboard-studio';

export const widgetPresentation: Record<DashboardWidgetType, { icon: LucideIcon; tone: string; chartColor: string }> = {
    KPI_WORK_ITEMS: { icon: ListTodo, tone: 'text-blue-600 bg-blue-500/10', chartColor: 'var(--chart-1)' },
    KPI_CRITICAL_BUGS: { icon: Bug, tone: 'text-red-600 bg-red-500/10', chartColor: 'var(--chart-3)' },
    KPI_PASS_RATE: { icon: ClipboardCheck, tone: 'text-emerald-600 bg-emerald-500/10', chartColor: 'var(--chart-2)' },
    KPI_RELEASE_READINESS: { icon: CircleGauge, tone: 'text-violet-600 bg-violet-500/10', chartColor: 'var(--chart-5)' },
    STATUS_DISTRIBUTION: { icon: Workflow, tone: 'text-blue-600 bg-blue-500/10', chartColor: 'var(--chart-1)' },
    EXECUTION_TREND: { icon: Activity, tone: 'text-emerald-600 bg-emerald-500/10', chartColor: 'var(--chart-2)' },
    MY_WORK: { icon: FolderKanban, tone: 'text-cyan-600 bg-cyan-500/10', chartColor: 'var(--chart-5)' },
    RISK_ACTIONS: { icon: ShieldAlert, tone: 'text-amber-700 bg-amber-500/10', chartColor: 'var(--chart-4)' },
    PORTFOLIO_HEALTH: { icon: Target, tone: 'text-violet-600 bg-violet-500/10', chartColor: 'var(--chart-5)' },
};

export const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)'];

export function widgetSpanClass(width: number) {
    const span = Math.min(12, Math.max(2, Math.round(width)));
    const classes: Record<number, string> = {
        2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4', 5: 'xl:col-span-5',
        6: 'xl:col-span-6', 7: 'xl:col-span-7', 8: 'xl:col-span-8', 9: 'xl:col-span-9',
        10: 'xl:col-span-10', 11: 'xl:col-span-11', 12: 'xl:col-span-12',
    };
    return `${span >= 6 ? 'md:col-span-2' : 'md:col-span-1'} ${classes[span] ?? 'xl:col-span-4'}`;
}
