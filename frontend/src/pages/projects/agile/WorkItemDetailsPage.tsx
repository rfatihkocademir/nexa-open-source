import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storyService } from "@/services/story.service";
import { projectService } from "@/services/project.service";
import { aiService } from "@/services/ai.service";
import type { Story } from "@/types/agile";
import { useProjectWorkflowStatuses } from "@/hooks/useProjectWorkflowStatuses";
import { Badge } from "@/components/ui/badge";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertCircle,
    ArrowUp,
    ArrowDown,
    Minus,
    Rocket,
    CalendarDays,
    User,
    FileText,
    CheckSquare,
    Bug,
    TestTube,
    Clock,
    Tag,
    Loader2,
    Sparkles,
    Paperclip,
    GitBranchPlus,
    ArrowRight,
    Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useParams } from "react-router-dom";
import { AppBreadcrumbs } from "@/components/navigation/Breadcrumbs";
import { PageBackButton } from "@/components/navigation/PageBackButton";
import { appRoutes } from "@/lib/routes";
import { StoryComments } from './components/StoryComments';
import { StoryGitInfo } from './components/StoryGitInfo';
import { WorkItemHistory } from './components/WorkItemHistory';
import { FileAttachment } from '@/components/FileAttachment';
import { ImagePreview } from '@/components/ImagePreview';
import { uploadService } from '@/services/upload.service';
import { worklogService, WORKLOG_CATEGORIES, type WorklogCategory } from "@/services/worklog.service";
import { formatWorklogDuration, parseWorklogDuration } from "@/lib/worklogDuration";

const priorityConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    CRITICAL: { icon: <AlertCircle className="h-4 w-4" />, color: "text-red-600 bg-red-50 border-red-200" },
    HIGH: { icon: <ArrowUp className="h-4 w-4" />, color: "text-orange-600 bg-orange-50 border-orange-200" },
    MEDIUM: { icon: <Minus className="h-4 w-4" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    LOW: { icon: <ArrowDown className="h-4 w-4" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
};

export default function WorkItemDetailsPage({ resourceKey }: { resourceKey?: string } = {}) {
    const { issueKey } = useParams();
    const storyId = resourceKey ?? issueKey;
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const [isEditingAC, setIsEditingAC] = useState(false);
    const [editableAC, setEditableAC] = useState("");
    const [isLoggingWork, setIsLoggingWork] = useState(false);
    const [worklogDuration, setWorklogDuration] = useState("");
    const [worklogDescription, setWorklogDescription] = useState("");
    const [worklogCategory, setWorklogCategory] = useState<WorklogCategory>('DEVELOPMENT');

    const { data: story, isLoading } = useQuery<Story>({
        queryKey: ["story-detail", storyId],
        queryFn: () => storyService.getById(storyId!),
        enabled: !!storyId,
    });

    const { data: attachments = [], refetch: refetchAttachments } = useQuery({
        queryKey: ["story-attachments", storyId],
        queryFn: () => uploadService.getWorkItemAttachments(storyId!),
        enabled: !!storyId,
    });

    const { data: project } = useQuery({
        queryKey: ["project-members", story?.projectId],
        queryFn: () => projectService.getById(story!.projectId),
        enabled: !!story?.projectId,
    });

    const members = project?.members?.map((m) => m.user) ?? [];
    const workflowStatusOptions = useProjectWorkflowStatuses(story?.projectId, story?.status);

    const updateMutation = useMutation({
        mutationFn: ({ field, value }: { field: keyof Story; value: unknown }) =>
            storyService.update(storyId!, { [field]: value }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
            queryClient.invalidateQueries({ queryKey: ["stories"] });
            queryClient.invalidateQueries({ queryKey: ["board-items"] });
            if (story?.projectId) {
                queryClient.invalidateQueries({ queryKey: ["project-stats", story.projectId] });
            }
            queryClient.invalidateQueries({ queryKey: ["agile-board"] });
            toast.success(t("story_detail_dialog.toast.update_success"));
        },
        onError: () => toast.error(t("story_detail_dialog.toast.update_error")),
    });

    const generateTestsMutation = useMutation({
        mutationFn: () => aiService.generateTestsFromStory(storyId!, story?.projectId, i18n.language),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
            queryClient.invalidateQueries({ queryKey: ["stories"] });
            const generatedCount = data?.testCases?.length;
            if (typeof generatedCount === "number") {
                toast.success(t("story_detail_dialog.toast.tests_generated", { count: generatedCount }));
            } else {
                toast.success(t("story_detail_dialog.toast.tests_generation_started"));
            }
        },
        onError: () => toast.error(t("story_detail_dialog.toast.tests_generate_error")),
    });

    const logWorkMutation = useMutation({
        mutationFn: (data: { durationMinutes: number; description?: string; category: WorklogCategory }) =>
            worklogService.create({
                // The page is opened with an issue key (e.g. NEXA-123),
                // while Worklog.workItemId references the WorkItem UUID.
                workItemId: story!.id,
                projectId: story!.projectId,
                startedAt: new Date().toISOString(),
                ...data
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
            queryClient.invalidateQueries({ queryKey: ["project-stats", story!.projectId] });
            toast.success(t("story_detail_dialog.time_tracking.success"));
            setWorklogDuration("");
            setWorklogDescription("");
            setIsLoggingWork(false);
        },
        onError: () => toast.error(t("story_detail_dialog.time_tracking.error")),
    });

    const deleteWorklogMutation = useMutation({
        mutationFn: (id: string) => worklogService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
            queryClient.invalidateQueries({ queryKey: ["project-stats", story!.projectId] });
            toast.success(t("story_detail_dialog.time_tracking.success"));
        },
        onError: () => toast.error(t("story_detail_dialog.time_tracking.error")),
    });

    const points = story?.storyPoints ?? story?.points;
    const totalLoggedMinutes = story?.worklogs?.reduce((sum, log) => sum + log.durationMinutes, 0) ?? 0;
    type LinkedRun = {
        id: string;
        title: string;
        status: string;
        createdAt: string | Date;
    };
    const linkedRuns = story?.testCases
        ?.flatMap((testCase) => testCase.runItems || [])
        .filter((runItem): runItem is typeof runItem & { testRun: NonNullable<typeof runItem.testRun> } => Boolean(runItem.testRun))
        .reduce<LinkedRun[]>((acc, runItem) => {
            const run = runItem.testRun as LinkedRun;
            if (acc.some((existing) => existing.id === run.id)) {
                return acc;
            }
            acc.push(run);
            return acc;
        }, [])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

    const linkedReleases = story?.sourceRequest?.releaseCandidates || [];

    return (
        <div className="page-shell page-stack">
            <div className="flex flex-col h-full bg-card rounded-xl border border-border/70 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : story ? (
                    <div className="flex flex-col h-full max-h-[85vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b bg-muted/20">
    <div className="flex items-center gap-3 mb-4">
        <PageBackButton fallbackTo={project?.key ? appRoutes.projectSection(project.key, "board") : appRoutes.projects()} />
        {story && project && (
            <AppBreadcrumbs 
                items={[
                    { label: t("common.projects"), href: appRoutes.projects() },
                    { label: project.name, href: appRoutes.project(project.key) },
                    { label: story.key || story.id.substring(0, 8) }
                ]}
            />
        )}
    </div>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="font-mono text-[11px] font-bold shrink-0 tracking-widest bg-muted/50 border-muted-foreground/20 text-muted-foreground">
                                            {story.key ? story.key : `#${story.id.substring(0, 8)}`}
                                        </Badge>
                                        {story.epic && (
                                            <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/10 text-[10px] text-primary">
                                                <Rocket className="h-3 w-3 mr-1" />
                                                {story.epic.title}
                                            </Badge>
                                        )}
                                        {story.sourceRequest && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0 cursor-pointer hover:bg-amber-100 transition-colors"
                                                onClick={() => {
                                                    
                                                    navigate(project?.key
                                                        ? appRoutes.projectSection(project.key, "ai", { requestId: story.sourceRequest?.id })
                                                        : `/projects/${story.projectId}?tab=ai-analyst&requestId=${story.sourceRequest?.id}`);
                                                }}
                                            >
                                                <Sparkles className="h-3 w-3 mr-1" />
                                                AI: {story.sourceRequest.title}
                                            </Badge>
                                        )}
                                    </div>
                                    <h1 className="text-2xl font-bold leading-tight">
                                        {story.title}
                                    </h1>
                                </div>
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="flex">
                                {/* Left: Main Content */}
                                <div className="flex-1 p-6 space-y-6 min-w-0">
                                    {/* Description */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                                            <FileText className="h-4 w-4" />
                                            {t("story_detail_dialog.sections.description")}
                                        </h3>
                                        <div className="text-sm leading-relaxed text-foreground bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                                            {story.description
                                                ? story.description.split('\n').map((line: string, i: number) => {
                                                    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                                                    if (imgMatch) {
                                                        return (
                                                            <ImagePreview
                                                                key={i}
                                                                src={imgMatch[2]}
                                                                alt={imgMatch[1]}
                                                                className="rounded-lg border border-border shadow-sm max-w-full h-auto my-2 block"
                                                            />
                                                        );
                                                    }
                                                    if (line.trim() === '') return <br key={i} />;
                                                    return <span key={i}>{line}{'\n'}</span>;
                                                })
                                                : t("story_detail_dialog.no_description")
                                            }
                                        </div>
                                    </section>

                                    {/* Acceptance Criteria */}
                                    <section>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <CheckSquare className="h-4 w-4" />
                                                {t("story_detail_dialog.sections.acceptance_criteria")}
                                            </h3>
                                            {!isEditingAC ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-xs gap-1.5 text-primary hover:bg-primary/5"
                                                    onClick={() => {
                                                        setEditableAC(story.acceptanceCriteria || "");
                                                        setIsEditingAC(true);
                                                    }}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    {t("common.edit")}
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-7 text-xs text-muted-foreground"
                                                        onClick={() => setIsEditingAC(false)}
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        {t("common.cancel")}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        className="h-7 text-xs bg-primary text-primary-foreground"
                                                        onClick={() => {
                                                            updateMutation.mutate({ field: "acceptanceCriteria", value: editableAC }, {
                                                                onSuccess: () => setIsEditingAC(false)
                                                            });
                                                        }}
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        {updateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                                        {t("common.save")}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {isEditingAC ? (
                                            <Textarea 
                                                value={editableAC}
                                                onChange={(e) => setEditableAC(e.target.value)}
                                                placeholder={t("story_detail_dialog.ac_placeholder")}
                                                className="min-h-[120px] text-sm leading-relaxed resize-none focus-visible:ring-primary/30"
                                            />
                                        ) : (
                                            <div 
                                                className={`text-sm leading-relaxed rounded-lg p-4 whitespace-pre-wrap transition-colors ${
                                                    story.acceptanceCriteria 
                                                        ? "bg-green-50/50 dark:bg-green-950/10 border border-green-200/50 dark:border-green-900/30" 
                                                        : "bg-muted/30 border border-dashed border-border italic text-muted-foreground/60"
                                                }`}
                                            >
                                                {story.acceptanceCriteria || t("story_detail_dialog.no_acceptance_criteria")}
                                            </div>
                                        )}
                                    </section>

                                    {/* Attachments — JIRA style */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                                            <Paperclip className="h-4 w-4" />
                                            {t('story_detail_dialog.sections.attachments')}
                                        </h3>
                                        <FileAttachment
                                            files={attachments}
                                            uploadOptions={{ workItemId: storyId! }}
                                            onUpload={() => {
                                                refetchAttachments();
                                            }}
                                            onRemove={async (key) => {
                                                await uploadService.deleteImage(key);
                                                refetchAttachments();
                                            }}
                                            maxFiles={10}
                                        />
                                    </section>

                                    <Separator />

                                    {/* Linked Items - Vertical Stack */}
                                    <div className="flex flex-col gap-6">
                                        {/* Tasks */}
                                        <section>
                                            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                                                <CheckSquare className="h-3.5 w-3.5" />
                                                {t("story_detail_dialog.sections.tasks", { count: story.tasks?.length ?? story._count?.tasks ?? 0 })}
                                            </h3>
                                            <div className="space-y-1.5">
                                                {story.tasks && story.tasks.length > 0 ? (
                                                    story.tasks.map((task) => (
                                                        <div key={task.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/30 border">
                                                            <CheckSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                                                            <span className="truncate">{task.title}</span>
                                                            <Badge variant="outline" className="ml-auto text-[9px] h-4 shrink-0">{task.status}</Badge>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">{t("story_detail_dialog.no_tasks")}</p>
                                                )}
                                            </div>
                                        </section>

                                        {/* Bugs */}
                                        <section>
                                            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                                                <Bug className="h-3.5 w-3.5" />
                                                {t("story_detail_dialog.sections.bugs", { count: story.bugs?.length ?? story._count?.bugs ?? 0 })}
                                            </h3>
                                            <div className="space-y-1.5">
                                                {story.bugs && story.bugs.length > 0 ? (
                                                    story.bugs.map((bug) => (
                                                        <div key={bug.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20">
                                                            <Bug className="h-3 w-3 text-red-500 shrink-0" />
                                                            <span className="truncate">{bug.title}</span>
                                                            <Badge variant="outline" className="ml-auto text-[9px] h-4 shrink-0 border-red-200 text-red-600">{bug.severity}</Badge>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">{t("story_detail_dialog.no_bugs")}</p>
                                                )}
                                            </div>
                                        </section>

                                        {/* Test Cases */}
                                        <section>
                                            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                                                <TestTube className="h-3.5 w-3.5" />
                                                {t("story_detail_dialog.sections.test_cases", { count: story.testCases?.length ?? story._count?.testCases ?? 0 })}
                                            </h3>
                                            <div className="space-y-1.5">
                                                {story.testCases && story.testCases.length > 0 ? (
                                                    story.testCases.map((tc) => (
                                                        <div
                                                            key={tc.id}
                                                            className="flex items-center gap-2 text-xs p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                                            onClick={() => {
                                                                
                                                                navigate(`/c/${tc.id}`);
                                                            }}
                                                        >
                                                            <TestTube className="h-3 w-3 text-emerald-500 shrink-0" />
                                                            <span className="truncate">{tc.title}</span>
                                                            <Badge variant="outline" className="ml-auto text-[9px] h-4 shrink-0 border-emerald-200 text-emerald-600">{tc.status}</Badge>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">{t("story_detail_dialog.no_test_cases")}</p>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-3 w-full gap-2 text-xs h-8 border-dashed border-primary/30 text-primary hover:bg-primary/5"
                                                onClick={() => generateTestsMutation.mutate()}
                                                disabled={generateTestsMutation.isPending}
                                            >
                                                {generateTestsMutation.isPending ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("story_detail_dialog.generating")}</>
                                                ) : (
                                                    <><Sparkles className="h-3.5 w-3.5" /> {t("story_detail_dialog.generate_tests")}</>
                                                )}
                                            </Button>
                                            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                                                ⚠️ {t("story_detail_dialog.generate_warning", {
                                                    language: i18n.language === "tr" ? t("common.turkish") : t("common.english"),
                                                })}
                                            </p>
                                        </section>

                                        <Tabs defaultValue="details" className="w-full mt-6">
                                            <TabsList className="w-full grid grid-cols-3 mb-6 bg-muted/50 p-1">
                                                <TabsTrigger value="details" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Detaylar</TabsTrigger>
                                                <TabsTrigger value="traceability" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">İzlenebilirlik</TabsTrigger>
                                                <TabsTrigger value="history" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">İletişim & Tarihçe</TabsTrigger>
                                            </TabsList>
                                            
                                            <TabsContent value="details" className="space-y-6 mt-0">
                                                {/* Unified delivery graph */}
                                                <section className="space-y-3">
                                                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                        <GitBranchPlus className="h-4 w-4" />
                                                        {t("story_detail_dialog.sections.delivery_graph")}
                                                    </h3>

                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                                {t("story_detail_dialog.graph.source_request")}
                                                            </div>
                                                            {story.sourceRequest ? (
                                                                <div className="mt-2 space-y-2">
                                                                    <p className="text-sm font-medium text-foreground">{story.sourceRequest.title}</p>
                                                                    <Badge variant="outline" className="text-[10px]">
                                                                        {story.sourceRequest.status}
                                                                    </Badge>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-0 text-xs text-primary"
                                                                        onClick={() => {
                                                                            
                                                                            navigate(project?.key
                                                                                ? appRoutes.projectSection(project.key, "ai", { requestId: story.sourceRequest?.id })
                                                                                : `/projects/${story.projectId}?tab=ai-analyst&requestId=${story.sourceRequest?.id}`);
                                                                        }}
                                                                    >
                                                                        {t("story_detail_dialog.graph.open_request")}
                                                                        <ArrowRight className="ml-1 h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <p className="mt-2 text-xs text-muted-foreground italic">
                                                                    {t("story_detail_dialog.graph.no_request")}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                                {t("story_detail_dialog.graph.execution_runs")}
                                                            </div>
                                                            {linkedRuns.length > 0 ? (
                                                                <div className="mt-2 space-y-2">
                                                                    {linkedRuns.slice(0, 3).map((run) => (
                                                                        <button
                                                                            key={run.id}
                                                                            type="button"
                                                                            className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/80 px-3 py-2 text-left text-xs hover:bg-accent"
                                                                            onClick={() => {
                                                                                
                                                                                navigate(`/runs/${run.id}`);
                                                                            }}
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <p className="truncate font-medium text-foreground">{run.title}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{new Date(run.createdAt).toLocaleDateString(i18n.language)}</p>
                                                                            </div>
                                                                            <Badge variant="outline" className="ml-2 text-[10px]">{run.status}</Badge>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-2 text-xs text-muted-foreground italic">
                                                                    {t("story_detail_dialog.graph.no_runs")}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                                {t("story_detail_dialog.graph.release_candidates")}
                                                            </div>
                                                            {linkedReleases.length > 0 ? (
                                                                <div className="mt-2 space-y-2">
                                                                    {linkedReleases.slice(0, 3).map((release) => (
                                                                        <button
                                                                            key={release.id}
                                                                            type="button"
                                                                            className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/80 px-3 py-2 text-left text-xs hover:bg-accent"
                                                                            onClick={() => {
                                                                                
                                                                                navigate(`/projects/${story.projectId}/releases/${release.id}`);
                                                                            }}
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <p className="truncate font-medium text-foreground">{release.title}</p>
                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                    {release.readinessScore != null ? `${release.readinessScore}% readiness` : t("story_detail_dialog.graph.no_readiness")}
                                                                                </p>
                                                                            </div>
                                                                            <Badge variant="outline" className="ml-2 text-[10px]">{release.status}</Badge>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-2 text-xs text-muted-foreground italic">
                                                                    {t("story_detail_dialog.graph.no_releases")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {story.sourceRequest || linkedRuns.length > 0 || linkedReleases.length > 0 ? (
                                                        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                                                            {t("story_detail_dialog.graph.summary", {
                                                                tests: story.testCases?.length ?? 0,
                                                                runs: linkedRuns.length,
                                                                releases: linkedReleases.length,
                                                            })}
                                                        </div>
                                                    ) : null}
                                                </section>
                                            </TabsContent>
                                            
                                            <TabsContent value="traceability" className="space-y-6 mt-0">
                                                {/* Git Activity - Commits & PRs */}
                                                <StoryGitInfo
                                                    gitCommits={story.commits}
                                                    pullRequests={story.pullRequests}
                                                />
                                            </TabsContent>
                                            
                                            <TabsContent value="history" className="space-y-8 mt-0">
                                                {/* Comments */}
                                                <section>
                                                    <StoryComments storyId={story.id} />
                                                </section>

                                                <Separator />

                                                {/* History / Audit Trail */}
                                                <section>
                                                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                                                        <Clock className="h-4 w-4" />
                                                        Tarihçe
                                                    </h3>
                                                    <div className="bg-muted/10 rounded-lg p-2 border border-border/50">
                                                        <WorkItemHistory workItemId={story.id} />
                                                    </div>
                                                </section>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </div>

                                {/* Right: Sidebar Details */}
                                <div className="w-64 border-l bg-muted/10 p-5 space-y-5 shrink-0">
                                    {/* Status */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("common.status")}</label>
                                        <Select
                                            value={story.status}
                                            onValueChange={(value) => updateMutation.mutate({ field: "status", value })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {workflowStatusOptions.map((s) => (
                                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                                        {t(s.labelKey)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("story_detail_dialog.priority")}</label>
                                        <Select
                                            value={story.priority}
                                            onValueChange={(value) => updateMutation.mutate({ field: "priority", value })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(priorityConfig).map(([key, cfg]) => (
                                                    <SelectItem key={key} value={key} className="text-xs">
                                                        <span className="flex items-center gap-2">
                                                            {cfg.icon} {t(`story_detail_dialog.priorities.${key}`)}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Separator />

                                    {/* Story Points */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <Tag className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.story_points")}
                                        </label>
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                            {points ?? "–"}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Time Tracking */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.time_tracking.title")}
                                        </label>
                                        {isLoggingWork ? (
                                            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border text-xs">
                                                <div className="space-y-1">
                                                    <label className="font-semibold text-muted-foreground">{t('worklog.category')}</label>
                                                    <Select value={worklogCategory} onValueChange={(value) => setWorklogCategory(value as WorklogCategory)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{WORKLOG_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{t(`worklog.categories.${category}`)}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="font-semibold text-muted-foreground">{t("story_detail_dialog.time_tracking.duration")}</label>
                                                    <input
                                                        type="text"
                                                        placeholder={t("story_detail_dialog.time_tracking.duration_placeholder")}
                                                        value={worklogDuration}
                                                        onChange={(e) => setWorklogDuration(e.target.value)}
                                                        className="w-full h-8 px-2 rounded-md border bg-background text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="font-semibold text-muted-foreground">{t("story_detail_dialog.time_tracking.description")}</label>
                                                    <textarea
                                                        placeholder={t("story_detail_dialog.time_tracking.description_placeholder")}
                                                        value={worklogDescription}
                                                        onChange={(e) => setWorklogDescription(e.target.value)}
                                                        className="w-full p-2 rounded-md border bg-background h-16 resize-none text-xs"
                                                    />
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs px-2"
                                                        onClick={() => setIsLoggingWork(false)}
                                                        disabled={logWorkMutation.isPending}
                                                    >
                                                        {t("story_detail_dialog.time_tracking.cancel")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-xs px-2"
                                                        onClick={() => {
                                                            const minutes = parseWorklogDuration(worklogDuration);
                                                            if (minutes === null) {
                                                                toast.error(t("story_detail_dialog.time_tracking.invalid_duration"));
                                                                return;
                                                            }
                                                            logWorkMutation.mutate({
                                                                durationMinutes: minutes,
                                                                description: worklogDescription || undefined,
                                                                category: worklogCategory,
                                                            });
                                                        }}
                                                        disabled={logWorkMutation.isPending}
                                                    >
                                                        {logWorkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("story_detail_dialog.time_tracking.submit")}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-foreground">{formatWorklogDuration(totalLoggedMinutes)}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-[10px] gap-1 px-1.5 hover:bg-primary/5 text-primary"
                                                        onClick={() => setIsLoggingWork(true)}
                                                    >
                                                        <Clock className="h-3 w-3" />
                                                        {t("story_detail_dialog.time_tracking.log_time")}
                                                    </Button>
                                                </div>
                                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full" style={{ width: totalLoggedMinutes > 0 ? '100%' : '0%' }} />
                                                </div>
                                                {story.worklogs && story.worklogs.length > 0 && (
                                                    <div className="space-y-1.5 mt-2 max-h-[120px] overflow-y-auto pr-1">
                                                        {story.worklogs.slice(0, 3).map((log) => (
                                                            <div key={log.id} className="text-[10px] p-1.5 bg-muted/20 rounded border flex flex-col gap-0.5 group relative">
                                                                <div className="flex justify-between font-medium">
                                                                    <span>{log.user.firstName} {log.user.lastName}</span>
                                                                    <span className="text-muted-foreground">{formatWorklogDuration(log.durationMinutes)}</span>
                                                                 </div>
                                                                {log.description && <span className="text-muted-foreground/90 truncate">{log.description}</span>}
                                                                <button
                                                                    type="button"
                                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                                                                    onClick={() => deleteWorklogMutation.mutate(log.id)}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Assignee */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.assignee")}
                                        </label>
                                        <Select
                                            value={story.assigneeId ?? "unassigned"}
                                            onValueChange={(value) =>
                                                updateMutation.mutate({
                                                    field: "assigneeId",
                                                    value: value === "unassigned" ? null : value,
                                                })
                                            }
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder={t("story_detail_dialog.unassigned")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned" className="text-xs">
                                                    <span className="text-muted-foreground italic">{t("story_detail_dialog.unassigned")}</span>
                                                </SelectItem>
                                                {members.map((user) => (
                                                    <SelectItem key={user.id} value={user.id} className="text-xs">
                                                        <span className="flex items-center gap-2">
                                                            <Avatar className="h-5 w-5">
                                                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {user.firstName} {user.lastName}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Reporter */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.reporter")}
                                        </label>
                                        {story.reporter ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                                        {story.reporter.firstName?.[0]}{story.reporter.lastName?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs font-medium">
                                                    {story.reporter.firstName} {story.reporter.lastName}
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">—</p>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Sprint */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.sprint")}
                                        </label>
                                        <p className="text-xs font-medium">
                                            {story.sprint?.name ?? <span className="text-muted-foreground italic">{t("story_detail_dialog.backlog")}</span>}
                                        </p>
                                    </div>

                                    {/* Dates */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.created")}
                                        </label>
                                        <p className="text-xs">{new Date(story.createdAt).toLocaleDateString(i18n.language)}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            {t("story_detail_dialog.updated")}
                                        </label>
                                        <p className="text-xs">{new Date(story.updatedAt).toLocaleDateString(i18n.language)}</p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
