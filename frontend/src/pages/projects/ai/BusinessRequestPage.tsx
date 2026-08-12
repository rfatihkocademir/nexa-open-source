import { useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { businessRequestService } from "@/services/business-request.service";
import { aiService } from "@/services/ai.service";
import type { BusinessRequest, BusinessRequestEpic, BusinessRequestGuidance } from "@/types/business-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, GitBranchPlus, TestTube2, Rocket, ArrowRight, CheckCircle2, AlertCircle, Activity, RefreshCw, Plus, Save, Loader2, Send, AlertTriangle, Layers, BarChart3 } from "lucide-react";
import { TraceFlow } from "@/components/charts/TraceFlow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { appRoutes } from "@/lib/routes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateReleaseCandidateDialog } from "../components/CreateReleaseCandidateDialog";
import { PageHeader } from "@/components/layout/PageChrome";
import { logger } from "@/utils/logger";

const REQUEST_STATUS_STYLE: Record<BusinessRequest["status"], string> = {
    DRAFT: "border border-border/70 bg-muted/20 text-muted-foreground",
    ANALYZED: "border border-primary/30 bg-primary/10 text-primary",
    APPROVED: "border border-emerald-300/60 bg-emerald-50 text-emerald-700",
    REJECTED: "border border-rose-300/60 bg-rose-50 text-rose-700",
};

