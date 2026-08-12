import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlarmClock,
    AlertOctagon,
    CheckCheck,
    Inbox,
    ListChecks,
    Loader2,
    RefreshCw,
    Search,
    UserRound,
    X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader, PageMetric, PageMetricGrid, PageToolbar } from "@/components/layout/PageChrome";
import { PageQueryError } from "@/components/layout/PageQueryError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { appRoutes } from "@/lib/routes";
import { actionCenterService } from "@/services/action-center.service";
import { useAuthStore } from "@/store/authStore";
import type {
    ActionCenterItem,
    ActionCenterMode,
    ActionCenterPerson,
    ActionCenterProject,
    ActionCenterSeverity,
    ActionCenterStatus,
    BulkUpdateActionCenterItemsInput,
    ConvertActionCenterItemInput,
    UpdateActionCenterItemInput,
} from "@/types/action-center";
import { ActionCenterItemCard } from "./components/ActionCenterItemCard";
import { ActionItemDialog, ConvertActionDialog, SnoozeActionDialog } from "./components/ActionItemDialog";

const PAGE_SIZE = 20;
const ALL = "__all__";
const STATUSES: ActionCenterStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED"];
const SEVERITIES: ActionCenterSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MODES: ActionCenterMode[] = ["mine", "open", "critical", "snoozed"];

interface EditingAction {
    item: ActionCenterItem;
    initialStatus?: ActionCenterStatus;
}

