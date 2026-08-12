import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { FileText, Monitor, Plus, Save, Smartphone, Trash2, Zap, Folder, Layers } from "lucide-react";
import { AppBreadcrumbs } from "@/components/navigation/Breadcrumbs";



import { testCaseService } from "@/services/testCase.service";
import type { CaseStatus, Priority, Step, StepType } from "@/types/testCase";
import { useAuthStore } from "@/store/authStore";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScenarioEditor } from "./components/ScenarioBuilder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagManager } from "./components/TagManager";
import { FileAttachment } from "@/components/FileAttachment";
import { uploadService } from "@/services/upload.service";
import { Textarea } from "@/components/ui/textarea";
import { PageAside, PageAsideItem, PageLoading } from "@/components/layout/PageChrome";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageBackButton } from "@/components/navigation/PageBackButton";
import { appRoutes } from "@/lib/routes";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { ManualToAutomationModal } from "@/components/automation/ManualToAutomationModal";
import { cn } from "@/lib/utils";

interface TestCaseDraft {
    title?: string;
    preconditions?: string;
    priority?: Priority;
    steps?: Step[];
}

function normalizeSteps(steps: Step[] | undefined): Step[] {
    if (!Array.isArray(steps)) return [];
    return steps.map((step, index) => {
        const expected = step.expected ?? step.expectedResult ?? "";
        return {
            id: step.id,
            action: step.action ?? "",
            expected,
            expectedResult: expected,
            type: step.type ?? "MANUAL",
            actionType: step.actionType ?? "",
            locator: step.locator ?? "",
            data: step.data ?? "",
            order: step.order ?? index + 1,
        };
    });
}

const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
    DRAFT: ['DRAFT', 'PENDING', 'APPROVED'],
    PENDING: ['PENDING', 'APPROVED', 'REVISE'],
    REVISE: ['REVISE', 'PENDING'],
    APPROVED: ['APPROVED', 'PENDING', 'REVISE'],
};

