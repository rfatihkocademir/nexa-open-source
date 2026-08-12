import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bug, CalendarClock, CheckSquare2, Loader2, Plus, Presentation, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreateActivityTaskDialog } from "@/pages/projects/agile/components/CreateActivityTaskDialog";
import { CreateBugDialog } from "@/pages/projects/agile/components/CreateBugDialog";
import { dashboardService } from "@/services/dashboard.service";
import { storyService } from "@/services/story.service";
import { queryKeys } from "@/lib/queryKeys";
import { QUICK_CREATE_EVENT, type QuickCreateKind } from "@/lib/quick-create-events";
import { requirementService } from "@/services/requirement.service";
import { useAuthStore } from "@/store/authStore";
import { readAutoDraft, useAutoDraft } from "@/hooks/useAutoDraft";
import { AutoDraftStatus } from "@/components/forms/AutoDraftStatus";
import { DynamicWorkFields } from "@/components/forms/DynamicWorkFields";

const EMPTY_PROJECTS: NonNullable<Awaited<ReturnType<typeof dashboardService.getWorkspaceOverview>>>["projects"] = [];

export function QuickCreate({ activeProjectId }: { activeProjectId?: string }) {
    const { t } = useTranslation();
    const userId = useAuthStore((state) => state.user?.id || "anonymous");
    const queryClient = useQueryClient();
    const [kind, setKind] = useState<QuickCreateKind | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [requirementId, setRequirementId] = useState("");
    const [workTypeId, setWorkTypeId] = useState("");
    const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
    const [customFieldsValid, setCustomFieldsValid] = useState(true);

    const { data: overview } = useQuery({
        queryKey: queryKeys.dashboard.overview,
        queryFn: dashboardService.getWorkspaceOverview,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        const handleOpen = (event: Event) => {
            const nextKind = (event as CustomEvent<{ kind?: QuickCreateKind }>).detail?.kind || "TASK";
            setKind(nextKind);
        };
        window.addEventListener(QUICK_CREATE_EVENT, handleOpen);
        return () => window.removeEventListener(QUICK_CREATE_EVENT, handleOpen);
    }, []);

    const projects = overview?.projects ?? EMPTY_PROJECTS;
    const projectId = activeProjectId || selectedProjectId;
    const taskDraftKey = `nexa-draft:${userId}:quick-task:${projectId || "unselected"}`;
    const taskDraftValue = useMemo(() => ({ title, description, priority, requirementId, workTypeId, customFields }), [customFields, description, priority, requirementId, title, workTypeId]);
    const autoDraft = useAutoDraft({
        key: taskDraftKey,
        value: taskDraftValue,
        enabled: kind === "TASK" && Boolean(title.trim() || description.trim()),
    });
    const { data: requirements = [], isLoading: requirementsLoading } = useQuery({
        queryKey: ["requirements", projectId],
        queryFn: () => requirementService.getByProject(projectId),
        enabled: Boolean(projectId && kind === "TASK"),
        staleTime: 60 * 1000,
    });
    const effectiveRequirementId = requirements.some((requirement) => requirement.id === requirementId)
        ? requirementId
        : requirements.length === 1 ? requirements[0].id : "";
    const selectedProject = useMemo(
        () => projects.find((project) => project.id === projectId),
        [projectId, projects]
    );

    const close = () => {
        setKind(null);
        setTitle("");
        setDescription("");
        setPriority("MEDIUM");
        setRequirementId("");
        setWorkTypeId("");
        setCustomFields({});
    };

    const createTask = useMutation({
        mutationFn: () => storyService.create({
            projectId,
            itemType: "TASK",
            status: "TODO",
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            requirementId: effectiveRequirementId,
            workTypeId: workTypeId || undefined,
            customFields,
        }),
        onSuccess: async (story) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["stories", projectId] }),
                queryClient.invalidateQueries({ queryKey: ["board-items", projectId] }),
                queryClient.invalidateQueries({ queryKey: ["agile-board"] }),
            ]);
            toast.success(t("quick_create.task_created", "İş oluşturuldu"), {
                description: story.key ? `${story.key} · ${story.title}` : story.title,
            });
            autoDraft.clear();
            close();
        },
        onError: () => toast.error(t("quick_create.create_error", "Kayıt oluşturulamadı")),
    });

    const choose = (nextKind: QuickCreateKind) => {
        setKind(nextKind);
        if (!activeProjectId && !selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
        if (nextKind === "TASK") {
            const targetProjectId = activeProjectId || selectedProjectId || projects[0]?.id || "unselected";
            const stored = readAutoDraft<typeof taskDraftValue>(`nexa-draft:${userId}:quick-task:${targetProjectId}`);
            if (stored) {
                setTitle(stored.data.title);
                setDescription(stored.data.description);
                setPriority(stored.data.priority);
                setRequirementId(stored.data.requirementId);
                setWorkTypeId(stored.data.workTypeId || "");
                setCustomFields(stored.data.customFields || {});
            }
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" className="density-control gap-1.5 px-2.5" aria-label={t("quick_create.open", "Oluştur")}>
                        <Plus className="h-4 w-4" />
                        <span className="hidden xl:inline">{t("common.create")}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>{t("quick_create.title", "Hızlı oluştur")}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => choose("TASK")}><CheckSquare2 className="mr-2 h-4 w-4" />{t("quick_create.task", "Geliştirme işi")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => choose("BUG")}><Bug className="mr-2 h-4 w-4" />{t("quick_create.bug", "Bug")}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => choose("ACTIVITY")}><CalendarClock className="mr-2 h-4 w-4" />{t("quick_create.activity", "Operasyon / aktivite")}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        {activeProjectId
                            ? t("quick_create.current_project_hint", "Kayıt mevcut projede oluşturulur.")
                            : t("quick_create.project_hint", "Sonraki adımda proje seçebilirsiniz.")}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={kind === "TASK"} onOpenChange={(open) => !open && close()}>
                <DialogContent className="sm:max-w-[580px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" />{t("quick_create.task", "Geliştirme işi")}</DialogTitle>
                        <DialogDescription>{t("quick_create.task_description", "Temel bilgileri girin; ayrıntıları kayıt sayfasından tamamlayabilirsiniz.")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {!activeProjectId && <div className="space-y-1.5"><Label>{t("common.project")}</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger><SelectValue placeholder={t("quick_create.select_project", "Proje seçin")} /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent></Select></div>}
                        {selectedProject && activeProjectId && <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"><span className="font-mono font-semibold">{selectedProject.key}</span><span className="mx-2 text-muted-foreground">·</span>{selectedProject.name}</div>}
                        <div className="space-y-1.5"><Label htmlFor="quick-create-title">{t("common.title")}</Label><Input id="quick-create-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("quick_create.title_placeholder", "Yapılacak işi kısa ve net yazın")} onKeyDown={(event) => { if (event.key === "Enter" && title.trim() && projectId) createTask.mutate(); }} /></div>
                        <div className="space-y-1.5"><Label id="quick-create-priority-label">{t("common.priority", "Öncelik")}</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger aria-labelledby="quick-create-priority-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">{t("common.low", "Düşük")}</SelectItem><SelectItem value="MEDIUM">{t("common.medium", "Orta")}</SelectItem><SelectItem value="HIGH">{t("common.high", "Yüksek")}</SelectItem><SelectItem value="CRITICAL">{t("common.critical", "Kritik")}</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5">
                            <Label id="quick-create-requirement-label">{t("quick_create.requirement", "İlgili gereksinim")}</Label>
                            <Select value={effectiveRequirementId} onValueChange={setRequirementId} disabled={!projectId || requirementsLoading || requirements.length === 0}>
                                <SelectTrigger aria-labelledby="quick-create-requirement-label"><SelectValue placeholder={requirementsLoading ? t("common.loading") : t("quick_create.select_requirement", "Gereksinim seçin")} /></SelectTrigger>
                                <SelectContent>{requirements.map((requirement) => <SelectItem key={requirement.id} value={requirement.id}>{requirement.title}</SelectItem>)}</SelectContent>
                            </Select>
                            {!requirementsLoading && projectId && requirements.length === 0 && <p className="text-xs text-destructive">{t("quick_create.requirement_missing", "Geliştirme işi açmak için projede en az bir gereksinim bulunmalıdır.")}</p>}
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="quick-create-description">{t("common.description")}</Label><Textarea id="quick-create-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></div>
                        {projectId && <DynamicWorkFields projectId={projectId} baseType="TASK" workTypeId={workTypeId} values={customFields} onWorkTypeChange={setWorkTypeId} onValuesChange={setCustomFields} onValidityChange={setCustomFieldsValid} />}
                    </div>
                    <DialogFooter>
                        <AutoDraftStatus savedAt={autoDraft.savedAt} isSaving={autoDraft.isSaving} />
                        <Button variant="outline" onClick={close}>{t("common.cancel")}</Button>
                        <Button disabled={!title.trim() || !projectId || !effectiveRequirementId || !customFieldsValid || createTask.isPending} onClick={() => createTask.mutate()}>
                            {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("common.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {projectId && <CreateBugDialog projectId={projectId} open={kind === "BUG"} onOpenChange={(open) => !open && close()} />}
            {projectId && <CreateActivityTaskDialog projectId={projectId} open={kind === "ACTIVITY"} onOpenChange={(open) => !open && close()} />}

            <Dialog open={Boolean(kind && kind !== "TASK" && !projectId)} onOpenChange={(open) => !open && close()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{t("quick_create.select_project", "Proje seçin")}</DialogTitle><DialogDescription>{t("quick_create.select_project_description", "Kaydın oluşturulacağı projeyi belirleyin.")}</DialogDescription></DialogHeader>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger><SelectValue placeholder={t("quick_create.select_project", "Proje seçin")} /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent></Select>
                    <DialogFooter><Button variant="outline" onClick={close}>{t("common.cancel")}</Button><Button disabled={!selectedProjectId} onClick={() => setSelectedProjectId(selectedProjectId)}><Presentation className="mr-2 h-4 w-4" />{t("common.continue", "Devam et")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
