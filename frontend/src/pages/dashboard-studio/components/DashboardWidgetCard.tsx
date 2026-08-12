import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ChevronRight,
    GripVertical,
    Maximize2,
    Minimize2,
    SlidersHorizontal,
    Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appRoutes } from '@/lib/routes';
import {
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { localizeActionText } from '@/pages/action-center/action-center-i18n';
import type {
    DashboardKpiData,
    DashboardMyWorkData,
    DashboardRiskData,
    DashboardSeriesData,
    DashboardWidget,
    DashboardWidgetResult,
} from '@/types/dashboard-studio';
import { chartColors, widgetPresentation } from '../dashboard-studio-config';

interface DashboardWidgetCardProps {
    widget: DashboardWidget;
    result?: DashboardWidgetResult;
    editMode: boolean;
    isFirst: boolean;
    isLast: boolean;
    minWidth: number;
    minHeight: number;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
    onMove: (direction: -1 | 1) => void;
    onResize: (dimension: 'width' | 'height', delta: -1 | 1) => void;
    onRemove: () => void;
    onTitleChange: (title: string) => void;
    onNavigate: (path: string) => void;
}

export function DashboardWidgetCard({
    widget,
    result,
    editMode,
    isFirst,
    isLast,
    minWidth,
    minHeight,
    dragHandleProps,
    onMove,
    onResize,
    onRemove,
    onTitleChange,
    onNavigate,
}: DashboardWidgetCardProps) {
    const { t } = useTranslation();
    const presentation = widgetPresentation[widget.type];
    const Icon = presentation.icon;
    const usesDefaultTitle = widget.config?.defaultTitle === true;
    const visibleTitle = usesDefaultTitle ? t(`dashboard_studio.widgets.${widget.type}.title`) : widget.title;

    return (
        <Card
            className={cn(
                'group relative flex h-full min-h-44 flex-col overflow-hidden transition-[box-shadow,border-color] duration-200',
                editMode && 'border-primary/30 ring-1 ring-primary/10 hover:shadow-md',
            )}
            style={{ minHeight: Math.max(176, widget.height * 72) }}
        >
            <CardHeader className="flex-row items-center gap-3 border-b border-border/60 px-4 py-3">
                {editMode && (
                    <button
                        type="button"
                        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                        aria-label={t('dashboard_studio.actions.drag_widget')}
                        {...dragHandleProps}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                )}
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', presentation.tone)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                {editMode ? (
                    <Input
                        className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 font-semibold hover:border-border focus:border-input"
                        value={visibleTitle}
                        maxLength={100}
                        aria-label={t('dashboard_studio.actions.widget_title')}
                        onChange={(event) => onTitleChange(event.target.value)}
                    />
                ) : (
                    <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{visibleTitle}</h2>
                )}
                {editMode && (
                    <WidgetControls
                        isFirst={isFirst}
                        isLast={isLast}
                        width={widget.width}
                        height={widget.height}
                        minWidth={minWidth}
                        minHeight={minHeight}
                        onMove={onMove}
                        onResize={onResize}
                        onRemove={onRemove}
                    />
                )}
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-4">
                {result?.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('dashboard_studio.widget_error.title')}</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                ) : (
                    <WidgetContent widget={widget} data={result?.data} onNavigate={onNavigate} />
                )}
            </CardContent>
        </Card>
    );
}