export default function TestCaseDetailsPage({ resourceId, resourceProjectId, resourceProjectKey }: { resourceId?: string; resourceProjectId?: string; resourceProjectKey?: string } = {}) {
    const { t } = useTranslation();
    const { projectId: routeProjectId, caseId: routeCaseId } = useParams();
    const projectId = resourceProjectId ?? routeProjectId;
    const caseId = resourceId ?? routeCaseId;
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const checkPermission = useAuthStore((state) => state.checkPermission);

    const [draft, setDraft] = useState<TestCaseDraft | null>(null);
    const [isConverterOpen, setIsConverterOpen] = useState(false);
    const [newStepAction, setNewStepAction] = useState("");
    const [newStepExpected, setNewStepExpected] = useState("");
    const activeTab = searchParams.get("tab") === "automation" ? "automation" : "manual";

    const { data: testCase, isLoading } = useQuery({
        queryKey: ["testCase", caseId],
        queryFn: () => testCaseService.getById(caseId!),
        enabled: Boolean(caseId),
    });

    const { data: attachments = [] } = useQuery({
        queryKey: ["testCase-attachments", caseId],
        queryFn: () => uploadService.getTestCaseAttachments(caseId!),
        enabled: Boolean(caseId),
    });

    const title = draft?.title ?? testCase?.title ?? "";
    const caseKey = testCase?.key ?? "";
    const preconditions = draft?.preconditions ?? testCase?.preconditions ?? "";
    const priority = draft?.priority ?? testCase?.priority ?? "MEDIUM";
    const caseStatus = testCase?.status ?? 'DRAFT';
    const canApprove = Boolean(projectId && checkPermission(projectId, 'test:approve'));

    const steps = useMemo(() => {
        if (draft?.steps) return draft.steps;
        return normalizeSteps(testCase?.steps);
    }, [draft?.steps, testCase?.steps]);
    const stepsRef = useRef<Step[]>(steps);

    useEffect(() => {
        stepsRef.current = steps;
    }, [steps]);

    const updateMutation = useMutation({
        mutationFn: (data: Partial<TestCaseDraft>) => testCaseService.update(caseId!, data),
        onSuccess: () => {
            toast.success(t("test_case_details.updated_success"));
            setDraft(null);
            queryClient.invalidateQueries({ queryKey: ["testCase", caseId] });
        },
        onError: () => toast.error(t("test_case_details.update_failed")),
    });

    const statusMutation = useMutation({
        mutationFn: (status: CaseStatus) => {
            if (status === 'APPROVED') return testCaseService.approve(caseId!);
            if (status === 'REVISE') return testCaseService.requestRevision(caseId!);
            return testCaseService.update(caseId!, { status });
        },
        onSuccess: async () => {
            toast.success(t('test_case_details.status_updated'));
            await queryClient.invalidateQueries({ queryKey: ["testCase", caseId] });
        },
        onError: () => toast.error(t('test_case_details.status_update_failed')),
    });
    useUnsavedChangesWarning(Boolean(draft) && !updateMutation.isPending);

    const deleteAttachmentMutation = useMutation({
        mutationFn: (attachmentId: string) => uploadService.deleteImage(attachmentId),
        onSuccess: () => {
            toast.success(t("common.deleted"));
            queryClient.invalidateQueries({ queryKey: ["testCase-attachments", caseId] });
        },
        onError: () => toast.error(t("common.error")),
    });

    const patchDraft = (partial: Partial<TestCaseDraft>) => {
        setDraft((previous) => ({ ...(previous ?? {}), ...partial }));
    };

    const handleSaveBasicInfo = () => {
        updateMutation.mutate({
            title,
            preconditions,
            priority,
            steps: stepsRef.current,
        });
    };

    const updateStepsDraft = (updatedSteps: Step[]) => {
        // Keep a synchronous reference as well as React state. This matters for
        // controls such as Select whose change and blur callbacks run together.
        stepsRef.current = updatedSteps;
        patchDraft({ steps: updatedSteps });
    };

    const handleAddStep = () => {
        if (!newStepAction.trim()) return;
        const updatedSteps: Step[] = [
            ...steps,
            {
                action: newStepAction,
                expected: newStepExpected,
                type: "MANUAL",
                actionType: "",
                locator: "",
                data: "",
                order: steps.length + 1,
            },
        ];

        updateStepsDraft(updatedSteps);
        setNewStepAction("");
        setNewStepExpected("");
        updateMutation.mutate({ steps: updatedSteps });
    };

    const handleDeleteStep = (index: number) => {
        const updatedSteps = steps.filter((_, stepIndex) => stepIndex !== index);
        updateStepsDraft(updatedSteps);
        updateMutation.mutate({ steps: updatedSteps });
    };

    const handleUpdateStep = (index: number, field: keyof Step, value: string) => {
        const updatedSteps = [...steps];
        updatedSteps[index] = { ...updatedSteps[index], [field]: value };
        if (field === "expected") updatedSteps[index].expectedResult = value;
        if (field === "expectedResult") updatedSteps[index].expected = value;
        updateStepsDraft(updatedSteps);
    };

    const handleStepBlur = () => {
        updateMutation.mutate({ steps: stepsRef.current });
    };

    if (isLoading) {
        return <PageLoading metricCount={0} />
    }

    if (!testCase) {
        return (
            <div className="page-shell">
                <div className="flex h-[45vh] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 text-muted-foreground">
                    {t("common.not_found")}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("page-shell page-stack", activeTab === "automation" && "h-full min-h-0")}>
            <section className={cn("rounded-2xl border border-border/70 bg-card shadow-sm", activeTab === "automation" ? "shrink-0 p-3 sm:p-4" : "p-5 sm:p-6")}>
                <div className="flex flex-wrap items-start gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <PageBackButton
                            fallbackTo={resourceProjectKey ? appRoutes.projectSection(resourceProjectKey, "tests") : `/projects/${projectId}?tab=test-cases`}
                            label={t("common.back")}
                            variant="ghost"
                            className={cn("px-2.5", activeTab === "automation" ? "h-8" : "h-9 px-3")}
                        />
                        <AppBreadcrumbs
                            items={[
                                { label: t("common.projects"), href: "/projects", icon: Folder },
                                { label: t("test_case_details.project"), href: resourceProjectKey ? appRoutes.project(resourceProjectKey) : `/projects/${projectId}` },
                                { label: testCase.suite?.name || t("test_case_details.suite"), icon: Layers },
                                { label: caseKey ? `${caseKey} ${title}` : title, icon: Zap }
                            ]}
                            className="mb-0 self-center"
                            compact={activeTab === "automation"}
                        />

                        <div className="min-w-0 flex-1">
                            {caseKey && (
                                <div className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                                    {caseKey}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                data-testid="test-case-ai-convert-btn"
                                onClick={() => setIsConverterOpen(true)}
                                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md"
                                size="sm"
                            >
                                <Zap className="mr-1.5 h-4 w-4" /> ⚡ 1-Tıkla Otomasyona Aktar (AI)
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {isConverterOpen && (
                <ManualToAutomationModal
                    testCaseId={caseId!}
                    testCaseTitle={title}
                    isOpen={isConverterOpen}
                    onClose={() => setIsConverterOpen(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["testCase", caseId] });
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set("tab", "automation");
                        setSearchParams(nextParams, { replace: true });
                    }}
                />
            )}

            <Tabs
                value={activeTab}
                onValueChange={(value) => {
                    const nextTab = value as "manual" | "automation";
                    const nextParams = new URLSearchParams(searchParams);
                    if (nextTab === "automation") {
                        nextParams.set("tab", "automation");
                    } else {
                        nextParams.delete("tab");
                    }
                    setSearchParams(nextParams, { replace: true });
                }}
                className={cn("w-full", activeTab === "automation" && "flex min-h-0 flex-1 flex-col")}
            >
                <div className={cn("flex items-center justify-between rounded-xl border bg-muted/20", activeTab === "automation" ? "mb-2 shrink-0 p-1.5" : "mb-4 p-2")}>
                    <TabsList className="grid w-[400px] max-w-full grid-cols-2">
                        <TabsTrigger data-testid="test-case-tab-manual" value="manual" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {t('test_case_details.tabs.manual')}
                        </TabsTrigger>
                        <TabsTrigger data-testid="test-case-tab-automation" value="automation" className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            {t('test_case_details.tabs.automation')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="manual" className="mt-0">
                    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/15 px-5 py-4">
                                <h2 className="text-sm font-semibold text-foreground">{t("test_case_details.test_steps")}</h2>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        data-testid="test-case-save-btn"
                                        onClick={handleSaveBasicInfo}
                                        disabled={updateMutation.isPending}
                                        variant="success"
                                        size="sm"
                                        className="h-8 rounded-md"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        {t("test_case_details.save_changes")}
                                    </Button>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                        {steps.length}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" /> {t("test_case_details.step_types.MANUAL")}</span>
                                        <span className="text-muted-foreground/30">|</span>
                                        <span className="inline-flex items-center gap-0.5"><Monitor className="h-3 w-3" /> {t("test_case_details.step_types.WEB")}</span>
                                        <span className="text-muted-foreground/30">|</span>
                                        <span className="inline-flex items-center gap-0.5"><Smartphone className="h-3 w-3" /> {t("test_case_details.step_types.MOBILE")}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y">
                                <div className="grid grid-cols-[26px_96px_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 bg-muted/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    <div>#</div>
                                    <div>{t("test_case_details.type_column")}</div>
                                    <div>{t("test_case_details.action")}</div>
                                    <div>{t("test_case_details.expected_result")}</div>
                                    <div />
                                </div>

                                {steps.map((step, index) => (
                                    <div key={index} className="group bg-background px-4 py-2 transition-colors hover:bg-muted/15">
                                        <div className="grid grid-cols-[26px_96px_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 items-start">
                                            <div className="pt-2 text-center font-mono text-xs text-muted-foreground">{index + 1}</div>
                                            <div className="pt-1">
                                                <Select
                                                    value={step.type || "MANUAL"}
                                                    onValueChange={(value) => {
                                                        handleUpdateStep(index, "type", value as StepType);
                                                        handleStepBlur();
                                                    }}
                                                >
                                                    <SelectTrigger aria-label={`${index + 1}. adım tipi`} className="h-8 rounded-md border-border/70 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="MANUAL" className="text-xs">{t("test_case_details.step_types.MANUAL")}</SelectItem>
                                                        <SelectItem value="WEB" className="text-xs">{t("test_case_details.step_types.WEB")}</SelectItem>
                                                        <SelectItem value="MOBILE" className="text-xs">{t("test_case_details.step_types.MOBILE")}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Textarea
                                                data-testid={`test-case-step-action-${index}`}
                                                aria-label={`${index + 1}. adım aksiyonu`}
                                                value={step.action}
                                                onChange={(event) => handleUpdateStep(index, "action", event.target.value)}
                                                onBlur={handleStepBlur}
                                                placeholder={`${t("test_case_details.action")}...`}
                                                className="min-h-[44px] resize-y border-border/50 bg-transparent text-sm shadow-none focus-visible:ring-0"
                                            />
                                            <Textarea
                                                aria-label={`${index + 1}. adım beklenen sonucu`}
                                                value={step.expected}
                                                onChange={(event) => handleUpdateStep(index, "expected", event.target.value)}
                                                onBlur={handleStepBlur}
                                                placeholder={`${t("test_case_details.expected_result")}...`}
                                                className="min-h-[44px] resize-y border-border/50 bg-transparent text-sm shadow-none focus-visible:ring-0"
                                            />
                                            <Button
                                                data-testid={`test-case-step-delete-${index}`}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                                onClick={() => handleDeleteStep(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">{t('common.delete')}</span>
                                            </Button>
                                        </div>

                                        {(step.type === "WEB" || step.type === "MOBILE") && (
                                            <div className="ml-[122px] mt-2 grid grid-cols-1 gap-2 pb-1 md:grid-cols-3">
                                                <div>
                                                    <Label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{t("test_case_details.action_type_label")}</Label>
                                                    <Input
                                                        aria-label={t("test_case_details.action_type_label")}
                                                        value={step.actionType || ""}
                                                        onChange={(event) => handleUpdateStep(index, "actionType", event.target.value)}
                                                        onBlur={handleStepBlur}
                                                        placeholder={t("test_case_details.action_type_placeholder")}
                                                        className="h-8 rounded-md border-border/70 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{t("test_case_details.locator_label")}</Label>
                                                    <Input
                                                        aria-label={t("test_case_details.locator_label")}
                                                        value={step.locator || ""}
                                                        onChange={(event) => handleUpdateStep(index, "locator", event.target.value)}
                                                        onBlur={handleStepBlur}
                                                        placeholder={t("test_case_details.locator_placeholder")}
                                                        className="h-8 rounded-md border-border/70 font-mono text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{t("test_case_details.data_label")}</Label>
                                                    <Input
                                                        aria-label={t("test_case_details.data_label")}
                                                        value={step.data || ""}
                                                        onChange={(event) => handleUpdateStep(index, "data", event.target.value)}
                                                        onBlur={handleStepBlur}
                                                        placeholder={t("test_case_details.data_placeholder")}
                                                        className="h-8 rounded-md border-border/70 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="grid grid-cols-[26px_96px_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 bg-muted/10 px-4 py-2">
                                    <div className="pt-2 text-center font-mono text-xs text-muted-foreground">+</div>
                                    <div />
                                    <Textarea
                                        data-testid="test-case-new-step-action"
                                        aria-label={t("test_case_details.add_action_placeholder")}
                                        placeholder={t("test_case_details.add_action_placeholder")}
                                        value={newStepAction}
                                        onChange={(event) => setNewStepAction(event.target.value)}
                                        className="min-h-[44px] resize-none border-dashed border-border/70 bg-transparent text-sm shadow-none focus-visible:ring-0"
                                    />
                                    <Textarea
                                        aria-label={t("test_case_details.add_expected_placeholder")}
                                        placeholder={t("test_case_details.add_expected_placeholder")}
                                        value={newStepExpected}
                                        onChange={(event) => setNewStepExpected(event.target.value)}
                                        className="min-h-[44px] resize-none border-dashed border-border/70 bg-transparent text-sm shadow-none focus-visible:ring-0"
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" || event.shiftKey) return;
                                            event.preventDefault();
                                            handleAddStep();
                                        }}
                                    />
                                    <Button
                                        data-testid="test-case-add-step-btn"
                                        size="icon"
                                        variant="ghost"
                                        onClick={handleAddStep}
                                        disabled={!newStepAction.trim()}
                                        className="h-8 w-8 rounded-md"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="sr-only">{t('common.create')}</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <PageAside title={t("test_case_details.properties")}>
                            <PageAsideItem label={t("common.name")}>
                                <Input
                                    data-testid="test-case-name-input"
                                    aria-label={t("common.name")}
                                    value={title}
                                    onChange={(event) => patchDraft({ title: event.target.value })}
                                    className="h-9 rounded-md border-border/70 text-sm"
                                    placeholder={t("test_case_details.title_placeholder")}
                                />
                            </PageAsideItem>

                            <PageAsideItem label={t("test_case_details.priority")}>

                                <Select
                                    value={priority}
                                    onValueChange={(value) => patchDraft({ priority: value as Priority })}
                                >
                                    <SelectTrigger className="h-9 rounded-md border-border/70 text-xs">
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={priority} className="h-5" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">
                                            <StatusBadge status="LOW" className="h-5" />
                                        </SelectItem>
                                        <SelectItem value="MEDIUM">
                                            <StatusBadge status="MEDIUM" className="h-5" />
                                        </SelectItem>
                                        <SelectItem value="HIGH">
                                            <StatusBadge status="HIGH" className="h-5" />
                                        </SelectItem>
                                        <SelectItem value="CRITICAL">
                                            <StatusBadge status="CRITICAL" className="h-5" />
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </PageAsideItem>

                            <PageAsideItem label={t("test_case_details.status")}>
                                <Select
                                    value={caseStatus}
                                    onValueChange={(value) => statusMutation.mutate(value as CaseStatus)}
                                    disabled={statusMutation.isPending}
                                >
                                    <SelectTrigger className="h-9 rounded-md border-border/70 text-xs">
                                        <StatusBadge status={caseStatus} className="h-5" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['DRAFT', 'PENDING', 'REVISE', 'APPROVED'] as CaseStatus[]).map((status) => (
                                            <SelectItem
                                                key={status}
                                                value={status}
                                                disabled={
                                                    status !== caseStatus &&
                                                    (!CASE_STATUS_TRANSITIONS[caseStatus].includes(status) || (status === 'APPROVED' && !canApprove))
                                                }
                                            >
                                                <StatusBadge status={status} className="h-5" />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </PageAsideItem>

                            <PageAsideItem label={t("test_case_details.tags")}>
                                <TagManager
                                    testCaseId={caseId!}
                                    projectId={projectId!}
                                    currentTags={testCase.tags?.map((entry) => entry.tag) ?? []}
                                    onTagsChange={() => queryClient.invalidateQueries({ queryKey: ["testCase", caseId] })}
                                />
                            </PageAsideItem>

                            <PageAsideItem label={t("test_case_details.preconditions")}>
                                <Textarea
                                    data-testid="test-case-preconditions-input"
                                    value={preconditions}
                                    onChange={(event) => patchDraft({ preconditions: event.target.value })}
                                    className="min-h-[130px] resize-none rounded-md border-border/70 text-sm"
                                    placeholder={t("test_case_details.setup_placeholder")}
                                />
                            </PageAsideItem>

                            <PageAsideItem label={t("common.attachments")}>
                                <div className="mt-2">
                                    <FileAttachment
                                        files={attachments}
                                        onUpload={() => queryClient.invalidateQueries({ queryKey: ["testCase-attachments", caseId] })}
                                        onRemove={(id) => deleteAttachmentMutation.mutate(id)}
                                        uploadOptions={{ testCaseId: caseId! }}
                                        maxFiles={10}
                                        compact={true}
                                        allowVideo={true}
                                    />
                                </div>
                            </PageAsideItem>
                        </PageAside>
                    </section>
                </TabsContent>

                <TabsContent value="automation" className="mt-0 flex min-h-0 flex-1">
                    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                        <div className="flex-1 min-h-0">
                            <ScenarioEditor testCaseId={caseId!} projectId={projectId!} manualSteps={steps} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
