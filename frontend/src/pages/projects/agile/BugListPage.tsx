import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Bug, Plus, Search, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageMetric, PageMetricGrid } from "@/components/layout/PageChrome";
import { PageQueryError } from "@/components/layout/PageQueryError";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useDateLocale } from "@/hooks/useDateLocale";
import { appRoutes } from "@/lib/routes";
import { bugService } from "@/services/bug.service";
import type { Story } from "@/types/agile";
import { CreateBugDialog } from "./components/CreateBugDialog";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

const CLOSED_STATUSES = new Set(["DONE", "CLOSED", "REJECTED", "RESOLVED"]);

function normalizedValue(value?: string | null) {
    return String(value || "").toUpperCase();
}

export default function BugListPage({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const dateLocale = useDateLocale();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [severity, setSeverity] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const { data: bugs = [], isLoading, isError, refetch } = useQuery({
        queryKey: ["bugs", projectId],
        queryFn: () => bugService.getAll(projectId),
        enabled: Boolean(projectId),
    });

    const statuses = useMemo(
        () => Array.from(new Set(bugs.map((bug) => normalizedValue(bug.status)).filter(Boolean))).sort(),
        [bugs],
    );

    const visibleBugs = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return bugs.filter((bug) => {
            if (severity !== "ALL" && normalizedValue(bug.severity) !== severity) return false;
            if (status !== "ALL" && normalizedValue(bug.status) !== status) return false;
            if (!query) return true;
            return [bug.key, bug.title, bug.description, bug.assignee?.firstName, bug.assignee?.lastName]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase().includes(query));
        });
    }, [bugs, search, severity, status]);

    const sortedBugs = useMemo(() => {
        const valueFor = (bug: Story) => {
            if (sortBy === "title") return bug.title || "";
            if (sortBy === "severity") return bug.severity || "";
            if (sortBy === "status") return bug.status || "";
            if (sortBy === "assignee") return `${bug.assignee?.firstName || ""} ${bug.assignee?.lastName || ""}`;
            return bug.createdAt || "";
        };

        return [...visibleBugs].sort((left, right) => {
            const result = String(valueFor(left)).localeCompare(String(valueFor(right)));
            return sortOrder === "asc" ? result : -result;
        });
    }, [sortBy, sortOrder, visibleBugs]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc");
            return;
        }
        setSortBy(field);
        setSortOrder(field === "createdAt" ? "desc" : "asc");
    };

    const openCount = bugs.filter((bug) => !CLOSED_STATUSES.has(normalizedValue(bug.status))).length;
    const criticalCount = bugs.filter((bug) => normalizedValue(bug.severity) === "CRITICAL" && !CLOSED_STATUSES.has(normalizedValue(bug.status))).length;
    const closedCount = bugs.length - openCount;

    const openBug = (bug: Story) => {
        const key = bug.key || bug.id;
        if (key) navigate(appRoutes.resource(key));
    };

    return (
        <div className="page-shell h-full min-h-0 overflow-y-auto">
            <div className="page-stack">
                <PageHeader
                    title={t("bugs_page.title")}
                    description={t("bugs_page.description")}
                    actions={
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("bugs_page.create")}
                        </Button>
                    }
                />

                <PageMetricGrid>
                    <PageMetric label={t("bugs_page.metrics.total")} value={bugs.length} icon={Bug} />
                    <PageMetric label={t("bugs_page.metrics.open")} value={openCount} icon={ShieldAlert} tone="warning" />
                    <PageMetric label={t("bugs_page.metrics.critical")} value={criticalCount} icon={ShieldAlert} tone="danger" />
                    <PageMetric label={t("bugs_page.metrics.closed")} value={closedCount} icon={Bug} tone="success" />
                </PageMetricGrid>

                <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/15 p-4 md:flex-row md:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t("bugs_page.filters.search")}
                                className="pl-9"
                            />
                        </div>
                        <Select value={severity} onValueChange={setSeverity}>
                            <SelectTrigger className="w-full md:w-44" aria-label={t("bugs_page.filters.severity")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("bugs_page.filters.all_severities")}</SelectItem>
                                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                                    <SelectItem key={value} value={value}>{t(`create_bug_dialog.severity.${value}`)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-full md:w-44" aria-label={t("bugs_page.filters.status")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("bugs_page.filters.all_statuses")}</SelectItem>
                                {statuses.map((value) => (
                                    <SelectItem key={value} value={value}>{t(`common.statuses.${value}`, { defaultValue: value })}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
                    ) : isError ? (
                        <div className="p-5"><PageQueryError onRetry={() => void refetch()} /></div>
                    ) : visibleBugs.length === 0 ? (
                        <EmptyState
                            icon={Bug}
                            title={bugs.length ? t("bugs_page.empty_filtered_title") : t("bugs_page.empty_title")}
                            description={bugs.length ? t("bugs_page.empty_filtered_description") : t("bugs_page.empty_description")}
                            action={bugs.length ? {
                                label: t("bugs_page.clear_filters"),
                                onClick: () => { setSearch(""); setSeverity("ALL"); setStatus("ALL"); },
                            } : {
                                label: t("bugs_page.create"),
                                onClick: () => setIsCreateOpen(true),
                            }}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <SortableTableHead sortKey="title" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="px-5">{t("bugs_page.table.bug")}</SortableTableHead>
                                        <SortableTableHead sortKey="severity" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("bugs_page.table.severity")}</SortableTableHead>
                                        <SortableTableHead sortKey="status" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("bugs_page.table.status")}</SortableTableHead>
                                        <SortableTableHead sortKey="assignee" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden lg:table-cell">{t("bugs_page.table.assignee")}</SortableTableHead>
                                        <SortableTableHead sortKey="createdAt" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} className="hidden md:table-cell">{t("bugs_page.table.created")}</SortableTableHead>
                                        <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="w-14"><span className="sr-only">{t("common.actions")}</span></SortableTableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedBugs.map((bug) => {
                                        const bugKey = bug.key || bug.id;
                                        return (
                                            <TableRow key={bug.id} className="group">
                                                <TableCell className="max-w-xl px-5 py-3.5">
                                                    <Link to={appRoutes.resource(bugKey)} className="block min-w-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                                        <span className="font-mono text-[11px] font-bold tracking-wide text-muted-foreground">{bug.key || `#${bug.id.slice(0, 8)}`}</span>
                                                        <span className="mt-0.5 block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{bug.title}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell><StatusBadge status={bug.severity || "MEDIUM"} /></TableCell>
                                                <TableCell><StatusBadge status={bug.status || "OPEN"} showIcon={false} /></TableCell>
                                                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                                                    {bug.assignee ? `${bug.assignee.firstName} ${bug.assignee.lastName}` : t("bugs_page.unassigned")}
                                                </TableCell>
                                                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                                                    {bug.createdAt ? format(new Date(bug.createdAt), "PP", { locale: dateLocale }) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => openBug(bug)} aria-label={t("bugs_page.open_bug", { key: bug.key || bug.title })}>
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </section>
            </div>

            <CreateBugDialog
                projectId={projectId}
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onCreated={openBug}
            />
        </div>
    );
}
