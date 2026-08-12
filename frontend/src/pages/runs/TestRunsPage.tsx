import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
    AlertTriangle,
    ArrowRight,
    Calendar,
    MoreHorizontal,
    PlayCircle,
    Search,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { testRunService } from "@/services/testRun.service";
import type { TestRun } from "@/types/testRun";
import { useAuthStore } from "@/store/authStore";
import { useDateLocale } from "@/hooks/useDateLocale";
import { appRoutes } from "@/lib/routes";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, PageLoading, PageToolbar } from "@/components/layout/PageChrome";

import { useTranslation } from "react-i18next";
import { logger } from "@/utils/logger";
import { useUrlListState } from "@/hooks/useUrlListState";
import { PageQueryError } from "@/components/layout/PageQueryError";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface TestRunListItem extends TestRun {
    project?: {
        name?: string;
    };
}

interface RunsMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface RunsResponse {
    data: TestRunListItem[];
    meta: RunsMeta;
}

const DEFAULT_META: RunsMeta = {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
};

export default function TestRunsPage() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { getString, getNumber, setValue, setValues } = useUrlListState();
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const queryClient = useQueryClient();
    const dateLocale = useDateLocale();

    const searchQuery = getString("q");
    const page = getNumber("page", 1);
    const [limit] = useState(10);
    const sortBy = getString("sort", "createdAt");
    const sortOrder: "asc" | "desc" = getString("order", "desc") === "asc" ? "asc" : "desc";

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [testRunToDelete, setTestRunToDelete] = useState<string | null>(null);
    const aiFocus = searchParams.get('aiFocus');

    const { data: response, isLoading, isError, refetch } = useQuery<RunsResponse>({
        queryKey: ["testRuns", page, limit, sortBy, sortOrder],
        queryFn: () => testRunService.getAll(undefined, undefined, page, limit, sortBy, sortOrder),
    });

    const testRuns = useMemo(() => response?.data ?? [], [response?.data]);
    const meta = response?.meta ?? DEFAULT_META;

    const filteredRuns = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        let runs = testRuns;

        if (aiFocus === 'open-runs') {
            runs = runs.filter((run) => run.status === 'OPEN');
        } else if (aiFocus === 'failed-runs') {
            runs = runs.filter((run) => (run.failedCount ?? 0) > 0 || (run.blockedCount ?? 0) > 0);
        } else if (aiFocus === 'conflicts') {
            runs = runs.filter((run) => run.items?.some((item) => item.finalStatus === 'CONFLICT'));
        }

        if (!needle) return runs;
        return runs.filter((run) =>
            run.title.toLowerCase().includes(needle) ||
            run.project?.name?.toLowerCase().includes(needle)
        );
    }, [aiFocus, searchQuery, testRuns]);

    const handleDeleteTestRun = (id: string) => {
        setTestRunToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!testRunToDelete) return;
        try {
            await testRunService.delete(testRunToDelete);
            await queryClient.invalidateQueries({ queryKey: ["testRuns"] });
            toast.success(t("test_runs.delete_success"));
            setDeleteDialogOpen(false);
            setTestRunToDelete(null);
        } catch (error) {
            logger.error(error);
            toast.error(t("test_runs.delete_error"));
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setValue("order", sortOrder === "asc" ? "desc" : "asc", "desc");
            return;
        }
        setValues({ sort: field, order: "asc" }, { sort: "createdAt", order: "desc" });
    };

    const renderRunActions = (run: TestRunListItem) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t("projects.open_menu")}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link to={appRoutes.resource(run.key)}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t("test_runs.view_details")}
                    </Link>
                </DropdownMenuItem>
                {user?.role === "ADMIN" && (
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteTestRun(run.id)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("test_runs.delete_run")}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (isLoading) {
        return <PageLoading metricCount={4} />
    }

    if (isError) {
        return <div className="page-shell"><PageQueryError onRetry={() => void refetch()} /></div>
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t("test_runs.title")}
                description={t("test_runs.description")}
                meta={
                    <div className="flex flex-wrap items-center gap-3">
                        <span>{t("test_runs.stats.total")}: <span className="font-bold text-foreground">{meta.total}</span></span>
                        <span className="text-border/60">•</span>
                        <span>{t("test_runs.tests")}: <span className="font-bold text-foreground">{testRuns.reduce((sum, run) => sum + (run._count?.items ?? run.totalItems ?? 0), 0)}</span></span>
                        {aiFocus && (
                            <>
                                <span className="text-border/60">•</span>
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                                    {t("dashboard.ai_guidance.focus")}: {t(`dashboard.ai_guidance.types.${aiFocus}`)}
                                </Badge>
                            </>
                        )}
                    </div>
                }
            />

            <PageToolbar className="p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                        <Input
                            aria-label={t("test_runs.filter_placeholder")}
                            placeholder={t("test_runs.filter_placeholder")}
                            value={searchQuery}
                            onChange={(event) => setValue("q", event.target.value)}
                            className="h-10 rounded-lg border-border/50 bg-background pl-9 shadow-none hover:border-primary/30 transition-colors focus-visible:ring-1 focus-visible:ring-primary/40"
                        />
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 lg:ml-auto">
                        {filteredRuns.length} / {testRuns.length}
                    </div>
                </div>
            </PageToolbar>

            {filteredRuns.length === 0 ? (
                <section className="enterprise-card border-dashed">
                    <EmptyState
                        icon={PlayCircle}
                        title={t("test_runs.no_runs_found")}
                        description={searchQuery ? t("common.table.no_results") : undefined}
                        className="py-20"
                    />
                </section>
            ) : (
                <>
                    <section className="space-y-3 md:hidden">
                        {filteredRuns.map((run) => {
                            const itemCount = run._count?.items ?? run.totalItems ?? 0;
                            const passed = run.passedCount ?? 0;
                            const failed = run.failedCount ?? 0;
                            const progress = itemCount > 0 ? Math.round(((passed + failed) / itemCount) * 100) : 0;
                            const passedWidth = itemCount > 0 ? (passed / itemCount) * 100 : 0;
                            const failedWidth = itemCount > 0 ? (failed / itemCount) * 100 : 0;

                            return (
                                <article key={run.id} className="enterprise-card">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                                            <StatusBadge status={run.status} className="h-12 w-12 p-0 flex items-center justify-center rounded-lg" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        to={appRoutes.resource(run.key)}
                                                        state={{ from: `${location.pathname}${location.search}` }}
                                                        className="text-enterprise-header block truncate hover:text-primary transition-colors"
                                                    >
                                                        {run.title}
                                                    </Link>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <StatusBadge status={run.status} showIcon={false} className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-enterprise-muted">{run.environment || t("test_runs.no_env")}</span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {renderRunActions(run)}
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                        {t("test_runs.project")}
                                                    </div>
                                                    <div className="mt-1 truncate text-[13px] font-semibold text-foreground/80">
                                                        {run.project?.name || t("test_runs.global")}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                        {t("test_runs.created")}
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-foreground/80">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                                                        {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true, locale: dateLocale })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="font-bold text-foreground/80">{t("test_runs.progress")}: {progress}%</span>
                                                    <span className="font-medium text-muted-foreground/70">
                                                        {itemCount} {t("test_runs.tests")}
                                                    </span>
                                                </div>
                                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
                                                    <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${passedWidth}%` }} />
                                                    <div className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" style={{ width: `${failedWidth}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className="hidden overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm md:block">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <SortableTableHead
                                        sortKey="title"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        className="w-[320px] px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                                    >
                                        {t("test_runs.run_name")}
                                    </SortableTableHead>
                                    <SortableTableHead
                                        sortKey="status"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                                    >
                                        {t("test_runs.status")}
                                    </SortableTableHead>
                                    <SortableTableHead
                                        sortKey="project"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        sortable={false}
                                        className="hidden px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 lg:table-cell"
                                    >
                                        {t("test_runs.project")}
                                    </SortableTableHead>
                                    <SortableTableHead
                                        sortKey="progress"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        sortable={false}
                                        className="w-[220px] px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                                    >
                                        {t("test_runs.progress")}
                                    </SortableTableHead>
                                    <SortableTableHead
                                        sortKey="createdAt"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        className="hidden md:table-cell px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                                    >
                                        {t("test_runs.created")}
                                    </SortableTableHead>
                                    <SortableTableHead
                                        sortKey="actions"
                                        activeSortKey={sortBy}
                                        direction={sortOrder}
                                        onSort={handleSort}
                                        sortable={false}
                                        className="px-5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                                    >
                                        {t("common.actions")}
                                    </SortableTableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filteredRuns.map((run) => {
                                    const itemCount = run._count?.items ?? run.totalItems ?? 0;
                                    const passed = run.passedCount ?? 0;
                                    const failed = run.failedCount ?? 0;
                                    const progress = itemCount > 0 ? Math.round(((passed + failed) / itemCount) * 100) : 0;
                                    const passedWidth = itemCount > 0 ? (passed / itemCount) * 100 : 0;
                                    const failedWidth = itemCount > 0 ? (failed / itemCount) * 100 : 0;

                                    return (
                                        <TableRow key={run.id} className="hover:bg-muted/15 border-border/40">
                                            <TableCell className="px-5 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                                                        <StatusBadge status={run.status} className="h-11 w-11 p-0 flex items-center justify-center rounded-lg shadow-sm" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link
                                                            to={appRoutes.resource(run.key)}
                                                            state={{ from: `${location.pathname}${location.search}` }}
                                                            className="text-enterprise-header block truncate hover:text-primary transition-colors"
                                                        >
                                                            {run.title}
                                                        </Link>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">{run.environment || t("test_runs.no_env")}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-enterprise-muted lg:inline">•</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-enterprise-muted lg:inline">{run.project?.name || t("test_runs.global")}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="px-5 hidden sm:table-cell">
                                                <StatusBadge status={run.status} showIcon={false} className="h-6 px-2 text-[10px] uppercase font-bold tracking-wider" />
                                            </TableCell>

                                            <TableCell className="px-5 hidden lg:table-cell">
                                                <Badge variant="outline" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-border/50 bg-muted/20">
                                                    {run.project?.name || t("test_runs.global")}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="px-5">
                                                <div className="space-y-1.5 min-w-[140px]">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="font-bold text-foreground/80">{progress}%</span>
                                                        <span className="font-medium text-muted-foreground/70">
                                                            {itemCount} {t("test_runs.tests")}
                                                        </span>
                                                    </div>
                                                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                                        <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${passedWidth}%` }} />
                                                        <div className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" style={{ width: `${failedWidth}%` }} />
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="px-5 hidden text-sm font-semibold text-enterprise-muted md:table-cell">
                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                                                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true, locale: dateLocale })}
                                                </div>
                                            </TableCell>

                                            <TableCell className="px-5 text-right">
                                                {renderRunActions(run)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </section>
                </>
            )}

            {meta.totalPages > 1 && (
                <section className="rounded-xl border border-border/50 bg-card px-4 py-2 shadow-sm transition-all hover:bg-card/80">
                    <PaginationControls
                        currentPage={page}
                        totalPages={meta.totalPages}
                        onPageChange={(nextPage) => setValue("page", nextPage, 1)}
                    />
                </section>
            )}


            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            {t("test_runs.delete_run_title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 pt-2">
                            <p>{t("test_runs.delete_run_desc")}</p>
                            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                                <ul className="list-disc space-y-1 pl-4">
                                    <li>{t("test_runs.delete_run_risk_1")}</li>
                                    <li>{t("test_runs.delete_run_risk_2")}</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            {t("common.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
