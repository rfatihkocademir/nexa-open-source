import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { appRoutes } from "@/lib/routes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storyService } from "@/services/story.service";
import { projectService } from "@/services/project.service";
import type { Story } from "@/types/agile";
import { BugRootCause as BugRootCauseEnum } from "@/types/agile";
import { useProjectWorkflowStatuses } from "@/hooks/useProjectWorkflowStatuses";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    Clock,
    Tag,
    Sparkles,
    Pencil,
    Play,
    Square,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface StoryDetailDialogProps {
    storyId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

import { StoryComments } from './StoryComments';
import { ImagePreview } from '@/components/ImagePreview';
import { worklogService, WORKLOG_CATEGORIES, type WorklogCategory } from "@/services/worklog.service";
import { useTimeTrackerStore } from "@/store/useTimeTrackerStore";
import { formatWorklogDuration, parseWorklogDuration } from "@/lib/worklogDuration";

const priorityConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    CRITICAL: { icon: <AlertCircle className="h-4 w-4" />, color: "text-red-600 bg-red-50 border-red-200" },
    HIGH: { icon: <ArrowUp className="h-4 w-4" />, color: "text-orange-600 bg-orange-50 border-orange-200" },
    MEDIUM: { icon: <Minus className="h-4 w-4" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    LOW: { icon: <ArrowDown className="h-4 w-4" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
};

export function StoryDetailDialog({ storyId, open, onOpenChange, onUpdate }: StoryDetailDialogProps) {
    const queryClient = useQueryClient();
    const { activeTimer, startTimer, stopTimer } = useTimeTrackerStore();
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
        enabled: !!storyId && open,
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
            onUpdate?.();
        },
        onError: () => toast.error(t("story_detail_dialog.toast.update_error")),
    });

        const logWorkMutation = useMutation({
        mutationFn: (data: { durationMinutes: number; description?: string; category: WorklogCategory }) =>
            worklogService.create({
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
            onUpdate?.();
        },
        onError: () => toast.error(t("story_detail_dialog.time_tracking.error")),
    });

    const deleteWorklogMutation = useMutation({
        mutationFn: (id: string) => worklogService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
            queryClient.invalidateQueries({ queryKey: ["project-stats", story!.projectId] });
            toast.success(t("story_detail_dialog.time_tracking.success"));
            onUpdate?.();
        },
        onError: () => toast.error(t("story_detail_dialog.time_tracking.error")),
    });

    const points = story?.storyPoints ?? story?.points;
    const totalLoggedMinutes = story?.worklogs?.reduce((sum, log) => sum + log.durationMinutes, 0) ?? 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="work-item-dialog" className="max-w-7xl max-h-[85vh] p-0 gap-0 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : story ? (
                    <div className="flex flex-col h-full max-h-[85vh]">
                        {/* Header */}
                        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/20">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="font-mono text-[11px] font-bold shrink-0 tracking-widest bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted cursor-pointer transition-colors" onClick={() => { onOpenChange(false); navigate(story.key ? appRoutes.resource(story.key) : `/browse/${story.id}`); }}>
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
                                                    onOpenChange(false);
                                                    navigate(`/projects/${story.projectId}?tab=ai-analyst&requestId=${story.sourceRequest?.id}`);
                                                }}
                                            >
                                                <Sparkles className="h-3 w-3 mr-1" />
                                                AI: {story.sourceRequest.title}
                                            </Badge>
                                        )}
                                    </div>
                                    <DialogTitle className="text-xl font-bold leading-tight">
                                        {story.title}
                                    </DialogTitle>
                                </div>
                                
                                <div className="shrink-0 flex items-center">
                                    {activeTimer?.workItemId === story.id ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => stopTimer()}
                                            className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-white"
                                        >
                                            <Square className="h-4 w-4 fill-current" />
                                            Durdur
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => startTimer(story.id, story.projectId, story.title, story.key || '')}
                                            disabled={!!activeTimer}
                                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                        >
                                            <Play className="h-4 w-4 fill-current" />
                                            {activeTimer ? "Başka İş Takipte" : "Çalışmaya Başla"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </DialogHeader>

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
                                    <Separator />
                                    {/* Comments */}
                                    <StoryComments storyId={story.id} />
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

                                    {/* Bug Root Cause (Only for Bugs) */}
                                    {(story.itemType === 'BUG' || story.itemType === 'DEFECT' || story.type === 'bug') && (
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("root_causes.label", "Kök Sebep")}</label>
                                            <Select
                                                value={story.rootCause || "none"}
                                                onValueChange={(value) => updateMutation.mutate({ field: "rootCause", value: value === "none" ? null : value })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder={t("root_causes.UNASSIGNED")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none" className="text-xs">
                                                        <span className="text-muted-foreground italic">{t("root_causes.UNASSIGNED")}</span>
                                                    </SelectItem>
                                                    {Object.entries(BugRootCauseEnum).map(([key, value]) => (
                                                        <SelectItem key={key} value={value} className="text-xs">
                                                            {t(`root_causes.${value}`)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

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
            </DialogContent>
        </Dialog>
    );
}