function WidgetControls({
    isFirst,
    isLast,
    width,
    height,
    minWidth,
    minHeight,
    onMove,
    onResize,
    onRemove,
}: Pick<DashboardWidgetCardProps, 'isFirst' | 'isLast' | 'minWidth' | 'minHeight' | 'onMove' | 'onResize' | 'onRemove'> & { width: number; height: number }) {
    const { t } = useTranslation();
    const controls = [
        { label: t('dashboard_studio.actions.move_up'), icon: ArrowUp, disabled: isFirst, action: () => onMove(-1) },
        { label: t('dashboard_studio.actions.move_down'), icon: ArrowDown, disabled: isLast, action: () => onMove(1) },
        { label: t('dashboard_studio.actions.narrow'), icon: Minimize2, disabled: width <= minWidth, action: () => onResize('width', -1) },
        { label: t('dashboard_studio.actions.widen'), icon: Maximize2, disabled: width >= 12, action: () => onResize('width', 1) },
        { label: t('dashboard_studio.actions.shorten'), icon: Minimize2, disabled: height <= minHeight, action: () => onResize('height', -1) },
        { label: t('dashboard_studio.actions.heighten'), icon: Maximize2, disabled: height >= 12, action: () => onResize('height', 1) },
    ];
    return (
        <DropdownMenu>
            <TooltipProvider delayDuration={250}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('dashboard_studio.actions.widget_controls')}>
                                <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t('dashboard_studio.actions.widget_controls')}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('dashboard_studio.actions.widget_controls')}</DropdownMenuLabel>
                {controls.map(({ label, icon: Icon, disabled, action }) => (
                    <DropdownMenuItem key={label} disabled={disabled} onSelect={action}>
                        <Icon className="mr-2 h-4 w-4" />{label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onRemove}>
                    <Trash2 className="mr-2 h-4 w-4" />{t('dashboard_studio.actions.remove_widget')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function WidgetContent({ widget, data, onNavigate }: { widget: DashboardWidget; data: unknown; onNavigate: (path: string) => void }) {
    if (!data) return <WidgetEmpty />;
    if (widget.type.startsWith('KPI_')) return <KpiWidget data={data as DashboardKpiData} type={widget.type} />;
    if (widget.type === 'STATUS_DISTRIBUTION') return <DistributionWidget data={data as DashboardSeriesData} />;
    if (widget.type === 'EXECUTION_TREND') return <ExecutionTrendWidget data={data as DashboardSeriesData} />;
    if (widget.type === 'MY_WORK') return <MyWorkWidget data={data as DashboardMyWorkData} maxItems={Math.max(4, widget.height * 2)} onNavigate={onNavigate} />;
    if (widget.type === 'RISK_ACTIONS') return <RiskWidget data={data as DashboardRiskData} maxItems={Math.max(4, widget.height * 2)} onNavigate={onNavigate} />;
    if (widget.type === 'PORTFOLIO_HEALTH') return <PortfolioWidget data={data as DashboardSeriesData} />;
    return <WidgetEmpty />;
}

function KpiWidget({ data, type }: { data: DashboardKpiData; type: DashboardWidget['type'] }) {
    const { t, i18n } = useTranslation();
    const value = Number.isFinite(Number(data.value)) ? Number(data.value) : 0;
    const percent = data.unit === 'PERCENT';
    const Icon = widgetPresentation[type].icon;
    return (
        <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-4xl font-semibold tracking-tight tabular-nums">
                        {new Intl.NumberFormat(i18n.language).format(value)}{percent ? '%' : ''}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {data.sampleSize !== undefined
                            ? t('dashboard_studio.widgets.sample_size', { count: data.sampleSize })
                            : t(`dashboard_studio.widgets.${type}.metric_hint`)}
                    </p>
                </div>
                <Icon className="h-10 w-10 text-muted-foreground/20" aria-hidden="true" />
            </div>
            {percent && <Progress value={Math.min(100, Math.max(0, value))} className="h-2" aria-label={t('dashboard_studio.widgets.percent_value', { value })} />}
        </div>
    );
}

function DistributionWidget({ data }: { data: DashboardSeriesData }) {
    const { t, i18n } = useTranslation();
    const series = Array.isArray(data.series) ? data.series.filter((point) => Number(point.value) > 0) : [];
    if (!series.length) return <WidgetEmpty />;
    return (
        <div className="grid h-full min-h-48 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.7fr)]">
            <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <PieChart accessibilityLayer>
                    <Pie data={series} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} strokeWidth={0}>
                        {series.map((point, index) => <Cell key={`${point.name}-${index}`} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <ChartTooltip formatter={(value) => [Number(value), t('dashboard_studio.widgets.items')]} />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center gap-2">
                {series.map((point, index) => (
                    <div key={`${point.name}-${index}`} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="min-w-0 flex-1 truncate">{localizedStatus(point.name, t, i18n.exists.bind(i18n))}</span>
                        <span className="font-semibold tabular-nums">{point.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ExecutionTrendWidget({ data }: { data: DashboardSeriesData }) {
    const { t, i18n } = useTranslation();
    const series = Array.isArray(data.series) ? data.series : [];
    if (!series.length) return <WidgetEmpty />;
    const formatDay = (day: unknown) => {
        if (typeof day !== 'string') return '';
        const parsed = new Date(`${day}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? day : new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' }).format(parsed);
    };
    return (
        <div className="h-full min-h-52">
            <ResponsiveContainer width="100%" height="100%" minHeight={208}>
                <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ChartTooltip labelFormatter={formatDay} />
                    <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="PASS" name={t('dashboard_studio.status.PASS')} stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="FAIL" name={t('dashboard_studio.status.FAIL')} stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="BLOCK" name={t('dashboard_studio.status.BLOCK')} stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="RETEST" name={t('dashboard_studio.status.RETEST')} stroke="var(--chart-5)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="CONFLICT" name={t('dashboard_studio.status.CONFLICT')} stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="UNTESTED" name={t('dashboard_studio.status.UNTESTED')} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function MyWorkWidget({ data, maxItems, onNavigate }: { data: DashboardMyWorkData; maxItems: number; onNavigate: (path: string) => void }) {
    const { t, i18n } = useTranslation();
    const workItems = Array.isArray(data.workItems) ? data.workItems.map((item) => ({ id: item.id, key: item.key, title: item.title, status: item.status, path: appRoutes.resource(item.key) })) : [];
    const testItems = Array.isArray(data.testItems) ? data.testItems.map((item) => ({ id: item.id, key: item.testRun.key, title: item.caseTitle || item.testRun.title, status: item.finalStatus, path: appRoutes.resource(item.testRun.key) })) : [];
    const items = interleave(workItems, testItems).slice(0, maxItems);
    if (!items.length) return <WidgetEmpty />;
    return (
        <div className="divide-y divide-border/60">
            {items.map((item) => (
                <button key={`${item.key}-${item.id}`} type="button" className="group flex w-full items-center gap-2 py-2.5 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring sm:gap-3" onClick={() => onNavigate(item.path)}>
                    <span className="min-w-20 font-mono text-xs font-semibold text-primary">{item.key}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    <Badge variant="outline" className="hidden max-w-36 truncate text-[10px] font-semibold sm:inline-flex">
                        {localizedStatus(item.status, t, i18n.exists.bind(i18n))}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-label={t('dashboard_studio.actions.open')} />
                </button>
            ))}
        </div>
    );
}

function RiskWidget({ data, maxItems, onNavigate }: { data: DashboardRiskData; maxItems: number; onNavigate: (path: string) => void }) {
    const { t, i18n } = useTranslation();
    const items = Array.isArray(data.items) ? data.items.slice(0, maxItems) : [];
    if (!items.length) return <WidgetEmpty />;
    return (
        <div className="space-y-2">
            {items.map((item) => {
                const title = localizeActionText(item.title, item.metadata, t, i18n);
                const target = safeInternalPath(item.actionUrl) || '/inbox';
                return (
                <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-border/70 p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
                    onClick={() => onNavigate(target)}
                >
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', severityTone[item.severity])} />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t(`dashboard_studio.status.${item.status}`)}</span>
                    </span>
                    <Badge variant={item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'destructive' : 'secondary'}>{t(`dashboard_studio.severity.${item.severity}`)}</Badge>
                </button>
                );
            })}
        </div>
    );
}

const severityTone: Record<DashboardRiskData['items'][number]['severity'], string> = {
    LOW: 'bg-slate-400', MEDIUM: 'bg-amber-400', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-600',
};

function PortfolioWidget({ data }: { data: DashboardSeriesData }) {
    const { t, i18n } = useTranslation();
    const series = Array.isArray(data.series) ? data.series : [];
    const total = series.reduce((sum, point) => sum + Number(point.value || 0), 0);
    if (!series.length && !data.portfolios) return <WidgetEmpty />;
    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between rounded-lg bg-muted/40 p-4">
                <div><div className="text-3xl font-semibold tabular-nums">{data.portfolios ?? 0}</div><div className="text-xs text-muted-foreground">{t('dashboard_studio.widgets.active_portfolios')}</div></div>
                <div className="text-right"><div className="text-2xl font-semibold tabular-nums">{total}</div><div className="text-xs text-muted-foreground">{t('dashboard_studio.widgets.initiatives')}</div></div>
            </div>
            <div className="space-y-2">
                {series.map((point, index) => (
                    <div key={`${point.name}-${index}`} className="grid grid-cols-[minmax(90px,1fr)_3fr_40px] items-center gap-2 text-xs">
                        <span className="truncate">{localizedStatus(point.name, t, i18n.exists.bind(i18n))}</span>
                        <Progress value={total ? (Number(point.value || 0) / total) * 100 : 0} className="h-2" />
                        <span className="text-right font-semibold tabular-nums">{point.value ?? 0}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function WidgetEmpty() {
    const { t } = useTranslation();
    return (
        <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-muted p-3"><AlertCircle className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-medium">{t('dashboard_studio.widgets.empty_title')}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t('dashboard_studio.widgets.empty_description')}</p>
        </div>
    );
}

function safeInternalPath(value?: string | null) {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.origin !== window.location.origin) return undefined;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return undefined;
    }
}

function localizedStatus(
    value: string | undefined,
    translate: (key: string, options?: Record<string, unknown>) => string,
    exists: (key: string) => boolean,
) {
    if (!value) return '';
    const dashboardKey = `dashboard_studio.status.${value}`;
    if (exists(dashboardKey)) return translate(dashboardKey);
    const workflowKey = `agile_board.status_options.${value}`;
    return exists(workflowKey) ? translate(workflowKey) : value.replaceAll('_', ' ');
}

function interleave<T>(first: T[], second: T[]) {
    const result: T[] = [];
    const length = Math.max(first.length, second.length);
    for (let index = 0; index < length; index += 1) {
        if (first[index] !== undefined) result.push(first[index]);
        if (second[index] !== undefined) result.push(second[index]);
    }
    return result;
}
