import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, FileBarChart, FileX, MoreHorizontal, Search } from "lucide-react";
import { CreateReportDialog } from "./components/CreateReportDialog";

import { testRunService } from "@/services/testRun.service";
import type { TestRun } from "@/types/testRun";
import { useDateLocale } from "@/hooks/useDateLocale";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, PageToolbar } from "@/components/layout/PageChrome";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useTranslation } from "react-i18next";

type ReportRow = TestRun;

interface ReportsResponse {
    data: ReportRow[];
}

export default function ReportsPage() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const dateLocale = useDateLocale();

    const { data: reportsResponse, isLoading } = useQuery<ReportsResponse>({
        queryKey: ["testRuns", "reports"],
        queryFn: () => testRunService.getAll(undefined, undefined, 1, 100),
    });

    const reports = useMemo(() => reportsResponse?.data ?? [], [reportsResponse?.data]);

    const filteredReports = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return reports;
        return reports.filter((report) =>
            report.title.toLowerCase().includes(needle) ||
            report.milestone?.name?.toLowerCase().includes(needle)
        );
    }, [reports, searchQuery]);

    const sortedReports = useMemo(() => {
        const valueFor = (report: ReportRow) => {
            if (sortBy === "title") return report.title;
            if (sortBy === "milestone") return report.milestone?.name || "";
            return report.createdAt;
        };

        return [...filteredReports].sort((left, right) => {
            const leftValue = valueFor(left);
            const rightValue = valueFor(right);
            const result = typeof leftValue === "string" && typeof rightValue === "string"
                ? leftValue.localeCompare(rightValue)
                : Number(leftValue) - Number(rightValue);
            return sortOrder === "asc" ? result : -result;
        });
    }, [filteredReports, sortBy, sortOrder]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc");
            return;
        }
        setSortBy(field);
        setSortOrder(field === "createdAt" ? "desc" : "asc");
    };

    const overallPassRate = useMemo(() => {
        const totalCases = reports.reduce((sum, report) => sum + (report.totalItems || 0), 0);
        const totalPassed = reports.reduce((sum, report) => sum + (report.passedCount || 0), 0);
        return totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;
    }, [reports]);

    const renderReportActions = (report: ReportRow) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-testid="reports-item-menu-btn" variant="ghost" size="icon" className="h-8 w-8 rounded-md" aria-label={t("reports.open_menu")} title={t("reports.open_menu")}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t("reports.open_menu")}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link data-testid="reports-item-view-link" to={`/reports/${report.id}`}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t("reports.view_details")}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (isLoading) {
        return (
            <div className="page-shell page-stack">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-[430px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t("reports.title")}
                description={t("reports.description")}
                meta={
                    <div className="flex flex-wrap items-center gap-3">
                        <span>{t("reports.stats.reports")}: <span className="font-bold text-foreground">{reports.length}</span></span>
                        <span className="text-border/60">•</span>
                        <span>{t("reports.stats.pass_rate")}: <span className="font-bold text-foreground">%{overallPassRate}</span></span>
                    </div>
                }
            />

            <PageToolbar className="p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                        <Input
                            data-testid="reports-filter-input"
                            aria-label={t("reports.filter_placeholder")}
                            placeholder={t("reports.filter_placeholder")}
                            className="h-10 rounded-xl border-border/50 bg-background pl-9 shadow-none hover:border-primary/30 transition-colors focus-visible:ring-1 focus-visible:ring-primary/40"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 lg:ml-auto">
                        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80">
                            {filteredReports.length} / {reports.length}
                        </div>
                        <CreateReportDialog />
                    </div>
                </div>
            </PageToolbar>

            {filteredReports.length === 0 ? (
                <section className="enterprise-card border-dashed">
                    <EmptyState
                        icon={FileX}
                        title={t("reports.no_reports")}
                        description={t("reports.no_reports_desc")}
                        className="py-20"
                    />
                </section>
            ) : (
                <>
                    <section className="space-y-3 md:hidden">
                        {sortedReports.map((report) => {
                            const total = report.totalItems || 0;
                            const passed = report.passedCount || 0;
                            const failed = report.failedCount || 0;
                            const blocked = report.blockedCount || 0;
                            const untested = report.untestedCount || 0;
                            const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

                            return (
                                <article key={report.id} className="enterprise-card">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary">
                                            <FileBarChart className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        data-testid="reports-item-title-link"
                                                        to={`/reports/${report.id}`}
                                                        className="text-enterprise-header block truncate hover:text-primary transition-colors"
                                                    >
                                                        {report.title}
                                                    </Link>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider border-border/50 bg-muted/20">
                                                            {report.milestone?.name || t("test_runs.global")}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-enterprise-muted">{format(new Date(report.createdAt), "d MMM yyyy", { locale: dateLocale })}</span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {renderReportActions(report)}
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="font-bold text-emerald-600">
                                                        {t("reports.pass_rate", { rate: passRate })}
                                                    </span>
                                                    <span className="font-medium text-muted-foreground/70">
                                                        {t("reports.total_tests", { total })}
                                                    </span>
                                                </div>
                                                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                                    <div style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }} className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                                    <div style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }} className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                                                    <div style={{ width: `${total > 0 ? (blocked / total) * 100 : 0}%` }} className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                                                    <div style={{ width: `${total > 0 ? (untested / total) * 100 : 0}%` }} className={cn("h-full bg-slate-400")} />
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                        {t("reports.type")}
                                                    </div>
                                                    <div className="mt-1 truncate text-[13px] font-semibold text-foreground/80">
                                                        {report.milestone?.name || t("test_runs.global")}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                        {t("reports.date")}
                                                    </div>
                                                    <div className="mt-1 text-[13px] font-semibold text-foreground/80">
                                                        {format(new Date(report.createdAt), "d MMMM yyyy", { locale: dateLocale })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className="hidden overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm md:block">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <SortableTableHead sortKey="title" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="w-[320px] px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                        {t("reports.report_name")}
                                    </SortableTableHead>
                                    <SortableTableHead sortKey="milestone" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 lg:table-cell">
                                        {t("reports.type")}
                                    </SortableTableHead>
                                    <SortableTableHead sortKey="createdAt" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 md:table-cell">
                                        {t("reports.date")}
                                    </SortableTableHead>
                                    <SortableTableHead sortKey="summary" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="w-[320px] px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                        {t("reports.summary")}
                                    </SortableTableHead>
                                    <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="px-5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                        {t("reports.actions")}
                                    </SortableTableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedReports.map((report) => {
                                    const total = report.totalItems || 0;
                                    const passed = report.passedCount || 0;
                                    const failed = report.failedCount || 0;
                                    const blocked = report.blockedCount || 0;
                                    const untested = report.untestedCount || 0;
                                    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

                                    return (
                                        <TableRow key={report.id} className="hover:bg-muted/15 border-border/40">
                                            <TableCell className="px-5 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary">
                                                        <FileBarChart className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link
                                                            data-testid="reports-item-title-link"
                                                            to={`/reports/${report.id}`}
                                                            className="text-enterprise-header block truncate hover:text-primary transition-colors"
                                                        >
                                                            {report.title}
                                                        </Link>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-5 hidden lg:table-cell">
                                                <Badge variant="outline" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-border/50 bg-muted/20">
                                                    {report.milestone?.name || t("test_runs.global")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-5 hidden text-sm font-semibold text-enterprise-muted md:table-cell whitespace-nowrap">
                                                {format(new Date(report.createdAt), "d MMMM yyyy", { locale: dateLocale })}
                                            </TableCell>
                                            <TableCell className="px-5">
                                                <div className="space-y-1.5 min-w-[200px]">
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="font-bold text-emerald-600">
                                                            {t("reports.pass_rate", { rate: passRate })}
                                                        </span>
                                                        <span className="font-medium text-muted-foreground/70">
                                                            {t("reports.total_tests", { total })}
                                                        </span>
                                                    </div>
                                                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                                        <div style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }} className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                                        <div style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }} className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                                                        <div style={{ width: `${total > 0 ? (blocked / total) * 100 : 0}%` }} className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                                                        <div style={{ width: `${total > 0 ? (untested / total) * 100 : 0}%` }} className={cn("h-full bg-slate-400")} />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-5 text-right">
                                                {renderReportActions(report)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </section>
                </>
            )}
        </div>
    );
}
