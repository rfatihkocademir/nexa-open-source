import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ArrowRight, Calendar, Flag, MoreHorizontal, Search } from "lucide-react";

import { milestoneService } from "@/services/milestone.service";
import type { Milestone } from "@/types/milestone";
import { appRoutes } from "@/lib/routes";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
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
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PageHeader, PageToolbar } from "@/components/layout/PageChrome";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useUrlListState } from "@/hooks/useUrlListState";
import { PageQueryError } from "@/components/layout/PageQueryError";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface MilestoneRow extends Milestone {
    project?: {
        name?: string;
    };
}

interface MilestoneMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface MilestonesResponse {
    data: MilestoneRow[];
    meta: MilestoneMeta;
}

const DEFAULT_META: MilestoneMeta = {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
};

export default function MilestonesPage() {
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { getString, getNumber, setValue, setValues } = useUrlListState();

    const searchQuery = getString("q");
    const page = getNumber("page", 1);
    const limit = 10;
    const sortBy = getString("sort", "dueDate");
    const sortOrder: "asc" | "desc" = getString("order", "asc") === "desc" ? "desc" : "asc";

    const { data: response, isLoading, isError, refetch } = useQuery<MilestonesResponse>({
        queryKey: ["milestones", "all", page, limit, sortBy, sortOrder],
        queryFn: () => milestoneService.getAll("", page, limit, sortBy, sortOrder),
    });

    const milestones = useMemo(() => response?.data ?? [], [response?.data]);
    const meta = response?.meta ?? DEFAULT_META;

    const filteredMilestones = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return milestones;
        return milestones.filter((milestone) =>
            milestone.name.toLowerCase().includes(needle) ||
            milestone.description?.toLowerCase().includes(needle) ||
            milestone.project?.name?.toLowerCase().includes(needle)
        );
    }, [milestones, searchQuery]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setValue("order", sortOrder === "asc" ? "desc" : "asc", "asc");
            return;
        }
        setValues({ sort: field, order: "asc" }, { sort: "dueDate", order: "asc" });
    };

    if (isLoading) {
        return (
            <div className="page-shell page-stack">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-[420px] w-full rounded-2xl" />
            </div>
        );
    }

    if (isError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void refetch()} /></div>
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t("milestones.title")}
                description={t("milestones.description")}
                meta={
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/60">{t("milestones.stats.total")}:</span>
                            <span className="font-bold text-foreground">{meta.total}</span>
                        </div>
                        <div className="h-4 w-px bg-border/40" />
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/60">{t("milestones.stats.open")}:</span>
                            <span className="font-bold text-primary">{milestones.filter((milestone) => milestone.status === "OPEN").length}</span>
                        </div>
                    </div>
                }
            />

            <PageToolbar>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="relative w-full max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                            aria-label={t("milestones.filter_placeholder")}
                            placeholder={t("milestones.filter_placeholder")}
                            className="h-10 rounded-xl border-border/50 bg-background/50 pl-10 text-[13px] transition-all focus:bg-background focus:ring-primary/10"
                            value={searchQuery}
                            onChange={(event) => setValue("q", event.target.value)}
                        />
                    </div>
                </div>
            </PageToolbar>

            {filteredMilestones.length === 0 ? (
                <section className="enterprise-card py-20">
                    <EmptyState
                        icon={Flag}
                        title={t("milestones.no_milestones_found")}
                        description={searchQuery ? t("common.table.no_results") : undefined}
                    />
                </section>
            ) : (
                <div className="enterprise-card !p-0 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-b border-border/50">
                                <SortableTableHead
                                    sortKey="name"
                                    activeSortKey={sortBy}
                                    direction={sortOrder}
                                    onSort={handleSort}
                                    className="h-11 py-0"
                                >
                                    {t("milestones.name")}
                                </SortableTableHead>
                                <SortableTableHead
                                    sortKey="project"
                                    activeSortKey={sortBy}
                                    direction={sortOrder}
                                    onSort={handleSort}
                                    sortable={false}
                                    className="h-11 py-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
                                >
                                    {t("milestones.project")}
                                </SortableTableHead>
                                <SortableTableHead
                                    sortKey="dueDate"
                                    activeSortKey={sortBy}
                                    direction={sortOrder}
                                    onSort={handleSort}
                                    className="h-11 py-0 px-0"
                                >
                                    {t("milestones.due_date")}
                                </SortableTableHead>
                                <SortableTableHead
                                    sortKey="status"
                                    activeSortKey={sortBy}
                                    direction={sortOrder}
                                    onSort={handleSort}
                                    className="h-11 py-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
                                >
                                    {t("milestones.status")}
                                </SortableTableHead>
                                <TableHead className="h-11 py-0 w-[90px] text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                    {t("milestones.actions")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMilestones.map((milestone) => (
                                <TableRow key={milestone.id} className="group hover:bg-primary/[0.02] border-b border-border/40 last:border-0">
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary transition-colors group-hover:bg-primary/10">
                                                <Flag className="h-5 w-5" />
                                            </div>
                                            <Link
                                                to={appRoutes.resource(milestone.key)}
                                                state={{ from: `${location.pathname}${location.search}` }}
                                                className="truncate text-[13px] font-bold text-foreground/80 transition-colors hover:text-primary"
                                            >
                                                {milestone.name}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Badge variant="outline" className="h-5 rounded-lg border-border/50 bg-muted/10 px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                            {milestone.project?.name || t("milestones.unknown_project")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 text-[13px] font-medium text-muted-foreground/70">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 opacity-40" />
                                            {milestone.dueDate
                                                ? new Date(milestone.dueDate).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })
                                                : t("milestones.no_date")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Badge
                                            className={cn(
                                                "h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider",
                                                milestone.status === "OPEN"
                                                    ? "border border-sky-500/30 bg-sky-500/10 text-sky-700"
                                                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                            )}
                                        >
                                            {t(`common.statuses.${milestone.status}`)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 hover:bg-primary/10 hover:text-primary transition-all group-hover:opacity-100">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">{t("milestones.open_menu")}</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl border-border/50">
                                                <DropdownMenuItem asChild className="text-[12px] font-medium">
                                                    <Link to={appRoutes.resource(milestone.key)} state={{ from: `${location.pathname}${location.search}` }}>
                                                        <ArrowRight className="mr-2 h-4 w-4" />
                                                        {t("milestones.view_details")}
                                                    </Link>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {meta.totalPages > 1 && (
                <section className="rounded-2xl border border-border/40 bg-muted/5 px-4 py-3 shadow-sm transition-all hover:bg-muted/10">
                    <PaginationControls
                        currentPage={page}
                        totalPages={meta.totalPages}
                        onPageChange={(nextPage) => setValue("page", nextPage, 1)}
                    />
                </section>
            )}

        </div>
    );
}
