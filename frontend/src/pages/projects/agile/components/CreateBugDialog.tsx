import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bugService, type CreateBugInput } from "@/services/bug.service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileAttachment } from "@/components/FileAttachment";
import type { UploadedFile } from "@/components/FileAttachment";
import { getImageUrl } from "@/services/upload.service";
import { useQuery } from "@tanstack/react-query";
import { requirementService } from "@/services/requirement.service";
import { useAuthStore } from "@/store/authStore";
import { readAutoDraft, useAutoDraft } from "@/hooks/useAutoDraft";
import { AutoDraftStatus } from "@/components/forms/AutoDraftStatus";
import { DynamicWorkFields } from "@/components/forms/DynamicWorkFields";
import { useNavigate } from "react-router-dom";
import { appRoutes } from "@/lib/routes";
import type { Story } from "@/types/agile";


interface CreateBugDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    onCreated?: (bug: Story) => void;
    initialData?: {
        title?: string;
        description?: string;
        stepsToReproduce?: string;
        severity?: string;
        testResultId?: string;
        confidence?: number;
        reasoning?: string;
    };
}

type BugSeverity = NonNullable<CreateBugInput["severity"]>;

interface BugDraft {
    title: string;
    description: string;
    steps: string;
    severity: BugSeverity;
    rootCause?: string;
    attachments: UploadedFile[];
    requirementId: string;
    workTypeId: string;
    customFields: Record<string, unknown>;
}

function createBugDraft(initialData?: CreateBugDialogProps["initialData"]): BugDraft {
    return {
        title: initialData?.title || "",
        description: initialData?.description || "",
        steps: initialData?.stepsToReproduce || "",
        severity: (initialData?.severity as BugSeverity | undefined) || "MEDIUM",
        rootCause: "none",
        attachments: [],
        requirementId: "",
        workTypeId: "",
        customFields: {},
    };
}

