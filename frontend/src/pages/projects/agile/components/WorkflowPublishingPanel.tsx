import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCommitHorizontal, History, Loader2, RotateCcw, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDialog } from "@/components/ui/app-dialog-context";
import { workflowSchemeService } from "@/services/workflow-scheme.service";

export function WorkflowPublishingPanel({ projectId, onPublished }: { projectId: string; onPublished?: () => void | Promise<void> }) {
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const key = ["workflow-scheme", projectId];
    const [changeNote, setChangeNote] = useState("");
    const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => workflowSchemeService.get(projectId) });
    const refresh = () => queryClient.invalidateQueries({ queryKey: key });
    const capture = useMutation({ mutationFn: () => workflowSchemeService.refreshDraft(projectId), onSuccess: async () => { await refresh(); toast.success(t("workflow_versioning.draft_captured")); } });
    const publish = useMutation({ mutationFn: () => workflowSchemeService.publish(projectId, changeNote), onSuccess: async () => {
        await Promise.all([
            refresh(),
            queryClient.invalidateQueries({ queryKey: ["work-item-policies", projectId] }),
            onPublished?.(),
        ]);
        setChangeNote("");
        toast.success(t("workflow_versioning.published"));
    }, onError: () => toast.error(t("workflow_versioning.publish_error")) });
    const restore = useMutation({ mutationFn: (revisionId: string) => workflowSchemeService.restore(projectId, revisionId), onSuccess: async () => { await refresh(); toast.success(t("workflow_versioning.restored")); } });
    if (isLoading || !data) return <Loader2 className="h-5 w-5 animate-spin" />;
    return <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><GitCommitHorizontal className="h-5 w-5 text-primary" /><h3 className="text-sm font-semibold">{t("workflow_versioning.title")}</h3><Badge variant={data.status === "DRAFT" ? "secondary" : "default"}>{data.status}</Badge><Badge variant="outline">v{data.publishedVersion}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{t("workflow_versioning.description")}</p></div><Button variant="outline" size="sm" onClick={async () => {
            if (await confirm({
                description: t("workflow_versioning.reset_confirm"),
                confirmLabel: t("workflow_versioning.capture"),
                destructive: true,
            })) capture.mutate();
        }} disabled={capture.isPending}>{t("workflow_versioning.capture")}</Button></div>
        <div className="flex gap-2"><Input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder={t("workflow_versioning.change_note")} /><Button onClick={() => publish.mutate()} disabled={!changeNote.trim() || publish.isPending}><Upload className="mr-2 h-4 w-4" />{t("workflow_versioning.publish")}</Button></div>
        <div><h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="h-4 w-4" />{t("workflow_versioning.history")}</h4><div className="max-h-48 space-y-2 overflow-y-auto">{data.revisions.length ? data.revisions.map((revision) => <div key={revision.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"><div><span className="font-semibold">v{revision.version}</span><span className="mx-2 text-muted-foreground">·</span>{revision.changeNote || t("workflow_versioning.no_note")}<div className="text-muted-foreground">{revision.publishedBy.firstName} {revision.publishedBy.lastName} · {new Date(revision.createdAt).toLocaleString()}</div></div><Button variant="ghost" size="sm" onClick={() => restore.mutate(revision.id)}><RotateCcw className="mr-1 h-3.5 w-3.5" />{t("workflow_versioning.restore")}</Button></div>) : <p className="text-xs text-muted-foreground">{t("workflow_versioning.no_history")}</p>}</div></div>
    </div>;
}
