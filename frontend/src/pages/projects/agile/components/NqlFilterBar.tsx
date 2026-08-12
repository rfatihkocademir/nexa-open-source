import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Braces, ChevronDown, Loader2, Save, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { savedViewService, type SavedView } from "@/services/saved-view.service";
import { workItemSearchService } from "@/services/work-item-search.service";
import { useAppDialog } from "@/components/ui/app-dialog-context";
import type { Story } from "@/types/agile";
import { useAuthStore } from "@/store/authStore";

type FilterConfig = { nql: string };
type FilterView = SavedView<FilterConfig>;

export function NqlFilterBar({ projectId, query, onQueryChange, onResults, onLoadingChange }: {
    projectId: string;
    query: string;
    onQueryChange: (value: string) => void;
    onResults: (items: Story[] | null) => void;
    onLoadingChange?: (loading: boolean) => void;
}) {
    const { t } = useTranslation();
    const { prompt, confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const role = useAuthStore((state) => state.user?.role);
    const canShare = role === "ADMIN" || role === "TEAM_LEADER";
    const [editor, setEditor] = useState(query);
    const [advancedOpen, setAdvancedOpen] = useState(Boolean(query));
    const [type, setType] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [priority, setPriority] = useState("ALL");
    const [assignee, setAssignee] = useState("ALL");
    const [saveScope, setSaveScope] = useState<"PERSONAL" | "PROJECT">("PERSONAL");
    useEffect(() => {
        const timeout = window.setTimeout(() => { if (editor !== query) onQueryChange(editor.trim()); }, 450);
        return () => window.clearTimeout(timeout);
    }, [editor, onQueryChange, query]);
    const { data, isFetching, error } = useQuery({
        queryKey: ["nql-search", projectId, query],
        queryFn: () => workItemSearchService.search(projectId, query),
        enabled: Boolean(query),
        staleTime: 15_000,
        retry: false,
    });
    useEffect(() => {
        if (!query) onResults(null);
        else if (data) onResults(data.items);
    }, [data, onResults, query]);
    useEffect(() => onLoadingChange?.(isFetching), [isFetching, onLoadingChange]);
    const viewKey = ["saved-views", projectId, "BACKLOG_FILTER"];
    const { data: views = [] } = useQuery({ queryKey: viewKey, queryFn: () => savedViewService.list<FilterConfig>(projectId, "BACKLOG_FILTER") });
    const save = useMutation({
        mutationFn: async () => {
            const name = await prompt({ title: t("nql.save_title"), description: t("nql.save_description"), placeholder: t("nql.save_placeholder"), confirmLabel: t("common.save") });
            if (!name) return null;
            return savedViewService.save({ projectId, name, viewType: "BACKLOG_FILTER", scope: saveScope, config: { nql: query } });
        },
        onSuccess: async (result) => { if (result) { await queryClient.invalidateQueries({ queryKey: viewKey }); toast.success(t("nql.saved")); } },
    });
    const remove = useMutation({
        mutationFn: async (view: FilterView) => {
            if (await confirm({ description: t("nql.delete_confirm", { name: view.name }), destructive: true })) await savedViewService.delete(projectId, view.id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: viewKey }),
    });
    const visualNql = useMemo(() => {
        const parts: string[] = [];
        if (type !== "ALL") parts.push(`type = ${type}`);
        if (status !== "ALL") parts.push(`status = ${status}`);
        if (priority !== "ALL") parts.push(`priority = ${priority}`);
        if (assignee === "ME") parts.push("assignee = currentUser()");
        if (assignee === "EMPTY") parts.push("assignee IS EMPTY");
        return parts.join(" AND ");
    }, [assignee, priority, status, type]);
    const applyVisual = () => { setEditor(visualNql); onQueryChange(visualNql); };
    const clear = () => { setEditor(""); onQueryChange(""); onResults(null); setType("ALL"); setStatus("ALL"); setPriority("ALL"); setAssignee("ALL"); };

    return <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
            <CollapsibleTrigger asChild><Button variant={query ? "secondary" : "outline"} size="sm" className="gap-2"><Braces className="h-4 w-4" />{t("nql.filters")}<ChevronDown className="h-3.5 w-3.5" /></Button></CollapsibleTrigger>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Bookmark className="h-4 w-4" />{t("nql.saved_filters")}<ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-72"><DropdownMenuLabel>{t("nql.saved_filters")}</DropdownMenuLabel><DropdownMenuSeparator />{views.length ? views.map((view) => <DropdownMenuItem key={view.id} className="flex justify-between" onSelect={() => { setEditor(view.config.nql); onQueryChange(view.config.nql); }}><span className="truncate">{view.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`${view.name} filtresini sil`} title={`${view.name} filtresini sil`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); remove.mutate(view); }}><Trash2 className="h-3.5 w-3.5" /></Button></DropdownMenuItem>) : <div className="p-3 text-xs text-muted-foreground">{t("nql.no_saved_filters")}</div>}</DropdownMenuContent></DropdownMenu>
            {query && <>{canShare && <Select value={saveScope} onValueChange={(value: "PERSONAL" | "PROJECT") => setSaveScope(value)}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERSONAL">{t("nql.personal")}</SelectItem><SelectItem value="PROJECT">{t("nql.project")}</SelectItem></SelectContent></Select>}<Button variant="ghost" size="sm" className="gap-2" onClick={() => save.mutate()}><Save className="h-4 w-4" />{t("nql.save")}</Button><Button variant="ghost" size="sm" onClick={clear}><X className="mr-1 h-4 w-4" />{t("common.clear_filters")}</Button><span className="text-xs text-muted-foreground">{isFetching ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : error ? t("nql.invalid_query") : t("nql.result_count", { count: data?.total ?? 0 })}</span></>}
        </div>
        <CollapsibleContent className="rounded-xl border bg-background p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-4">
                <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t("nql.all_types")}</SelectItem>{["EPIC","STORY","TASK","BUG","DEFECT","OPERATIONAL","MEETING","SUPPORT"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t("nql.all_statuses")}</SelectItem>{["DRAFT","TODO","IN_PROGRESS","READY_FOR_TEST","QA","DONE","CLOSED"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
                <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t("nql.all_priorities")}</SelectItem>{["LOW","MEDIUM","HIGH","CRITICAL"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
                <Select value={assignee} onValueChange={setAssignee}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t("nql.any_assignee")}</SelectItem><SelectItem value="ME">{t("nql.assigned_to_me")}</SelectItem><SelectItem value="EMPTY">{t("nql.unassigned")}</SelectItem></SelectContent></Select>
            </div>
            <div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 font-mono text-xs" value={editor} onChange={(event) => setEditor(event.target.value)} placeholder='type = BUG AND priority = CRITICAL ORDER BY updated DESC' /></div><Button onClick={applyVisual} disabled={!visualNql}>{t("nql.apply_visual")}</Button></div>
            <p className="mt-2 text-xs text-muted-foreground">{t("nql.help")}</p>
        </CollapsibleContent>
    </Collapsible>;
}