export function CreateBugDialog({ open, onOpenChange, projectId, initialData, onCreated }: CreateBugDialogProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const userId = useAuthStore((state) => state.user?.id || "anonymous");
    const draftKey = `nexa-draft:${userId}:bug:${projectId}`;
    const [draft, setDraft] = useState<BugDraft | null>(() => readAutoDraft<BugDraft>(draftKey)?.data ?? null);
    const [customFieldsValid, setCustomFieldsValid] = useState(true);
    const queryClient = useQueryClient();
    const form = useMemo(() => draft ?? createBugDraft(initialData), [draft, initialData]);
    const autoDraft = useAutoDraft({
        key: draftKey,
        value: form,
        enabled: open && Boolean(form.title.trim() || form.description.trim() || form.steps.trim() || form.attachments.length),
    });
    const { data: requirements = [], isLoading: requirementsLoading } = useQuery({
        queryKey: ["requirements", projectId],
        queryFn: () => requirementService.getByProject(projectId),
        enabled: open,
        staleTime: 60 * 1000,
    });
    const effectiveRequirementId = requirements.some((requirement) => requirement.id === form.requirementId)
        ? form.requirementId
        : requirements.length === 1 ? requirements[0].id : "";

    const updateDraft = (updates: Partial<BugDraft>) => {
        setDraft((current) => ({
            ...(current ?? createBugDraft(initialData)),
            ...updates,
        }));
    };

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
    };

    const mutation = useMutation({
        mutationFn: () => {
            // Append attachment URLs to description if any
                let fullDescription = form.description;
                if (form.attachments.length > 0) {
                    const attachmentSection = form.attachments.map(a =>
                    `![${a.filename}](${getImageUrl(a.url)})`
                ).join('\n');
                    fullDescription += `\n\n**Ekler:**\n${attachmentSection}`;
                }
            return bugService.create({
                title: form.title,
                description: fullDescription,
                stepsToReproduce: form.steps,
                severity: form.severity,
                rootCause: form.rootCause === "none" ? undefined : form.rootCause,
                projectId,
                requirementId: effectiveRequirementId || undefined,
                testResultId: initialData?.testResultId,
                workTypeId: form.workTypeId || undefined,
                customFields: form.customFields,
            });
        },
        onSuccess: (bug) => {
            const bugKey = bug.key || bug.id;
            toast.success(t("create_bug_dialog.toast.created"), {
                description: bug.key ? `${bug.key} · ${bug.title}` : bug.title,
                action: bugKey ? {
                    label: t("create_bug_dialog.view_bug"),
                    onClick: () => navigate(appRoutes.resource(bugKey)),
                } : undefined,
            });
            queryClient.invalidateQueries({ queryKey: ["bugs", projectId] });
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
            queryClient.invalidateQueries({ queryKey: ["agile-board"] });
            autoDraft.clear();
            setDraft(null);
            handleOpenChange(false);
            onCreated?.(bug);
        },
        onError: () => {
            toast.error(t("create_bug_dialog.toast.create_error"));
        }
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                data-testid="create-bug-dialog"
                className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl p-0"
            >
                <DialogHeader className="border-b px-6 py-5 pr-14">
                    <DialogTitle>{t("create_bug_dialog.title")}</DialogTitle>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {initialData?.confidence && (
                        <div className="mx-6 mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            <div className="flex items-center gap-2 font-semibold">
                                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                                    {t("create_bug_dialog.ai_confidence", { confidence: initialData.confidence })}
                                </span>
                                {t("create_bug_dialog.ai_analysis")}
                            </div>
                            <p className="mt-1 opacity-90">{initialData.reasoning}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 p-6 pt-5 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="title">{t("create_bug_dialog.fields.title.label")}</Label>
                            <Input
                                id="title"
                                value={form.title}
                                onChange={(e) => updateDraft({ title: e.target.value })}
                                placeholder={t("create_bug_dialog.fields.title.placeholder")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="severity">{t("create_bug_dialog.fields.severity.label")}</Label>
                            <Select value={form.severity} onValueChange={(value) => updateDraft({ severity: value as BugSeverity })}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("create_bug_dialog.fields.severity.placeholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">{t("create_bug_dialog.severity.LOW")}</SelectItem>
                                    <SelectItem value="MEDIUM">{t("create_bug_dialog.severity.MEDIUM")}</SelectItem>
                                    <SelectItem value="HIGH">{t("create_bug_dialog.severity.HIGH")}</SelectItem>
                                    <SelectItem value="CRITICAL">{t("create_bug_dialog.severity.CRITICAL")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rootCause">{t("root_causes.label", "Kök Sebep")}</Label>
                            <Select value={form.rootCause || "none"} onValueChange={(value) => updateDraft({ rootCause: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("root_causes.UNASSIGNED")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t("root_causes.UNASSIGNED")}</SelectItem>
                                    {[
                                        "CODE_DEFECT",
                                        "CONFIGURATION_ERROR",
                                        "ENVIRONMENT_ISSUE",
                                        "DATA_ISSUE",
                                        "REQUIREMENT_GAP",
                                        "THIRD_PARTY_FAILURE",
                                        "OTHER",
                                    ].map((rootCause) => (
                                        <SelectItem key={rootCause} value={rootCause}>
                                            {t(`root_causes.${rootCause}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label id="create-bug-requirement-label">{t("quick_create.bug_requirement", "İlgili gereksinim (isteğe bağlı)")}</Label>
                            <Select value={effectiveRequirementId} onValueChange={(value) => updateDraft({ requirementId: value })} disabled={requirementsLoading || requirements.length === 0}>
                                <SelectTrigger aria-labelledby="create-bug-requirement-label"><SelectValue placeholder={requirementsLoading ? t("common.loading") : t("quick_create.select_requirement_optional", "Gereksinim seçebilirsiniz")} /></SelectTrigger>
                                <SelectContent>{requirements.map((requirement) => <SelectItem key={requirement.id} value={requirement.id}>{requirement.title}</SelectItem>)}</SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{t("quick_create.bug_requirement_hint", "Bug kaydı gereksinim olmadan oluşturulabilir; ilişki daha sonra eklenebilir.")}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">{t("common.description")}</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => updateDraft({ description: e.target.value })}
                                placeholder={t("create_bug_dialog.fields.description.placeholder")}
                                rows={5}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="steps">{t("create_bug_dialog.fields.steps.label")}</Label>
                            <Textarea
                                id="steps"
                                value={form.steps}
                                onChange={(e) => updateDraft({ steps: e.target.value })}
                                placeholder={t("create_bug_dialog.fields.steps.placeholder")}
                                rows={5}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>{t('create_bug_dialog.fields.attachments')}</Label>
                            <FileAttachment
                                files={form.attachments}
                                onUpload={(file) => updateDraft({ attachments: [...form.attachments, file] })}
                                onRemove={(id) => updateDraft({ attachments: form.attachments.filter((file) => file.id !== id) })}
                                maxFiles={5}
                                compact
                            />
                        </div>
                        <div className="md:col-span-2">
                            <DynamicWorkFields projectId={projectId} baseType="BUG" workTypeId={form.workTypeId} values={form.customFields} onWorkTypeChange={(workTypeId) => updateDraft({ workTypeId })} onValuesChange={(customFields) => updateDraft({ customFields })} onValidityChange={setCustomFieldsValid} />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t px-6 py-4">
                    <AutoDraftStatus savedAt={autoDraft.savedAt} isSaving={autoDraft.isSaving} />
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>{t("common.cancel")}</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title.trim() || !form.steps.trim() || !customFieldsValid}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("create_bug_dialog.submit")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
