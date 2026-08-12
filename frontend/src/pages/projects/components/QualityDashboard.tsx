import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { analyticsService } from "@/services/analytics.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StoryDetailDialog } from "@/pages/projects/agile/components/StoryDetailDialog";
import {
    AlertTriangle,
    Bug,
    CheckCircle,
    ChevronRight,
    Loader2,
    MousePointerClick,
    ShieldAlert,
    TrendingUp,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const COLORS = ["#1677ff", "#06b6a4", "#f59e0b", "#f97316", "#8b5cf6", "#ec4899", "#64748b", "#94a3b8"];

export function QualityDashboard({ projectId: propProjectId }: { projectId?: string }) {
    const params = useParams<{ projectId: string }>();
    const projectId = propProjectId ?? params.projectId;
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [selectedRootCause, setSelectedRootCause] = useState<string | null>(null);
    const [selectedBugId, setSelectedBugId] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["quality-dashboard", projectId],
        queryFn: () => analyticsService.getQualityDashboard(projectId!),
        enabled: !!projectId,
    });

    const rootCauseData = useMemo(() => (data?.rootCauseDistribution ?? []).map((item, index) => ({
        name: item.rootCause,
        label: t(`root_causes.${item.rootCause}`, { defaultValue: item.rootCause }),
        value: item.count,
        fill: COLORS[index % COLORS.length],
    })), [data?.rootCauseDistribution, t]);

    const rootCauseBugs = data?.rootCauseBugs ?? [];
    const totalRootCauseBugs = rootCauseData.reduce((total, item) => total + item.value, 0);
    const activeRootCause = rootCauseData.some((item) => item.name === selectedRootCause)
        ? selectedRootCause
        : rootCauseData[0]?.name ?? null;
    const selectedRootCauseData = rootCauseData.find((item) => item.name === activeRootCause);
    const selectedBugs = rootCauseBugs.filter((bug) => bug.rootCause === activeRootCause);

    if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (error || !data) return <div className="p-4 text-destructive">{t("quality_dashboard.load_error")}</div>;

    const statusLabel = (status: string) => t(`common.statuses.${status}`, { defaultValue: status.replaceAll("_", " ") });
    const severityLabel = (severity: string | null) => severity ? t(`common.statuses.${severity}`, { defaultValue: severity }) : "—";
    const severityVariant = (severity: string | null): "destructive" | "warning" | "secondary" => {
        if (severity === "CRITICAL" || severity === "HIGH") return "destructive";
        if (severity === "MEDIUM") return "warning";
        return "secondary";
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {t("quality_dashboard.coverage_title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{data.traceability.coveragePercentage}%</div>
                        <Progress value={data.traceability.coveragePercentage} className="mt-2 h-2" />
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t("quality_dashboard.coverage_summary", { withTests: data.traceability.storiesWithTests, total: data.traceability.totalStories })}
                        </p>
                    </CardContent>
                </Card>

                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            {t("quality_dashboard.reopen_title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{data.reopenRate.reopenRate}%</div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t("quality_dashboard.reopen_summary", { count: data.reopenRate.reopenCount })}
                        </p>
                    </CardContent>
                </Card>

                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <ShieldAlert className="h-4 w-4 text-indigo-500" />
                            {t("quality_dashboard.release_readiness_title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.releaseReadiness.length > 0 ? (
                            <div>
                                <div className="text-3xl font-bold">{data.releaseReadiness[0].readinessScore ?? 0}%</div>
                                <p className="mt-2 truncate text-xs text-muted-foreground">
                                    {data.releaseReadiness[0].title} ({statusLabel(data.releaseReadiness[0].status)})
                                </p>
                            </div>
                        ) : (
                            <div className="mt-4 text-sm text-muted-foreground">{t("quality_dashboard.release_not_found")}</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/[0.03]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle>{t("quality_dashboard.root_cause_title")}</CardTitle>
                            <CardDescription className="mt-1">{t("quality_dashboard.root_cause_description")}</CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1.5 px-3 py-1">
                            <Bug className="h-3.5 w-3.5" />
                            {t("quality_dashboard.total_bugs", { count: totalRootCauseBugs })}
                        </Badge>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                        {t("quality_dashboard.root_cause_hint")}
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                        <div className="min-w-0 p-4 sm:p-6">
                            <div className="h-[300px] sm:h-[340px]">
                                {rootCauseData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={rootCauseData}
                                                dataKey="value"
                                                nameKey="label"
                                                cx="50%"
                                                cy="46%"
                                                innerRadius={70}
                                                outerRadius={112}
                                                paddingAngle={2}
                                                label={({ payload, percent }) => `${payload?.label ?? payload?.name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                                labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                                                onClick={(entry) => {
                                                    const clickedEntry = entry as { name?: string; payload?: { name?: string } };
                                                    const cause = rootCauseData.find((item) => item.label === clickedEntry.name)?.name
                                                        ?? clickedEntry.payload?.name
                                                        ?? clickedEntry.name;
                                                    if (cause && rootCauseData.some((item) => item.name === cause)) {
                                                        setSelectedRootCause(cause);
                                                    }
                                                }}
                                                cursor="pointer"
                                            >
                                                {rootCauseData.map((entry) => (
                                                    <Cell
                                                        key={entry.name}
                                                        fill={entry.fill}
                                                        stroke={activeRootCause === entry.name ? "#0f172a" : "#fff"}
                                                        strokeWidth={activeRootCause === entry.name ? 3 : 1}
                                                        opacity={!activeRootCause || activeRootCause === entry.name ? 1 : 0.55}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground">{t("quality_dashboard.no_data")}</div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-2">
                                {rootCauseData.map((item) => (
                                    <button
                                        key={item.name}
                                        type="button"
                                        onClick={() => setSelectedRootCause(item.name)}
                                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${activeRootCause === item.name ? "border-primary/50 bg-primary/[0.06]" : "border-border/60"}`}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                                            <span className="truncate">{item.label}</span>
                                        </span>
                                        <span className="font-semibold tabular-nums text-muted-foreground">{item.value}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t bg-muted/[0.02] xl:border-l xl:border-t-0">
                            <div className="flex items-start justify-between gap-3 border-b px-4 py-5 sm:px-6">
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-semibold">
                                        {selectedRootCauseData
                                            ? t("quality_dashboard.related_bugs_title", { cause: selectedRootCauseData.label })
                                            : t("quality_dashboard.root_cause_title")}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {selectedRootCauseData
                                            ? t("quality_dashboard.related_bugs_description")
                                            : t("quality_dashboard.select_root_cause")}
                                    </p>
                                </div>
                                {selectedRootCauseData && <Badge variant="secondary">{selectedBugs.length}</Badge>}
                            </div>

                            <div className="max-h-[390px] overflow-y-auto p-3 sm:p-4">
                                {!selectedRootCauseData ? (
                                    <div className="flex min-h-[250px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                                        {t("quality_dashboard.select_root_cause")}
                                    </div>
                                ) : selectedBugs.length === 0 ? (
                                    <div className="flex min-h-[250px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                                        {t("quality_dashboard.no_related_bugs")}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedBugs.map((bug) => (
                                            <button
                                                key={bug.id}
                                                type="button"
                                                onClick={() => setSelectedBugId(bug.id)}
                                                aria-label={t("quality_dashboard.open_bug", { key: bug.key })}
                                                className="group flex w-full items-start gap-3 rounded-lg border border-border/70 bg-background p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-primary">{bug.key}</span>
                                                        <Badge variant={severityVariant(bug.severity)}>{severityLabel(bug.severity)}</Badge>
                                                    </div>
                                                    <p className="line-clamp-2 text-sm font-medium leading-5">{bug.title}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">{statusLabel(bug.status)}</p>
                                                </div>
                                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("quality_dashboard.defect_leakage_title")}</CardTitle>
                    <CardDescription>{t("quality_dashboard.defect_leakage_description")}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    {data.defectLeakage.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.defectLeakage} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="envName" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="high" name={t("quality_dashboard.severity_high_critical")} stackId="a" fill="#ef4444" />
                                <Bar dataKey="low" name={t("quality_dashboard.severity_low_medium")} stackId="a" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">{t("quality_dashboard.no_data")}</div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        {t("quality_dashboard.mttr_title")}
                    </CardTitle>
                    <CardDescription>{t("quality_dashboard.mttr_description")}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    {data.mttr.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.mttr} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="avgHours" name={t("quality_dashboard.average_resolution_hours")} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">{t("quality_dashboard.resolved_empty")}</div>
                    )}
                </CardContent>
            </Card>

            <StoryDetailDialog
                storyId={selectedBugId}
                open={Boolean(selectedBugId)}
                onOpenChange={(open) => {
                    if (!open) setSelectedBugId(null);
                }}
                onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ["quality-dashboard", projectId] });
                }}
            />
        </div>
    );
}
