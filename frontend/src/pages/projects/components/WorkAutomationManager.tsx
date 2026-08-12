import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, Beaker, Loader2, Pause, Play, Plus, Trash2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { workAutomationService, type AutomationDryRun, type WorkAutomationExecution, type WorkAutomationRule } from "@/services/work-automation.service";
import { workItemSearchService } from "@/services/work-item-search.service";

const TRIGGERS = ["WORK_ITEM_CREATED", "WORK_ITEM_UPDATED", "STATUS_CHANGED", "MANUAL"];
type ActionDraft = { type: "SET_PRIORITY" | "ADD_COMMENT" | "NOTIFY_ASSIGNEE"; priority: string; body: string; title: string; message: string };
const emptyAction = (): ActionDraft => ({ type: "SET_PRIORITY", priority: "HIGH", body: "", title: "", message: "" });

export function WorkAutomationManager({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const key = ["work-automations", projectId];
    const [open, setOpen] = useState(false);
    const [inspectRule, setInspectRule] = useState<WorkAutomationRule | null>(null);
    const [selectedItemId, setSelectedItemId] = useState("");
    const [dryRun, setDryRun] = useState<AutomationDryRun | null>(null);
    const [executionDetail, setExecutionDetail] = useState<WorkAutomationExecution | null>(null);
    const [form, setForm] = useState({ name: "", trigger: "WORK_ITEM_CREATED", nqlCondition: "", actions: [emptyAction()] });
    const { data: rules = [], isLoading } = useQuery({ queryKey: key, queryFn: () => workAutomationService.list(projectId) });
    const { data: executions = [] } = useQuery({ queryKey: [...key, "executions"], queryFn: () => workAutomationService.executions(projectId) });
    const { data: candidates } = useQuery({ queryKey: ["automation-candidates", projectId], queryFn: () => workItemSearchService.search(projectId, "", 1, 100), enabled: Boolean(inspectRule) });
    const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: key }), queryClient.invalidateQueries({ queryKey: [...key, "executions"] })]);
    const serializeActions = () => form.actions.map((action) => action.type === "SET_PRIORITY"
        ? { type: action.type, priority: action.priority }
        : action.type === "ADD_COMMENT" ? { type: action.type, body: action.body }
            : { type: action.type, title: action.title, message: action.message });
    const create = useMutation({
        mutationFn: () => workAutomationService.create(projectId, { name: form.name, trigger: form.trigger, nqlCondition: form.nqlCondition, actions: serializeActions() }),
        onSuccess: async () => { await refresh(); setOpen(false); setForm({ name: "", trigger: "WORK_ITEM_CREATED", nqlCondition: "", actions: [emptyAction()] }); toast.success(t("work_automation.created")); },
        onError: () => toast.error(t("work_automation.save_error")),
    });
    const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => workAutomationService.update(projectId, id, { status: active ? "PAUSED" : "ACTIVE" }), onSuccess: refresh });
    const preview = useMutation({ mutationFn: () => workAutomationService.dryRun(projectId, inspectRule!.id, selectedItemId), onSuccess: setDryRun, onError: () => toast.error(t("work_automation.dry_run_error")) });
    const run = useMutation({ mutationFn: () => workAutomationService.run(projectId, inspectRule!.id, selectedItemId), onSuccess: async (result) => { setExecutionDetail(result); await refresh(); toast.success(t("work_automation.run_complete")); } });
    const updateAction = (index: number, update: Partial<ActionDraft>) => setForm((current) => ({ ...current, actions: current.actions.map((action, position) => position === index ? { ...action, ...update } : action) }));
    const moveAction = (index: number, direction: -1 | 1) => setForm((current) => {
        const actions = [...current.actions]; const target = index + direction;
        if (target < 0 || target >= actions.length) return current;
        [actions[index], actions[target]] = [actions[target], actions[index]];
        return { ...current, actions };
    });
    const valid = form.name.trim() && form.actions.every((action) => action.type === "SET_PRIORITY" || action.type === "ADD_COMMENT" ? action.type === "SET_PRIORITY" || action.body.trim() : action.title.trim() && action.message.trim());

    return <Card>
        <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />{t("work_automation.title")}</CardTitle><CardDescription>{t("work_automation.description")}</CardDescription></div>
            <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />{t("work_automation.add")}</Button></DialogTrigger><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{t("work_automation.add")}</DialogTitle><DialogDescription>{t("work_automation.dialog_help")}</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-2"><div className="grid gap-2"><Label>{t("work_automation.name")}</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                    <div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>{t("work_automation.trigger")}</Label><Select value={form.trigger} onValueChange={(trigger) => setForm({ ...form, trigger })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TRIGGERS.map((value) => <SelectItem key={value} value={value}>{t(`work_automation.triggers.${value}`)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>{t("work_automation.condition")}</Label><Input className="font-mono text-xs" value={form.nqlCondition} onChange={(event) => setForm({ ...form, nqlCondition: event.target.value })} placeholder="type = BUG AND severity = CRITICAL" /></div></div>
                    <div className="space-y-2"><div className="flex items-center justify-between"><Label>{t("work_automation.actions")}</Label><Button variant="outline" size="sm" onClick={() => setForm({ ...form, actions: [...form.actions, emptyAction()] })} disabled={form.actions.length >= 10}><Plus className="mr-1 h-3.5 w-3.5" />{t("work_automation.add_action")}</Button></div>
                        {form.actions.map((action, index) => <div key={index} className="rounded-xl border bg-muted/20 p-3"><div className="mb-3 flex items-center gap-2"><Badge variant="outline">{index + 1}</Badge><Select value={action.type} onValueChange={(type: ActionDraft["type"]) => updateAction(index, { type })}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SET_PRIORITY">{t("work_automation.set_priority")}</SelectItem><SelectItem value="ADD_COMMENT">{t("work_automation.add_comment")}</SelectItem><SelectItem value="NOTIFY_ASSIGNEE">{t("work_automation.notify_assignee")}</SelectItem></SelectContent></Select><Button size="icon" variant="ghost" aria-label={`${index + 1}. aksiyonu yukarı taşı`} title={`${index + 1}. aksiyonu yukarı taşı`} onClick={() => moveAction(index, -1)} disabled={!index}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`${index + 1}. aksiyonu aşağı taşı`} title={`${index + 1}. aksiyonu aşağı taşı`} onClick={() => moveAction(index, 1)} disabled={index === form.actions.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`${index + 1}. aksiyonu sil`} title={`${index + 1}. aksiyonu sil`} onClick={() => setForm({ ...form, actions: form.actions.filter((_, position) => position !== index) })} disabled={form.actions.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                            {action.type === "SET_PRIORITY" ? <Select value={action.priority} onValueChange={(priority) => updateAction(index, { priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["LOW","MEDIUM","HIGH","CRITICAL"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select> : action.type === "ADD_COMMENT" ? <Textarea value={action.body} onChange={(event) => updateAction(index, { body: event.target.value })} placeholder={t("work_automation.comment_placeholder")} /> : <div className="grid gap-2"><Input value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} placeholder={t("work_automation.notification_title")} /><Textarea value={action.message} onChange={(event) => updateAction(index, { message: event.target.value })} placeholder={t("work_automation.notification_message")} /></div>}</div>)}</div></div>
                <DialogFooter><Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("common.save")}</Button></DialogFooter>
            </DialogContent></Dialog></div></CardHeader>
        <CardContent className="space-y-5">{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="divide-y rounded-lg border">{rules.length ? rules.map((rule) => <div key={rule.id} className="flex items-center justify-between gap-3 p-3"><button className="min-w-0 flex-1 text-left" onClick={() => { setInspectRule(rule); setDryRun(null); setSelectedItemId(""); }}><div className="flex items-center gap-2 font-medium">{rule.name}<Badge variant={rule.status === "ACTIVE" ? "default" : "secondary"}>{rule.status}</Badge><Badge variant="outline">v{rule.version}</Badge></div><p className="truncate font-mono text-xs text-muted-foreground">{rule.nqlCondition || t("work_automation.always")}</p><p className="text-xs text-muted-foreground">{t("work_automation.action_and_execution_count", { actions: rule.actions.length, count: rule.executionCount })}</p></button><Button size="icon" variant="ghost" aria-label={rule.status === "ACTIVE" ? `${rule.name} duraklat` : `${rule.name} etkinleştir`} title={rule.status === "ACTIVE" ? `${rule.name} duraklat` : `${rule.name} etkinleştir`} onClick={() => toggle.mutate({ id: rule.id, active: rule.status === "ACTIVE" })}>{rule.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button></div>) : <p className="p-4 text-sm text-muted-foreground">{t("work_automation.empty")}</p>}</div>}
            {executions.length > 0 && <div><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" />{t("work_automation.history")}</h3><div className="space-y-2">{executions.slice(0, 5).map((execution) => <button key={execution.id} onClick={() => setExecutionDetail(execution)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs hover:bg-muted/40"><span>{new Date(execution.createdAt).toLocaleString()}</span><Badge variant={execution.status === "SUCCEEDED" ? "default" : execution.status === "FAILED" ? "destructive" : "secondary"}>{execution.status}</Badge><span>{execution.durationMs ?? 0} ms</span></button>)}</div></div>}
        </CardContent>
        <Dialog open={Boolean(inspectRule)} onOpenChange={(value) => !value && setInspectRule(null)}><DialogContent><DialogHeader><DialogTitle>{inspectRule?.name}</DialogTitle><DialogDescription>{t("work_automation.dry_run_help")}</DialogDescription></DialogHeader><div className="space-y-4"><Select value={selectedItemId} onValueChange={(value) => { setSelectedItemId(value); setDryRun(null); }}><SelectTrigger><SelectValue placeholder={t("work_automation.select_item")} /></SelectTrigger><SelectContent>{candidates?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.key} · {item.title}</SelectItem>)}</SelectContent></Select>{dryRun && <div className={`rounded-xl border p-4 ${dryRun.matches ? "border-emerald-300 bg-emerald-50/50" : "border-amber-300 bg-amber-50/50"}`}><p className="font-semibold">{dryRun.matches ? t("work_automation.matches") : t("work_automation.does_not_match")}</p><div className="mt-2 space-y-1 text-sm">{dryRun.plannedActions.map((action, index) => <div key={index}>{index + 1}. {String(action.type)}</div>)}</div></div>}</div><DialogFooter><Button variant="outline" onClick={() => preview.mutate()} disabled={!selectedItemId || preview.isPending}><Beaker className="mr-2 h-4 w-4" />{t("work_automation.dry_run")}</Button><Button onClick={() => run.mutate()} disabled={!selectedItemId || !dryRun?.matches || run.isPending}><Play className="mr-2 h-4 w-4" />{t("work_automation.run_now")}</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={Boolean(executionDetail)} onOpenChange={(value) => !value && setExecutionDetail(null)}><DialogContent><DialogHeader><DialogTitle>{t("work_automation.execution_detail")}</DialogTitle><DialogDescription>{executionDetail?.id}</DialogDescription></DialogHeader>{executionDetail && <div className="space-y-3 text-sm"><div className="flex justify-between"><span>{t("common.status")}</span><Badge>{executionDetail.status}</Badge></div><div className="flex justify-between"><span>{t("work_automation.duration")}</span><span>{executionDetail.durationMs ?? 0} ms</span></div>{executionDetail.error && <pre className="whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{executionDetail.error}</pre>}<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{JSON.stringify(executionDetail.actionResults ?? [], null, 2)}</pre></div>}</DialogContent></Dialog>
    </Card>;
}
