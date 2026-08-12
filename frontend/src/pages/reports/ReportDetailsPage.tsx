import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { testRunService } from "@/services/testRun.service";
import type { RunReport } from "@/types/testRun";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useTranslation } from "react-i18next";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

type ReportStatus = "Passed" | "Failed" | "Blocked" | "Skipped" | "Untested";

const STATUS_TABS: Array<"all" | ReportStatus> = ["all", "Failed", "Blocked", "Untested", "Passed"];

export default function ReportDetailsPage() {
    const { t } = useTranslation();
    const { reportId } = useParams();
    const [sortBy, setSortBy] = useState("title");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const { data: report, isLoading, error } = useQuery<RunReport>({
        queryKey: ["test-run-report", reportId],
        queryFn: () => testRunService.getReport(reportId!),
        enabled: Boolean(reportId),
    });

    const summaryCounts = useMemo(() => {
        const map = new Map<string, number>();
        (report?.summary ?? []).forEach((item) => {
            map.set(item.name, item.value);
        });
        return map;
    }, [report?.summary]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Passed":
                return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
            case "Failed":
                return <XCircle className="h-4 w-4 text-rose-600" />;
            case "Blocked":
                return <AlertCircle className="h-4 w-4 text-amber-600" />;
            case "Skipped":
                return <MinusCircle className="h-4 w-4 text-slate-500" />;
            case "Untested":
                return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Passed":
                return <Badge className="border-emerald-300/60 bg-emerald-50 text-emerald-700">{t("report_details.statuses.Passed")}</Badge>;
            case "Failed":
                return <Badge className="border-rose-300/60 bg-rose-50 text-rose-700">{t("report_details.statuses.Failed")}</Badge>;
            case "Blocked":
                return <Badge className="border-amber-300/60 bg-amber-50 text-amber-700">{t("report_details.statuses.Blocked")}</Badge>;
            case "Skipped":
                return <Badge className="border-slate-300/60 bg-slate-50 text-slate-700">{t("report_details.statuses.Skipped")}</Badge>;
            case "Untested":
                return <Badge variant="outline" className="text-muted-foreground">{t("report_details.statuses.Untested")}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "Passed":
                return t("report_details.statuses.Passed");
            case "Failed":
                return t("report_details.statuses.Failed");
            case "Blocked":
                return t("report_details.statuses.Blocked");
            case "Skipped":
                return t("report_details.statuses.Skipped");
            case "Untested":
                return t("report_details.statuses.Untested");
            default:
                return status;
        }
    };

    const sortRows = <T extends { id: string; title: string; status: string; duration: string | number; assignee: string; error?: string | null }>(rows: T[]) => {
        return [...rows].sort((left, right) => {
            const valueFor = (row: T) => {
                if (sortBy === "status") return row.status;
                if (sortBy === "duration") return row.duration;
                if (sortBy === "assignee") return row.assignee;
                return row.title;
            };
            const leftValue = valueFor(left);
            const rightValue = valueFor(right);
            const result = typeof leftValue === "number" && typeof rightValue === "number"
                ? leftValue - rightValue
                : String(leftValue || "").localeCompare(String(rightValue || ""));
            return sortOrder === "asc" ? result : -result;
        });
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc");
            return;
        }
        setSortBy(field);
        setSortOrder("asc");
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">{t("report_details.error_loading")}</h2>
                <p className="text-muted-foreground">{t("report_details.not_found_desc")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">{t("report_details.section_label")}</p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {t("report_details.title")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("report_details.report_id", { id: reportId })}</p>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t("report_details.execution_summary")}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={report.summary}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={62}
                                    outerRadius={84}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {report.summary.map((entry, index) => (
                                        <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-2 flex flex-wrap justify-center gap-4">
                            {report.summary.map((item) => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm font-medium text-foreground">
                                        {getStatusLabel(item.name)}: {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="rounded-2xl border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle>{t("report_details.key_metrics")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between border-b border-border/70 pb-2">
                                <span className="text-sm text-muted-foreground">{t("report_details.total_cases")}</span>
                                <span className="text-lg font-semibold text-foreground">{report.metrics.totalCases}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border/70 pb-2">
                                <span className="text-sm text-muted-foreground">{t("report_details.pass_rate")}</span>
                                <span className="text-lg font-semibold text-emerald-700">{report.metrics.passRate}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{t("report_details.duration")}</span>
                                <span className="text-lg font-semibold text-foreground">{report.metrics.duration}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{t("report_details.test_case_details")}</h2>

                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-0 pb-1">
                        <TabsTrigger data-testid="report-details-tab-all" value="all">{t("report_details.all_cases")}</TabsTrigger>
                        <TabsTrigger data-testid="report-details-tab-failed" value="Failed" className="text-rose-700">
                            {t("report_details.failed_cases", { count: summaryCounts.get("Failed") ?? 0 })}
                        </TabsTrigger>
                        <TabsTrigger data-testid="report-details-tab-blocked" value="Blocked" className="text-amber-700">
                            {t("report_details.blocked_cases", { count: summaryCounts.get("Blocked") ?? 0 })}
                        </TabsTrigger>
                        <TabsTrigger data-testid="report-details-tab-untested" value="Untested" className="text-slate-700">
                            {t("report_details.untested_cases", { count: summaryCounts.get("Untested") ?? 0 })}
                        </TabsTrigger>
                        <TabsTrigger data-testid="report-details-tab-passed" value="Passed" className="text-emerald-700">
                            {t("report_details.passed_cases", { count: summaryCounts.get("Passed") ?? 0 })}
                        </TabsTrigger>
                    </TabsList>

                    {STATUS_TABS.map((tabValue) => {
                        const rows = report.cases.filter((item) => tabValue === "all" || item.status === tabValue);

                        return (
                            <TabsContent key={tabValue} value={tabValue} className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-background">
                                <Table className="min-w-[620px] md:min-w-0">
                                    <TableHeader className="bg-muted/15">
                                        <TableRow className="hover:bg-transparent">
                                            <SortableTableHead sortKey="id" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="hidden w-[120px] sm:table-cell">{t("report_details.id")}</SortableTableHead>
                                            <SortableTableHead sortKey="title" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("report_details.case_title")}</SortableTableHead>
                                            <SortableTableHead sortKey="status" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="w-[140px]">{t("report_details.status")}</SortableTableHead>
                                            <SortableTableHead sortKey="duration" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden w-[110px] md:table-cell">{t("report_details.duration")}</SortableTableHead>
                                            <SortableTableHead sortKey="assignee" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden w-[170px] lg:table-cell">{t("report_details.assignee")}</SortableTableHead>
                                            {tabValue !== "Passed" && <SortableTableHead sortKey="error" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="hidden xl:table-cell">{t("report_details.error_reason")}</SortableTableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortRows(rows).map((testCase) => (
                                            <TableRow key={testCase.id} className="hover:bg-muted/10">
                                                <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                                                    {testCase.id.slice(0, 8)}
                                                </TableCell>
                                                <TableCell className="font-medium text-foreground">
                                                    <div className="space-y-1">
                                                        <div>{testCase.title}</div>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
                                                            <span>ID: {testCase.id.slice(0, 8)}</span>
                                                            <span>{testCase.duration}</span>
                                                            <span>{testCase.assignee}</span>
                                                        </div>
                                                        {tabValue !== "Passed" && testCase.error ? (
                                                            <p className="text-xs text-rose-600 xl:hidden">{testCase.error}</p>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(testCase.status)}
                                                        {getStatusBadge(testCase.status)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">{testCase.duration}</TableCell>
                                                <TableCell className="hidden lg:table-cell">{testCase.assignee}</TableCell>
                                                {tabValue !== "Passed" && (
                                                    <TableCell className="hidden text-sm text-rose-600 xl:table-cell">
                                                        {testCase.error || "-"}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                        {rows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    {t("report_details.no_cases_found")}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </section>
        </div>
    );
}