const AI_RECOMMENDATION_STYLE: Record<"READY" | "CONDITIONAL" | "NOT_READY", string> = {
    READY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    CONDITIONAL: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    NOT_READY: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

interface RequestEditorState {
    selectedRequestId: string | null;
    title: string;
    content: string;
    answers: Record<number, string>;
}

function createRequestEditorState(request?: BusinessRequest | null): RequestEditorState {
    return {
        selectedRequestId: request?.id ?? null,
        title: request?.title ?? "",
        content: request?.content ?? "",
        answers: {},
    };
}

export default function BusinessRequestPage({ resourceId, projectKey }: { resourceId?: string; projectKey?: string } = {}) {
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = resourceId ?? routeProjectId;
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation();
    const projectHref = (tab: "backlog" | "test-cases" | "runs" | "releases", params?: Record<string, string>) =>
        projectKey ? appRoutes.projectTab(projectKey, tab, params) : `/projects/${projectId}?tab=${tab}${params ? `&${new URLSearchParams(params)}` : ""}`;
    const [editorState, setEditorState] = useState<RequestEditorState | null>(null);
    const [analysisLanguage, setAnalysisLanguage] = useState<"tr" | "en">(i18n.language.startsWith("tr") ? "tr" : "en");
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const { data: requests = [], isLoading } = useQuery<BusinessRequest[]>({
        queryKey: ["business-requests", projectId],
        queryFn: () => businessRequestService.getAll(projectId!),
        enabled: Boolean(projectId),
    });

    const focusedRequestId = searchParams.get("requestId");
    const focusedRequest = focusedRequestId
        ? requests.find((request) => request.id === focusedRequestId) ?? null
        : null;
    const currentEditorState = editorState ?? createRequestEditorState(focusedRequest);
    const { selectedRequestId, title, content, answers } = currentEditorState;

    const updateEditorState = (
        updater: RequestEditorState | ((current: RequestEditorState) => RequestEditorState)
    ) => {
        setEditorState((current) => {
            const baseState = current ?? createRequestEditorState(focusedRequest);
            return typeof updater === "function" ? updater(baseState) : updater;
        });
    };

    const createMutation = useMutation({
        mutationFn: (data: { title: string; content: string }) =>
            businessRequestService.create(projectId!, data),
        onSuccess: (newRequest) => {
            queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] });
            updateEditorState((current) => ({ ...current, selectedRequestId: newRequest.id }));
            toast.success(t("business_request_page.toast.request_created"));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; title: string; content: string }) =>
            businessRequestService.update(projectId!, data.id, { title: data.title, content: data.content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] });
            toast.success(t("business_request_page.toast.request_saved"));
        },
    });

    const analyzeMutation = useMutation({
        mutationFn: (id: string) => businessRequestService.analyze(projectId!, id, analysisLanguage),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] });
            updateEditorState((current) => ({ ...current, answers: {} }));
            toast.success(
                result.queued
                    ? t("business_request_page.toast.analysis_queued")
                    : t("business_request_page.toast.analysis_complete")
            );
        },
        onError: () => toast.error(t("business_request_page.toast.analysis_failed")),
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, epics }: { id: string; epics: BusinessRequestEpic[] }) =>
            businessRequestService.approve(projectId!, id, epics, i18n.language),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] });
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
            toast.success(t("business_request_page.toast.approve_success"));
        },
    });

    const generateTestsMutation = useMutation({
        mutationFn: (storyId: string) => aiService.generateTestsFromStory(storyId, projectId, i18n.language),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] });
            queryClient.invalidateQueries({ queryKey: ["test-suites", projectId, false] });
            toast.success(t("business_request_page.toast.tests_generated_for_story"));
        },
        onError: () => {
            toast.error(t("business_request_page.toast.tests_generation_failed_for_story"));
        },
    });

    const selectedRequest = requests.find((request) => request.id === selectedRequestId);
    const questions = selectedRequest?.aiAnalysis?.questions || selectedRequest?.aiAnalysis?.open_questions_and_assumptions || [];
    const selectedEpics = selectedRequest?.aiAnalysis?.epics || selectedRequest?.aiAnalysis?.epic_structure || [];
    const answeredCount = Object.keys(answers).length;
    const allAnswered = questions.length > 0 && questions.every((_: any, idx: number) => Boolean(answers[idx]?.trim()));
    const requestCount = requests.length;
    const analyzedCount = requests.filter((request) => request.status === "ANALYZED").length;
    const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
    const generatedItems = selectedRequest?.workItems ?? [];
    const generatedEpics = generatedItems.filter((item) => item.itemType === "EPIC");
    const generatedStories = generatedItems.filter((item) => item.itemType === "STORY");
    const coveredGeneratedStories = generatedStories.filter((item) => (item.testCases?.length ?? 0) > 0);
    const approvedGeneratedTests = generatedStories.reduce((sum, item) => (
        sum + (item.testCases?.filter((testCase) => testCase.status === "APPROVED").length ?? 0)
    ), 0);
    const generatedTestCases = generatedStories.reduce((sum, item) => sum + (item.testCases?.length ?? 0), 0);
    const linkedRunMap = generatedStories.reduce((acc, story) => {
        for (const testCase of story.testCases ?? []) {
            for (const runItem of testCase.runItems ?? []) {
                if (!runItem.testRun) {
                    continue;
                }
                acc.set(runItem.testRun.id, runItem.testRun);
            }
        }
        return acc;
    }, new Map<string, { id: string; title: string; status: string; createdAt: string }>());
    const linkedRuns = Array.from(linkedRunMap.values()).sort((left, right) => (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ));
    const linkedReleaseCandidates = selectedRequest?.releaseCandidates ?? [];
    const readyLinkedReleases = linkedReleaseCandidates.filter((candidate) => candidate.status === "READY").length;
    const releasedLinkedReleases = linkedReleaseCandidates.filter((candidate) => candidate.status === "RELEASED").length;
    const averageLinkedReadiness = linkedReleaseCandidates.length > 0
        ? Math.round(linkedReleaseCandidates.reduce((sum, candidate) => sum + (candidate.readinessScore ?? 0), 0) / linkedReleaseCandidates.length)
        : 0;
    const { data: requestAiGuidance } = useQuery<BusinessRequestGuidance | null>({
        queryKey: ["business-request-guidance", projectId, selectedRequest?.id, i18n.language],
        queryFn: () => businessRequestService.getGuidance(projectId!, selectedRequest!.id, i18n.language),
        enabled: Boolean(projectId && selectedRequest?.id),
    });

    const handleSelectRequest = (request: BusinessRequest) => {
        setEditorState(createRequestEditorState(request));
    };

    const handleCreateNew = () => {
        setEditorState(createRequestEditorState());
    };

    const handleSave = () => {
        if (!title.trim() || !content.trim()) return;
        if (selectedRequestId) {
            updateMutation.mutate({ id: selectedRequestId, title, content });
            return;
        }
        createMutation.mutate({ title, content });
    };

    const handleAnswerSubmit = (index: number, answer: string) => {
        if (!answer.trim()) return;
        updateEditorState((current) => ({
            ...current,
            answers: { ...current.answers, [index]: answer },
        }));
        toast.success(t("business_request_page.toast.answer_saved", { index: index + 1 }));
    };

    const handleReAnalyzeWithAnswers = async () => {
        if (!selectedRequestId || !selectedRequest) return;

        const answeredQuestions = questions
            .map((question: any, index: number) => {
                if (!answers[index]) return "";
                return `\n\n**Q: ${question}**\n**A:** ${answers[index]}`;
            })
            .filter(Boolean)
            .join("");

        if (!answeredQuestions.trim()) {
            toast.error(t("business_request_page.toast.answer_one_required"));
            return;
        }

        const enrichedContent = content + answeredQuestions;
        updateEditorState((current) => ({ ...current, content: enrichedContent }));

        try {
            await updateMutation.mutateAsync({ id: selectedRequestId, title, content: enrichedContent });
            analyzeMutation.mutate(selectedRequestId);
        } catch {
            toast.error(t("business_request_page.toast.reanalyze_failed"));
        }
    };

    const handleAnalyze = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error(t("business_request_page.toast.title_and_requirements_required"));
            return;
        }

        try {
            let requestId = selectedRequestId;
            if (!requestId) {
                const createdRequest = await createMutation.mutateAsync({ title, content });
                requestId = createdRequest.id;
            } else {
                await updateMutation.mutateAsync({ id: requestId, title, content });
            }

            if (requestId) {
                analyzeMutation.mutate(requestId);
            }
        } catch (error) {
            logger.error(error);
            toast.error(t("business_request_page.toast.prepare_failed"));
        }
    };

    const handleApprove = () => {
        if (!selectedRequestId || selectedEpics.length === 0) return;
        approveMutation.mutate({ id: selectedRequestId, epics: selectedEpics });
    };


    const renderTabs = (defaultTab: string) => (
<Tabs defaultValue={defaultTab} className="w-full">
                                                <TabsList className="grid w-full grid-cols-4 h-12 bg-muted/20 p-1 mb-8 rounded-xl border border-border/40">
                                                    <TabsTrigger value="intelligence" className="rounded-lg text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                                                        <Activity className="h-3.5 w-3.5" />
                                                        {t("business_request_page.guidance.title")}
                                                    </TabsTrigger>
                                                    <TabsTrigger value="backlog" className="rounded-lg text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                                                        <Layers className="h-3.5 w-3.5" />
                                                        {t("business_request_page.generated_backlog.title")}
                                                    </TabsTrigger>
                                                    <TabsTrigger value="traceability" className="rounded-lg text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                                                        <BarChart3 className="h-3.5 w-3.5" />
                                                        {t("business_request_page.delivery_graph.title")}
                                                    </TabsTrigger>
                                                    <TabsTrigger value="releases" className="rounded-lg text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                                                        <Rocket className="h-3.5 w-3.5" />
                                                        {t("business_request_page.release_hub.title")}
                                                    </TabsTrigger>
                                                </TabsList>

                                                <TabsContent value="intelligence" className="space-y-6 animate-in fade-in duration-300">
                                                    {requestAiGuidance ? (
                                                        <div className="rounded-xl border border-border/40 bg-muted/10 p-5 shadow-sm">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-[13px] font-bold text-foreground/80 uppercase tracking-tight">{t("business_request_page.guidance.title")}</p>
                                                        <p className="mt-1 text-[11px] font-medium text-muted-foreground/60 leading-relaxed">
                                                            {t("business_request_page.guidance.description")}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", AI_RECOMMENDATION_STYLE[requestAiGuidance.recommendation])}>
                                                        {t(`release.common.statuses.${requestAiGuidance.recommendation}`, { defaultValue: requestAiGuidance.recommendation })}
                                                    </Badge>
                                                </div>

                                                <p className="mt-5 text-[13px] font-medium text-foreground/80 leading-relaxed bg-background/50 rounded-lg p-4 border border-border/30 shadow-inner">{requestAiGuidance.summary}</p>
                                                
                                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                                    <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.guidance.confidence")}</p>
                                                        <p className="mt-2 text-2xl font-black text-foreground">{Math.round(requestAiGuidance.confidence * 100)}%</p>
                                                    </div>
                                                    <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.guidance.highlights")}</p>
                                                        <p className="mt-2 text-[12px] font-bold text-foreground/70 line-clamp-2 leading-relaxed">{requestAiGuidance.highlights[0] || t("business_request_page.guidance.no_highlights")}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-6 flex flex-col gap-6">
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.guidance.top_risks")}</p>
                                                        {requestAiGuidance.topRisks.length > 0 ? (
                                                            requestAiGuidance.topRisks.map((risk) => (
                                                                <div key={risk} className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-xs font-bold text-amber-900/80 shadow-sm">
                                                                    <div className="flex items-start gap-3">
                                                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                                        <span className="leading-relaxed">{risk}</span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-xs font-bold text-emerald-800 shadow-sm">
                                                                {t("business_request_page.guidance.no_active_risk")}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.guidance.analysis_highlights")}</p>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            {requestAiGuidance.highlights.map((highlight) => (
                                                                <div key={highlight} className="rounded-lg border border-border/30 bg-background/50 px-4 py-4 text-[12px] font-medium text-foreground/70 shadow-sm leading-relaxed">
                                                                    {highlight}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.guidance.recommended_next_actions")}</p>
                                                        {requestAiGuidance.nextActions.length > 0 ? (
                                                            <div className="grid gap-4 sm:grid-cols-2">
                                                                {requestAiGuidance.nextActions.map((action) => (
                                                                    <div key={`${action.label}-${action.href}`} className="rounded-lg border border-border/30 bg-background p-4 flex flex-col shadow-sm group hover:border-primary/30 transition-all">
                                                                        <p className="text-[13px] font-bold text-foreground/90">{action.label}</p>
                                                                        <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/60 leading-relaxed flex-1">{action.detail}</p>
                                                                        <Link
                                                                            to={action.href}
                                                                            className="mt-4 inline-flex items-center text-[11px] font-bold text-primary uppercase tracking-wider hover:text-primary/80 transition-all"
                                                                        >
                                                                            {t("business_request_page.guidance.open_workspace")} <ArrowRight className="ml-2 h-3 w-3" />
                                                                        </Link>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-lg border border-dashed border-border/50 bg-background/30 px-5 py-8 text-center">
                                                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">{t("business_request_page.guidance.no_follow_up_action")}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                                    ) : null}
                                                </TabsContent>

                                                <TabsContent value="backlog" className="space-y-6 animate-in fade-in duration-300">
                                                    <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-[13px] font-bold text-foreground/80 uppercase tracking-tight">{t("business_request_page.generated_backlog.title")}</p>
                                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground/60 leading-relaxed">
                                                        {t("business_request_page.generated_backlog.description")}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{generatedEpics.length} {t("business_request_page.generated_backlog.epics_badge")}</Badge>
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{generatedStories.length} {t("business_request_page.generated_backlog.stories_badge")}</Badge>
                                                </div>
                                            </div>

                                            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.generated_backlog.story_coverage")}</p>
                                                    <p className="mt-2 text-2xl font-black text-foreground">
                                                        {coveredGeneratedStories.length}/{generatedStories.length || 0}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.generated_backlog.approved_tests")}</p>
                                                    <p className="mt-2 text-2xl font-black text-foreground">{approvedGeneratedTests}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.generated_backlog.gap_stories")}</p>
                                                    <p className="mt-2 text-2xl font-black text-rose-600/80">
                                                        {Math.max(generatedStories.length - coveredGeneratedStories.length, 0)}
                                                    </p>
                                                </div>
                                            </div>

                                            {generatedItems.length > 0 ? (
                                                <div className="mt-6 space-y-3">
                                                    {generatedItems.map((item) => (
                                                        <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/30 bg-background p-4 shadow-sm group hover:border-primary/20 transition-all">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider bg-muted/20 text-muted-foreground/70">{item.itemType}</Badge>
                                                                    <p className="truncate text-[13px] font-bold text-foreground/90">{item.title}</p>
                                                                </div>
                                                                <p className="mt-2 text-[11px] font-medium text-muted-foreground/60">
                                                                    {t("business_request_page.generated_backlog.status_label")} <span className="text-foreground/50">{item.status}</span> {item.priority ? <span className="mx-2 opacity-30">•</span> : ""} {item.priority ? `${t("business_request_page.generated_backlog.priority_label")} ${item.priority}` : ""}
                                                                </p>
                                                                {item.itemType === "STORY" && (
                                                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground/60">
                                                                        {t("business_request_page.generated_backlog.tests_label")} <span className="text-foreground/50">{item.testCases?.length ?? 0}</span>
                                                                        <span className="mx-2 opacity-30">•</span>
                                                                        {t("business_request_page.generated_backlog.approved_label")} <span className="text-emerald-600/70">{item.testCases?.filter((testCase) => testCase.status === "APPROVED").length ?? 0}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {item.itemType === "EPIC" && (
                                                                    <Link
                                                                        to={projectHref("backlog", { epicId: item.id })}
                                                                        className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                    >
                                                                        {t("business_request_page.generated_backlog.open_epic")}
                                                                    </Link>
                                                                )}
                                                                {item.itemType === "STORY" && (
                                                                    <Link
                                                                        to={projectHref("backlog", { issue: item.id })}
                                                                        className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                    >
                                                                        {t("business_request_page.generated_backlog.open_story")}
                                                                    </Link>
                                                                )}
                                                                {item.itemType === "STORY" && (item.testCases?.length ?? 0) > 0 ? (
                                                                    <Link
                                                                        to={projectHref("test-cases")}
                                                                        className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                    >
                                                                        {t("business_request_page.generated_backlog.open_tests")}
                                                                    </Link>
                                                                ) : null}
                                                                {item.itemType === "STORY" && (item.testCases?.length ?? 0) === 0 ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 rounded-lg border-border/50 bg-background px-3 text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all font-bold"
                                                                        onClick={() => generateTestsMutation.mutate(item.id)}
                                                                        disabled={generateTestsMutation.isPending}
                                                                    >
                                                                        {generateTestsMutation.isPending ? (
                                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                                                        )}
                                                                        {t("business_request_page.generated_backlog.generate_tests")}
                                                                    </Button>
                                                                ) : null}
                                                                <Badge className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                                                                    {t("business_request_page.generated_backlog.linked")}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-6 rounded-xl border border-dashed border-border/50 bg-background/30 px-5 py-10 text-center">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">{t("business_request_page.generated_backlog.empty")}</p>
                                                </div>
                                            )}
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="traceability" className="space-y-6 animate-in fade-in duration-300">
                                                    <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-[13px] font-bold text-foreground/80 uppercase tracking-tight">{t("business_request_page.delivery_graph.title")}</p>
                                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground/60 leading-relaxed">
                                                        {t("business_request_page.delivery_graph.description")}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{t("business_request_page.delivery_graph.badge")}</Badge>
                                            </div>

                                            {/* Nexa Trace Visualization */}
                                            <div className="mt-6 rounded-2xl border border-border/20 bg-background/50 p-2 shadow-inner">
                                                <TraceFlow 
                                                    data={{
                                                        request: { title: selectedRequest?.title || '', status: selectedRequest?.status || '' },
                                                        backlog: { 
                                                            epics: generatedEpics.length, 
                                                            stories: generatedStories.length,
                                                            coverage: generatedStories.length > 0 ? Math.round((coveredGeneratedStories.length / generatedStories.length) * 100) : 0
                                                        },
                                                        quality: { tests: generatedTestCases, runs: linkedRuns.length },
                                                        release: { count: linkedReleaseCandidates.length, ready: readyLinkedReleases }
                                                    }}
                                                />
                                            </div>

                                            <div className="mt-8 grid gap-4 xl:grid-cols-4">
                                                <div className="rounded-lg border border-border/30 bg-background p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                                        <Sparkles className="h-3.5 w-3.5 text-primary/50" />
                                                        {t("business_request_page.delivery_graph.request")}
                                                    </div>
                                                    <p className="mt-3 text-[13px] font-bold text-foreground/80 truncate">{selectedRequest?.title}</p>
                                                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.delivery_graph.status_label")} {selectedRequest?.status}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                                        <GitBranchPlus className="h-3.5 w-3.5 text-primary/50" />
                                                        {t("business_request_page.delivery_graph.backlog")}
                                                    </div>
                                                    <p className="mt-3 text-[13px] font-bold text-foreground/80">{t("business_request_page.delivery_graph.backlog_summary", { epics: generatedEpics.length, stories: generatedStories.length })}</p>
                                                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                                        {t("business_request_page.delivery_graph.gaps_label")} <span className="text-rose-600/70">{Math.max(generatedStories.length - coveredGeneratedStories.length, 0)}</span>
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                                        <TestTube2 className="h-3.5 w-3.5 text-primary/50" />
                                                        {t("business_request_page.delivery_graph.quality_evidence")}
                                                    </div>
                                                    <p className="mt-3 text-[13px] font-bold text-foreground/80">{t("business_request_page.delivery_graph.quality_summary", { tests: generatedTestCases, runs: linkedRuns.length })}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                                        <Rocket className="h-3.5 w-3.5 text-primary/50" />
                                                        {t("business_request_page.delivery_graph.release")}
                                                    </div>
                                                    <p className="mt-3 text-[13px] font-bold text-foreground/80">{t("business_request_page.delivery_graph.release_summary", { count: linkedReleaseCandidates.length })}</p>
                                                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                                        {t("business_request_page.delivery_graph.ready_label")} <span className="text-emerald-600/70">{readyLinkedReleases}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm">
                                                    {t("business_request_page.delivery_graph.step_request")}
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                                                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm">
                                                    {t("business_request_page.delivery_graph.step_epics_stories")}
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                                                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm">
                                                    {t("business_request_page.delivery_graph.step_quality_runs")}
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                                                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm transition-all hover:border-primary/40 hover:text-primary cursor-default">
                                                    {t("business_request_page.delivery_graph.step_release_decision")}
                                                </div>
                                            </div>

                                            <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_400px]">
                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.delivery_graph.story_evidence")}</p>
                                                    {generatedStories.length > 0 ? (
                                                        <div className="grid gap-4">
                                                            {generatedStories.map((story) => {
                                                                const storyRunMap = new Map<string, { id: string; title: string; status: string; createdAt: string }>();
                                                                for (const testCase of story.testCases ?? []) {
                                                                    for (const runItem of testCase.runItems ?? []) {
                                                                        if (!runItem.testRun) {
                                                                            continue;
                                                                        }
                                                                        storyRunMap.set(runItem.testRun.id, runItem.testRun);
                                                                    }
                                                                }
                                                                const storyRuns = Array.from(storyRunMap.values());
                                                                const approvedTests = story.testCases?.filter((testCase) => testCase.status === "APPROVED").length ?? 0;

                                                                return (
                                                                    <div key={story.id} className="group rounded-lg border border-border/30 bg-background p-4 shadow-sm transition-all hover:border-primary/20">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-[13px] font-bold text-foreground/90">{story.title}</p>
                                                                                <p className="mt-2 text-[11px] font-medium text-muted-foreground/60">
                                                                                    {t("business_request_page.delivery_graph.story_stats", { tests: story.testCases?.length ?? 0, approved: approvedTests, runs: storyRuns.length })}
                                                                                </p>
                                                                            </div>
                                                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider bg-muted/20 text-muted-foreground/70">{story.status}</Badge>
                                                                        </div>
                                                                        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/20 pt-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                                                            <Link
                                                                                to={projectHref("backlog", { issue: story.id })}
                                                                                className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                            >
                                                                                {t("business_request_page.delivery_graph.open_story")}
                                                                            </Link>
                                                                            {(story.testCases?.length ?? 0) > 0 ? (
                                                                                <Link
                                                                                    to={projectHref("test-cases")}
                                                                                    className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                                >
                                                                                    {t("business_request_page.delivery_graph.open_tests")}
                                                                                </Link>
                                                                            ) : null}
                                                                            {storyRuns.length > 0 ? (
                                                                                <Link
                                                                                    to={projectHref("runs", { aiFocus: "open-runs" })}
                                                                                    className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                                >
                                                                                    {t("business_request_page.delivery_graph.open_runs")}
                                                                                </Link>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-dashed border-border/50 bg-background/30 px-5 py-10 text-center">
                                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">{t("business_request_page.delivery_graph.empty_stories")}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-8">
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.delivery_graph.execution_audit")}</p>
                                                        {linkedRuns.length > 0 ? (
                                                            <div className="grid gap-3">
                                                                {linkedRuns.slice(0, 4).map((run) => (
                                                                    <div key={run.id} className="rounded-lg border border-border/30 bg-background/50 p-4 shadow-sm hover:border-primary/20 transition-all">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-xs font-bold text-foreground/80">{run.title}</p>
                                                                                <p className="mt-1.5 text-[10px] font-medium text-muted-foreground/40 font-mono">{t("business_request_page.delivery_graph.id_prefix", { id: run.id.slice(0, 8) })}</p>
                                                                            </div>
                                                                            <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider">{run.status}</Badge>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-xl border border-dashed border-border/50 bg-background/30 px-5 py-8 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">
                                                                {t("business_request_page.delivery_graph.no_execution_runs")}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 pb-2">{t("business_request_page.delivery_graph.linked_releases")}</p>
                                                        {linkedReleaseCandidates.length > 0 ? (
                                                            <div className="grid gap-3">
                                                                {linkedReleaseCandidates.slice(0, 3).map((candidate) => (
                                                                    <div key={candidate.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm group hover:bg-primary/10 transition-all">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-[13px] font-bold text-primary/80">{candidate.title}</p>
                                                                                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-primary/40">
                                                                                    {candidate.status} {typeof candidate.readinessScore === "number" ? <span className="mx-2 opacity-50">•</span> : ""} {typeof candidate.readinessScore === "number" ? t("business_request_page.delivery_graph.readiness", { score: candidate.readinessScore }) : ""}
                                                                                </p>
                                                                            </div>
                                                                            <Link
                                                                                to={appRoutes.resource(candidate.key)}
                                                                                state={{ from: `${location.pathname}${location.search}` }}
                                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                                                                            >
                                                                                <ArrowRight className="h-4 w-4" />
                                                                            </Link>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-xl border border-dashed border-border/50 bg-background/30 px-5 py-8 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">
                                                                {t("business_request_page.delivery_graph.no_linked_releases")}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="releases" className="space-y-6 animate-in fade-in duration-300">
                                                    <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 shadow-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-[13px] font-bold text-foreground/80 uppercase tracking-tight">{t("business_request_page.release_hub.title")}</p>
                                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground/60 leading-relaxed">
                                                        {t("business_request_page.release_hub.description")}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {projectId && selectedRequest ? (
                                                        <Link
                                                            to={projectHref("releases", { sourceRequestId: selectedRequest.id })}
                                                            className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all font-bold px-3"
                                                        >
                                                            {t("business_request_page.release_hub.open_hub")}
                                                        </Link>
                                                    ) : null}
                                                    {projectId && selectedRequest ? (
                                                        <CreateReleaseCandidateDialog
                                                            projectId={projectId}
                                                            sourceRequestId={selectedRequest.id}
                                                            initialTitle={t("business_request_page.release_hub.initial_title", { title: selectedRequest.title })}
                                                            initialSummary={t("business_request_page.release_hub.initial_summary", { title: selectedRequest.title })}
                                                            onCreated={(candidate) => {
                                                                navigate(appRoutes.resource(candidate.key), {
                                                                    state: { from: `${location.pathname}${location.search}` },
                                                                });
                                                            }}
                                                            trigger={(
                                                                <Button size="sm" variant="outline" className="h-9 rounded-lg border-border/50 bg-background/50 px-4 text-[11px] font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all">
                                                                    <Plus className="mr-2 h-3.5 w-3.5" />
                                                                    {t("business_request_page.release_hub.create_candidate")}
                                                                </Button>
                                                            )}
                                                        />
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.release_hub.linked_candidates")}</p>
                                                    <p className="mt-2 text-2xl font-black text-foreground">{linkedReleaseCandidates.length}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.release_hub.release_states")}</p>
                                                    <p className="mt-2 text-[14px] font-bold text-foreground/80">{t("business_request_page.release_hub.ready_released", { ready: readyLinkedReleases, released: releasedLinkedReleases })}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/30 bg-background px-4 py-4 shadow-sm">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("business_request_page.release_hub.avg_readiness")}</p>
                                                    <p className="mt-2 text-2xl font-black text-emerald-600/80">{averageLinkedReadiness}%</p>
                                                </div>
                                            </div>

                                            {linkedReleaseCandidates.length > 0 ? (
                                                <div className="mt-6 space-y-3">
                                                    {linkedReleaseCandidates.map((candidate) => (
                                                        <div key={candidate.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/30 bg-background p-4 shadow-sm group hover:border-primary/20 transition-all">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="truncate text-[13px] font-bold text-foreground/90">{candidate.title}</p>
                                                                    {candidate.label ? (
                                                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider bg-muted/10 text-muted-foreground/60">{candidate.label}</Badge>
                                                                    ) : null}
                                                                </div>
                                                                <p className="mt-2 text-[11px] font-medium text-muted-foreground/60">
                                                                    {t("business_request_page.release_hub.candidate_status", {
                                                                        status: t(`release.common.statuses.${candidate.status}`, { defaultValue: candidate.status.replace(/_/g, " ") }),
                                                                    })}
                                                                    {typeof candidate.readinessScore === "number" ? <span className="mx-2 opacity-30">•</span> : ""}
                                                                    {typeof candidate.readinessScore === "number" ? t("business_request_page.release_hub.candidate_readiness", { score: candidate.readinessScore }) : ""}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Link
                                                                    to={appRoutes.resource(candidate.key)}
                                                                    state={{ from: `${location.pathname}${location.search}` }}
                                                                    className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                                                                >
                                                                    {t("business_request_page.release_hub.open_release")}
                                                                </Link>
                                                                <Badge className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                                                                    {t("business_request_page.generated_backlog.linked")}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-6 rounded-xl border border-dashed border-border/50 bg-background/30 px-5 py-10 text-center">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-relaxed">{t("business_request_page.release_hub.empty")}</p>
                                                </div>
                                            )}
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
    );

    return (
        <div className="page-shell page-stack h-full min-h-0 overflow-y-auto">
            <PageHeader
                title={t("business_request_page.ai_analyst")}
                description={t("business_request_page.ready_to_analyze_desc")}
                meta={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-1 text-[11px] font-bold text-muted-foreground/80">
                            <span>{t("business_request_page.requests")}: </span>
                            <span className="text-foreground">{requestCount}</span>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary/80">
                            <span>{t("business_request_page.stats.analyzed")}: </span>
                            <span className="text-primary">{analyzedCount}</span>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700">
                            <span>{t("business_request_page.stats.approved")}: </span>
                            <span className="text-emerald-800">{approvedCount}</span>
                        </div>
                    </div>
                }
            />

            <div className={cn("grid gap-4", selectedRequest?.status === "APPROVED" ? "shrink-0 h-[50vh] xl:grid-cols-[300px_minmax(0,1fr)]" : "min-h-0 flex-1 xl:grid-cols-[300px_minmax(0,1fr)_400px]")}>
                <section className="flex min-h-0 flex-col enterprise-card !p-0 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-4">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{t("business_request_page.requests")}</h2>
                        <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" onClick={() => queryClient.invalidateQueries({ queryKey: ["business-requests", projectId] })} aria-label={t("common.refresh", "Yenile")} title={t("common.refresh", "Yenile")}>
                                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" onClick={handleCreateNew} aria-label={t("business_request_page.create_new", "Yeni talep oluştur")} title={t("business_request_page.create_new", "Yeni talep oluştur")}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-1 p-2">
                            {requests.map((request) => (
                                <button
                                    key={request.id}
                                    type="button"
                                    onClick={() => handleSelectRequest(request)}
                                    className={cn(
                                        "w-full rounded-lg border px-4 py-4 text-left transition-all group",
                                        selectedRequestId === request.id
                                            ? "border-primary/40 bg-primary/5 shadow-sm"
                                            : "border-border/40 bg-background hover:border-primary/20 hover:bg-muted/30"
                                    )}
                                >
                                    <div className={cn(
                                        "truncate text-sm font-bold transition-colors",
                                        selectedRequestId === request.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                                    )}>
                                        {request.title || t("business_request_page.untitled")}
                                    </div>
                                    <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/70">
                                        {request.content}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                                        <Badge className={cn("h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider", REQUEST_STATUS_STYLE[request.status])}>
                                            {request.status}
                                        </Badge>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                            {new Date(request.updatedAt).toLocaleDateString(i18n.language)}
                                        </span>
                                    </div>
                                </button>
                            ))}
                            {isLoading && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {t("common.loading")}
                                </div>
                            )}
                             {!isLoading && requests.length === 0 && (
                                <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-5 py-10 text-center">
                                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/20 text-muted-foreground/40">
                                        <Rocket className="h-5 w-5" />
                                    </div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-relaxed">
                                        {t("business_request_page.ready_to_analyze")}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </section>

                <section className="flex min-h-0 flex-col enterprise-card !p-0 overflow-hidden bg-background/50">
                    <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                        <Input
                            value={title}
                            onChange={(event) => updateEditorState((current) => ({ ...current, title: event.target.value }))}
                            placeholder={t("business_request_page.request_title_placeholder")}
                            className="h-auto rounded-none border-0 border-b border-border/40 bg-transparent px-0 py-2 text-2xl font-bold text-foreground placeholder-muted-foreground/30 shadow-none focus-visible:ring-0"
                        />
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex rounded-lg border border-border/50 bg-background/80 p-1 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setAnalysisLanguage("tr")}
                                    className={cn(
                                        "h-7 rounded-lg px-4 text-[10px] font-bold uppercase tracking-wider transition-all",
                                        analysisLanguage === "tr"
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground/70 hover:text-foreground"
                                    )}
                                >
                                    TR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAnalysisLanguage("en")}
                                    className={cn(
                                        "h-7 rounded-lg px-4 text-[10px] font-bold uppercase tracking-wider transition-all",
                                        analysisLanguage === "en"
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground/70 hover:text-foreground"
                                    )}
                                >
                                    EN
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending || createMutation.isPending}
                                    className="h-9 rounded-lg border-border/50 bg-background/50 px-4 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/10 hover:text-emerald-600 transition-all font-bold"
                                >
                                    <Save className="mr-2 h-3.5 w-3.5" />
                                    {t("common.save")}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleAnalyze}
                                    disabled={analyzeMutation.isPending || selectedRequest?.status === "APPROVED"}
                                    className="h-9 px-5 text-xs font-semibold"
                                >
                                    {analyzeMutation.isPending ? (
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    {t("business_request_page.analyze_with_ai")}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 p-0 overflow-hidden">
                        <Textarea
                            value={content}
                            onChange={(event) => updateEditorState((current) => ({ ...current, content: event.target.value }))}
                            placeholder={t("business_request_page.content_placeholder")}
                            className="h-full w-full resize-none rounded-none border-0 bg-transparent p-6 text-[15px] font-medium leading-relaxed text-foreground/80 placeholder:text-muted-foreground/20 focus-visible:ring-0"
                        />
                    </div>
                </section>

                {selectedRequest?.status !== "APPROVED" && (
                <section className="enterprise-card flex min-h-0 flex-col overflow-hidden !p-0">
                    <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-5 py-4">
                        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            <Sparkles className="h-4 w-4 text-primary/80" />
                            {t("business_request_page.ai_analyst")}
                        </h2>
                        {selectedRequest?.aiAnalysis && (
                            <Badge
                                className={cn(
                                    "h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider",
                                    (selectedRequest.aiAnalysis.status === "COMPLETE" || selectedRequest.status === "ANALYZED")
                                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold"
                                        : "border border-amber-500/30 bg-amber-500/10 text-amber-700 font-bold"
                                )}
                            >
                                {selectedRequest.aiAnalysis.status || selectedRequest.status}
                            </Badge>
                        )}
                    </div>

                    {!selectedRequest?.aiAnalysis ? (
                        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
                            <div className="w-full rounded-xl border border-dashed border-border/50 bg-muted/5 p-10 text-center">
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 text-primary/30">
                                    <Sparkles className="h-10 w-10" />
                                </div>
                                <p className="text-base font-bold text-foreground">
                                    {t("business_request_page.ready_to_analyze")}
                                </p>
                                <p className="mt-2 text-sm font-medium text-muted-foreground/60 leading-relaxed px-4">
                                    {t("business_request_page.ready_to_analyze_desc")}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="min-h-0 flex-1">
                            <div className="space-y-4 p-4">
                                {selectedRequest.aiAnalysis.status === "NEEDS_INFO" && (
                                    <>
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
                                            <div className="flex gap-3">
                                                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                                                <div>
                                                    <p className="text-[13px] font-bold text-amber-900/80 uppercase tracking-tight">{t("business_request_page.clarification_needed")}</p>
                                                    <p className="mt-1 text-xs font-medium text-amber-700/70 leading-relaxed">{t("business_request_page.clarification_desc")}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {questions.map((question: any, index: number) => (
                                                <div key={`${question}-${index}`} className={cn(
                                                    "rounded-lg border p-4 transition-all shadow-sm",
                                                    answers[index]
                                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                                        : "border-border/40 bg-background"
                                                )}>
                                                    <p className="mb-3 text-[13px] font-bold text-foreground/80 leading-relaxed">{question}</p>
                                                    {answers[index] ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-800 leading-relaxed">
                                                                {answers[index]}
                                                            </div>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-9 w-9 rounded-lg text-muted-foreground/60 hover:bg-emerald-500/10 hover:text-emerald-600 transition-all"
                                                                onClick={() => {
                                                                    updateEditorState((current) => {
                                                                        const nextAnswers = { ...current.answers };
                                                                        delete nextAnswers[index];
                                                                        return {
                                                                            ...current,
                                                                            answers: nextAnswers,
                                                                        };
                                                                    });
                                                                }}
                                                            >
                                                                <RefreshCw className="h-4 w-4" />
                                                                <span className="sr-only">{t('common.update')}</span>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                ref={(element) => {
                                                                    inputRefs.current[index] = element;
                                                                }}
                                                                placeholder={t("business_request_page.type_answer_placeholder")}
                                                                className="h-10 rounded-lg border-border/50 bg-background/50 text-[13px]"
                                                                onKeyDown={(event) => {
                                                                    if (event.key !== "Enter") return;
                                                                    handleAnswerSubmit(index, event.currentTarget.value);
                                                                    event.currentTarget.value = "";
                                                                }}
                                                            />
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-10 w-10 shrink-0 rounded-lg border-border/50 bg-background hover:bg-primary/5 hover:text-primary transition-all"
                                                                onClick={() => {
                                                                    const input = inputRefs.current[index];
                                                                    if (!input) return;
                                                                    handleAnswerSubmit(index, input.value);
                                                                    input.value = "";
                                                                }}
                                                            >
                                                                <span className="sr-only">{t('common.save')}</span>
                                                                <Send className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            className="h-11 w-full text-xs font-semibold"
                                            onClick={handleReAnalyzeWithAnswers}
                                            disabled={analyzeMutation.isPending || answeredCount === 0}
                                        >
                                            {analyzeMutation.isPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="mr-2 h-4 w-4" />
                                            )}
                                            {allAnswered
                                                ? t("business_request_page.reanalyze_all_answers")
                                                : t("business_request_page.reanalyze_progress", { answered: answeredCount, total: questions.length })}
                                        </Button>
                                    </>
                                )}

                                {selectedRequest.aiAnalysis.status === "COMPLETE" && (
                                    <>
                                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm">
                                            <div className="flex gap-3">
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                                                <div>
                                                    <p className="text-[13px] font-bold text-emerald-900/80 uppercase tracking-tight">{t("business_request_page.analysis_complete")}</p>
                                                    <p className="mt-1 text-xs font-medium text-emerald-700/70 leading-relaxed">{t("business_request_page.analysis_complete_desc")}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {selectedEpics.map((epic: any, epicIndex: number) => (
                                                <div key={`${epic.title}-${epicIndex}`} className="rounded-xl border border-border/40 bg-background p-4 shadow-sm">
                                                    <div className="mb-3 flex items-start justify-between gap-2">
                                                        <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider border-primary/30 bg-primary/10 text-primary">
                                                            {t("business_request_page.epic_badge")}
                                                        </Badge>
                                                        {epic.reasoning && (
                                                            <span className="line-clamp-2 text-[10px] font-medium text-muted-foreground/60 italic leading-snug">{epic.reasoning}</span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-bold text-foreground/90">{epic.title}</h3>
                                                    <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/70 leading-relaxed">{epic.description}</p>
                                                    <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
                                                        {(epic.stories ?? []).map((story: any, storyIndex: number) => (
                                                            <div key={`${story.title}-${storyIndex}`} className="rounded-lg border border-border/30 bg-muted/20 p-3 group transition-all hover:bg-muted/40 hover:border-border/50">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className="text-[12px] font-bold text-foreground/80 group-hover:text-foreground">{story.title}</p>
                                                                    <Badge className="h-5 rounded-lg border border-border/50 bg-background px-1.5 text-[10px] font-bold text-muted-foreground/70">
                                                                        {t("business_request_page.story_points_short", { count: story.points })}
                                                                    </Badge>
                                                                </div>
                                                                <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/60 leading-relaxed">{story.description}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            className="h-11 w-full rounded-lg bg-emerald-600 text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 hover:shadow-xl transition-all"
                                            onClick={handleApprove}
                                            disabled={approveMutation.isPending || (selectedRequest?.status as string) === "APPROVED" || selectedEpics.length === 0}
                                        >
                                            {approveMutation.isPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                            )}
                                            {t("business_request_page.approve_and_create")}
                                        </Button>

                                        <div className="mt-8">
                                            {renderTabs("intelligence")}
                                        </div>
                                    </>
                                )}

                                {selectedRequest.aiAnalysis.status !== "COMPLETE" && selectedRequest.aiAnalysis.status !== "NEEDS_INFO" && (
                                    <div className="space-y-4">
                                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-sm">
                                            <div className="flex gap-3">
                                                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                                                <div>
                                                    <p className="text-[13px] font-bold text-primary/80 uppercase tracking-tight">{t("business_request_page.fallback.title")}</p>
                                                    <p className="mt-1 text-xs font-medium text-muted-foreground/70 leading-relaxed">{t("business_request_page.fallback.description")}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-border/40 bg-background p-6">
                                            <pre className="whitespace-pre-wrap text-xs text-foreground/70 leading-relaxed font-mono">
                                                {JSON.stringify(selectedRequest.aiAnalysis, null, 2)}
                                            </pre>
                                        </div>
                                        <Button
                                            className="h-11 w-full text-xs font-semibold"
                                            onClick={() => analyzeMutation.mutate(selectedRequest.id)}
                                            disabled={analyzeMutation.isPending}
                                        >
                                            <RefreshCw className={cn("mr-2 h-4 w-4", analyzeMutation.isPending && "animate-spin")} />
                                            {t("business_request_page.fallback.retry_button")}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </section>
                )}
            </div>

            {selectedRequest?.aiAnalysis?.status === "COMPLETE" && selectedRequest?.status === "APPROVED" && (
                <section className="enterprise-card mt-4 min-h-0 flex-1 flex-col overflow-hidden bg-background !p-0">
                    <ScrollArea className="h-full">
                        <div className="p-6">
                            <div className="mt-2">
                                {renderTabs("backlog")}
                            </div>
                        </div>
                    </ScrollArea>
                </section>
            )}
        </div>
    );
}