export default function ActionCenterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const canManage = user?.role === "ADMIN" || user?.role === "TEAM_LEADER";
    const mode = enumParam<ActionCenterMode>(searchParams.get("mode"), MODES, "mine");
    const search = searchParams.get("q") || "";
    const projectId = searchParams.get("project") || ALL;
    const status = enumParam<ActionCenterStatus | typeof ALL>(searchParams.get("status"), STATUSES, ALL);
    const severity = enumParam<ActionCenterSeverity | typeof ALL>(searchParams.get("severity"), SEVERITIES, ALL);
    const page = positiveInteger(searchParams.get("page"));
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<EditingAction>();
    const [snoozing, setSnoozing] = useState<ActionCenterItem>();
    const [convertingItem, setConvertingItem] = useState<ActionCenterItem>();
    const [bulkStatus, setBulkStatus] = useState<ActionCenterStatus>("IN_PROGRESS");
    const [bulkResolution, setBulkResolution] = useState("");
    const [renderTime, setRenderTime] = useState(() => Date.now());
    const debouncedSearch = useDebounce(search, 300);

    const updateUrlState = (updates: Record<string, string | null>, replace = false) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            Object.entries(updates).forEach(([key, value]) => {
                if (value) next.set(key, value);
                else next.delete(key);
            });
            return next;
        }, { replace });
    };

    useEffect(() => {
        const interval = window.setInterval(() => setRenderTime(Date.now()), 60_000);
        return () => window.clearInterval(interval);
    }, []);

    const params = {
        mode,
        search: debouncedSearch || undefined,
        projectId: projectId === ALL ? undefined : projectId,
        status: status === ALL ? undefined : status,
        severity: severity === ALL ? undefined : severity,
        page,
        limit: PAGE_SIZE,
    };

    const listQuery = useQuery({
        queryKey: ["action-center", "items", params],
        queryFn: () => actionCenterService.list(params),
    });
    const summaryQuery = useQuery({
        queryKey: ["action-center", "summary"],
        queryFn: actionCenterService.summary,
    });

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["action-center", "items"] }),
            queryClient.invalidateQueries({ queryKey: ["action-center", "summary"] }),
        ]);
    };

    const reconcile = useMutation({
        mutationFn: actionCenterService.reconcile,
        onSuccess: async () => {
            setSelectedIds(new Set());
            await refresh();
            toast.success(t("action_center.feedback.reconciled"));
        },
        onError: () => toast.error(t("action_center.feedback.reconcile_error")),
    });
    const updateItem = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateActionCenterItemInput }) => actionCenterService.update(id, input),
        onSuccess: async () => {
            setEditing(undefined);
            setSnoozing(undefined);
            await refresh();
            toast.success(t("action_center.feedback.updated"));
        },
        onError: () => toast.error(t("action_center.feedback.update_error")),
    });
    const bulkUpdate = useMutation({
        mutationFn: (input: BulkUpdateActionCenterItemsInput) => actionCenterService.bulkUpdate(input),
        onSuccess: async (result) => {
            setSelectedIds(new Set());
            setBulkResolution("");
            await refresh();
            toast.success(t("action_center.feedback.bulk_updated", { count: result.updated }));
        },
        onError: () => toast.error(t("action_center.feedback.bulk_error")),
    });
    const convert = useMutation({
        mutationFn: ({ id, input }: { id: string; input: ConvertActionCenterItemInput }) => actionCenterService.convertToWorkItem(id, input),
        onSuccess: async (result, converted) => {
            setConvertingItem(undefined);
            setSelectedIds((current) => {
                if (!current.has(converted.id)) return current;
                const next = new Set(current);
                next.delete(converted.id);
                return next;
            });
            await refresh();
            toast.success(t("action_center.feedback.converted", { key: result.key }), {
                action: { label: t("action_center.actions.open"), onClick: () => navigate(safeInternalPath(result.url) || appRoutes.resource(result.key)) },
            });
        },
        onError: () => toast.error(t("action_center.feedback.convert_error")),
    });

    const items = useMemo(() => listQuery.data?.items || [], [listQuery.data?.items]);
    const summary = summaryQuery.data;
    const canMutateItem = (item: ActionCenterItem) => Boolean(canManage || !item.assignee || item.assignee.id === user?.id);
    const selectableItems = items.filter(canMutateItem);
    const selectableIds = new Set(selectableItems.map((item) => item.id));
    const effectiveSelectedIds = new Set([...selectedIds].filter((id) => selectableIds.has(id)));
    const selectedVisibleCount = effectiveSelectedIds.size;
    const allVisibleSelected = selectableItems.length > 0 && selectedVisibleCount === selectableItems.length;
    const pageSelectionState = allVisibleSelected ? true : selectedVisibleCount > 0 ? "indeterminate" : false;

    const projects = useMemo(() => uniqueById<ActionCenterProject>([
        ...(listQuery.data?.facets?.projects || []),
        ...items.flatMap((item) => item.project ? [item.project] : []),
    ]), [items, listQuery.data?.facets?.projects]);
    const assignees = useMemo(() => uniqueById<ActionCenterPerson>([
        ...(listQuery.data?.facets?.assignees || []),
        ...items.flatMap((item) => item.assignee ? [item.assignee] : []),
    ]), [items, listQuery.data?.facets?.assignees]);
    const editableAssignees = canManage ? assignees : assignees.filter((person) => person.id === user?.id);

    const selectVisible = (checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            selectableItems.forEach((item) => {
                if (checked) next.add(item.id);
                else next.delete(item.id);
            });
            return next;
        });
    };

    const setModeAndReset = (nextMode: ActionCenterMode) => {
        if (nextMode === mode) return;
        updateUrlState({ mode: nextMode === "mine" ? null : nextMode, page: null });
        setSelectedIds(new Set());
    };

    const clearFilters = () => {
        updateUrlState({ q: null, project: null, status: null, severity: null, page: null });
        setSelectedIds(new Set());
    };

    const applyBulkStatus = () => {
        const requiresResolution = bulkStatus === "RESOLVED" || bulkStatus === "DISMISSED";
        if (requiresResolution && !bulkResolution.trim()) {
            toast.error(t("action_center.fields.resolution_required"));
            return;
        }
        bulkUpdate.mutate({
            ids: [...effectiveSelectedIds],
            status: bulkStatus,
            resolution: requiresResolution ? bulkResolution.trim() : null,
            assigneeId: !canManage && requiresResolution ? user?.id : undefined,
        });
    };

    const activeFilterCount = Number(Boolean(search)) + Number(projectId !== ALL) + Number(status !== ALL) + Number(severity !== ALL);

    const manualRefresh = async () => {
        setSelectedIds(new Set());
        await refresh();
    };

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={<span className="flex items-center gap-2"><Inbox className="h-6 w-6 text-primary" />{t("action_center.title")}</span>}
                description={t("action_center.description")}
                actions={
                    <Button variant="outline" onClick={() => canManage ? reconcile.mutate() : void manualRefresh()} disabled={reconcile.isPending || listQuery.isFetching}>
                        {reconcile.isPending || listQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {t(canManage ? "action_center.reconcile" : "action_center.refresh")}
                    </Button>
                }
            />

            <PageMetricGrid>
                <SummaryMetric mode="mine" active={mode === "mine"} label={t("action_center.modes.mine")} value={summary?.mine} icon={UserRound} tone="primary" onClick={() => setModeAndReset("mine")} />
                <SummaryMetric mode="open" active={mode === "open"} label={t("action_center.modes.open")} value={summary?.open} icon={ListChecks} tone="neutral" onClick={() => setModeAndReset("open")} />
                <SummaryMetric mode="critical" active={mode === "critical"} label={t("action_center.modes.critical")} value={summary?.critical} icon={AlertOctagon} tone="danger" onClick={() => setModeAndReset("critical")} />
                <SummaryMetric mode="snoozed" active={mode === "snoozed"} label={t("action_center.modes.snoozed")} value={summary?.snoozed} icon={AlarmClock} tone="warning" onClick={() => setModeAndReset("snoozed")} />
            </PageMetricGrid>

            <PageToolbar>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="relative min-w-0 flex-1 xl:max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input value={search} maxLength={120} onChange={(event) => { updateUrlState({ q: event.target.value || null, page: null }, true); setSelectedIds(new Set()); }} className="pl-9" placeholder={t("action_center.filters.search")} aria-label={t("action_center.filters.search")} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 xl:flex">
                        <Select value={projectId} onValueChange={(value) => { updateUrlState({ project: value === ALL ? null : value, page: null }); setSelectedIds(new Set()); }}>
                            <SelectTrigger className="min-w-0 sm:min-w-44" aria-label={t("action_center.filters.project")}><SelectValue placeholder={t("action_center.filters.project")} /></SelectTrigger>
                            <SelectContent><SelectItem value={ALL}>{t("action_center.filters.all_projects")}</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={status} onValueChange={(value: ActionCenterStatus | typeof ALL) => { updateUrlState({ status: value === ALL ? null : value, page: null }); setSelectedIds(new Set()); }}>
                            <SelectTrigger className="min-w-0 sm:min-w-40" aria-label={t("action_center.filters.status")}><SelectValue placeholder={t("action_center.filters.status")} /></SelectTrigger>
                            <SelectContent><SelectItem value={ALL}>{t("action_center.filters.all_statuses")}</SelectItem>{STATUSES.map((option) => <SelectItem key={option} value={option}>{t(`action_center.status.${option}`)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={severity} onValueChange={(value: ActionCenterSeverity | typeof ALL) => { updateUrlState({ severity: value === ALL ? null : value, page: null }); setSelectedIds(new Set()); }}>
                            <SelectTrigger className="min-w-0 sm:min-w-40" aria-label={t("action_center.filters.severity")}><SelectValue placeholder={t("action_center.filters.severity")} /></SelectTrigger>
                            <SelectContent><SelectItem value={ALL}>{t("action_center.filters.all_severities")}</SelectItem>{SEVERITIES.map((option) => <SelectItem key={option} value={option}>{t(`action_center.severity.${option}`)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="mr-1.5 h-4 w-4" />{t("action_center.filters.clear")}<Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge></Button>}
                </div>
            </PageToolbar>

            {effectiveSelectedIds.size > 0 && (
                <section className="sticky top-[var(--density-header-height)] z-20 rounded-xl border border-primary/25 bg-card p-3 shadow-lg" aria-label={t("action_center.bulk.title")}>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <div className="flex items-center gap-2">
                            <CheckCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">{t("action_center.bulk.selected", { count: effectiveSelectedIds.size })}</span>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>{t("action_center.bulk.clear")}</Button>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
                            <Select value={bulkStatus} onValueChange={(value: ActionCenterStatus) => setBulkStatus(value)}>
                                <SelectTrigger className="sm:w-48" aria-label={t("action_center.fields.status")}><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUSES.filter((option) => canManage || option !== "DISMISSED").map((option) => <SelectItem key={option} value={option}>{t(`action_center.status.${option}`)}</SelectItem>)}</SelectContent>
                            </Select>
                            {(bulkStatus === "RESOLVED" || bulkStatus === "DISMISSED") && <Textarea className="min-h-9 sm:max-w-sm" rows={1} value={bulkResolution} onChange={(event) => setBulkResolution(event.target.value)} placeholder={t("action_center.fields.resolution_placeholder")} aria-label={t("action_center.fields.resolution")} />}
                            <Button onClick={applyBulkStatus} disabled={bulkUpdate.isPending}>{bulkUpdate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("action_center.bulk.apply")}</Button>
                            <Button variant="outline" onClick={() => bulkUpdate.mutate({ ids: [...effectiveSelectedIds], snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), assigneeId: !canManage ? user?.id : undefined })} disabled={bulkUpdate.isPending}><AlarmClock className="mr-2 h-4 w-4" />{t("action_center.bulk.snooze_day")}</Button>
                        </div>
                    </div>
                </section>
            )}

            {listQuery.isError ? <PageQueryError onRetry={() => void listQuery.refetch()} title={t("action_center.error.title")} description={t("action_center.error.description")} /> : (
                <section className="space-y-3" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 px-1">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox checked={pageSelectionState} onCheckedChange={(checked) => selectVisible(checked === true)} disabled={!selectableItems.length} />
                            {t("action_center.select_page")}
                        </label>
                        <span className="text-xs text-muted-foreground">{t("action_center.result_count", { count: listQuery.data?.total || 0 })}</span>
                    </div>
                    {listQuery.isLoading ? <ActionCenterSkeleton /> : items.length ? items.map((item) => (
                        <ActionCenterItemCard
                            key={item.id}
                            item={item}
                            canMutate={canMutateItem(item)}
                            selected={effectiveSelectedIds.has(item.id)}
                            onSelectedChange={(selected) => setSelectedIds((current) => {
                                const next = new Set(current);
                                if (selected) next.add(item.id);
                                else next.delete(item.id);
                                return next;
                            })}
                            onEdit={() => setEditing({ item })}
                            onResolve={() => setEditing({ item, initialStatus: "RESOLVED" })}
                            onSnooze={() => setSnoozing(item)}
                            onConvert={() => setConvertingItem(item)}
                            onStatusChange={(nextStatus) => updateItem.mutate({
                                id: item.id,
                                input: {
                                    status: nextStatus,
                                    assigneeId: !canManage && nextStatus === "IN_PROGRESS" && !item.assignee ? user?.id : undefined,
                                },
                            })}
                            converting={convert.isPending && convert.variables?.id === item.id}
                            updating={updateItem.isPending && updateItem.variables?.id === item.id}
                            now={renderTime}
                        />
                    )) : <div className="rounded-xl border border-dashed bg-card"><EmptyState icon={Inbox} title={t("action_center.empty.title")} description={t("action_center.empty.description")} action={activeFilterCount ? { label: t("action_center.filters.clear"), onClick: clearFilters } : undefined} /></div>}
                    <PaginationControls currentPage={page} totalPages={listQuery.data?.totalPages || 1} onPageChange={(next) => { updateUrlState({ page: next > 1 ? String(next) : null }); setSelectedIds(new Set()); }} />
                </section>
            )}

            {editing && <ActionItemDialog key={`${editing.item.id}-${editing.initialStatus || "edit"}`} item={editing.item} initialStatus={editing.initialStatus} autoAssignToId={!canManage ? user?.id : undefined} assignees={editableAssignees} allowDismiss={canManage} open onOpenChange={(open) => !open && setEditing(undefined)} pending={updateItem.isPending} onSubmit={async (input) => { await updateItem.mutateAsync({ id: editing.item.id, input }); }} />}
            {snoozing && <SnoozeActionDialog key={snoozing.id} item={snoozing} open onOpenChange={(open) => !open && setSnoozing(undefined)} pending={updateItem.isPending} onSubmit={async (until) => { await updateItem.mutateAsync({ id: snoozing.id, input: { snoozedUntil: until, assigneeId: !canManage && !snoozing.assignee ? user?.id : undefined } }); }} />}
            {convertingItem && <ConvertActionDialog key={convertingItem.id} item={convertingItem} projects={projects} open onOpenChange={(open) => !open && setConvertingItem(undefined)} pending={convert.isPending} onSubmit={async (input) => { await convert.mutateAsync({ id: convertingItem.id, input }); }} />}
        </div>
    );
}

function SummaryMetric({ mode, active, label, value, icon, tone, onClick }: { mode: ActionCenterMode; active: boolean; label: string; value?: number; icon: typeof Inbox; tone: "neutral" | "primary" | "warning" | "danger"; onClick: () => void }) {
    return <button type="button" onClick={onClick} aria-pressed={active} className={cn("rounded-[var(--radius-card)] text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "ring-2 ring-primary/30")} data-mode={mode}>
        <PageMetric label={label} value={value ?? "—"} icon={icon} tone={tone} className="h-full" />
    </button>;
}

function ActionCenterSkeleton() {
    return <div className="space-y-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="rounded-xl border bg-card p-4"><div className="flex gap-3"><Skeleton className="mt-1 h-4 w-4" /><div className="flex-1 space-y-3"><div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div><Skeleton className="h-5 w-3/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/5" /></div></div></div>)}</div>;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
    return [...new Map(items.map((item) => [item.id, item])).values()];
}

function safeInternalPath(value?: string) {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.origin !== window.location.origin) return undefined;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return undefined;
    }
}

function enumParam<T extends string>(value: string | null, allowed: readonly string[], fallback: T): T {
    return value && allowed.includes(value) ? value as T : fallback;
}

function positiveInteger(value: string | null) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}
