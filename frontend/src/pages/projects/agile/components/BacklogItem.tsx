import { Draggable } from "@hello-pangea/dnd";
import { type Story } from "@/types/agile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Sparkles, AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aiService } from "@/services/ai.service";
import { storyService } from "@/services/story.service";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { cn } from "@/lib/utils";
import { useAppDialog } from "@/components/ui/app-dialog-context";
import { Checkbox } from "@/components/ui/checkbox";

const getEpicBadgeStyle = (title: string) => {
    const colors = [
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
        "border-info/20 bg-info/10 text-info",
        "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800"
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

interface BacklogItemProps {
    story: Story;
    index: number;
    onStoryClick?: (storyId: string) => void;
    compact?: boolean;
    selected?: boolean;
    onToggleSelection?: (storyId: string, selected: boolean) => void;
    readOnly?: boolean;
}

export function BacklogItem({ story, index, onStoryClick, compact = false, selected = false, onToggleSelection, readOnly = false }: BacklogItemProps) {
    const { t, i18n } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const points = story.storyPoints ?? story.points;
    const isDeleted = !!(story as Story & { deletedAt?: string | null }).deletedAt;

    const generateTestsMutation = useMutation({
        mutationFn: () => aiService.generateTestsFromStory(story.id, story.projectId, i18n.language),
        onSuccess: (data) => {
            const generatedCount = data?.testCases?.length;
            if (typeof generatedCount === "number") {
                toast.success(t("backlog_item.toast.tests_generated", { count: generatedCount }));
            } else {
                toast.success(t("backlog_item.toast.tests_generation_started"));
            }
        },
        onError: () => {
            toast.error(t("backlog_item.toast.tests_generate_error"));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (hardDelete: boolean) => storyService.delete(story.id, hardDelete),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stories", story.projectId] });
            toast.success(t("backlog_item.toast.story_deleted", "İş öğesi silindi"));
        }
    });

    const restoreMutation = useMutation({
        mutationFn: () => storyService.restore(story.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stories", story.projectId] });
            toast.success(t("backlog_item.toast.story_restored", "İş öğesi geri yüklendi"));
        }
    });


    return (
        <Draggable draggableId={story.id} index={index} isDragDisabled={readOnly}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                        "group flex min-h-[52px] cursor-grab items-center justify-between rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-sm active:cursor-grabbing",
                        compact ? "px-3 py-2" : "px-4 py-2.5",
                        isDeleted && "opacity-60 grayscale-[0.5] border-red-200/50 bg-red-50/10",
                        selected && "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                    )}
                    onClick={() => !isDeleted && onStoryClick?.(story.key || story.id)}
                >
                    <div className={cn("flex min-w-0 flex-1 items-center", compact ? "gap-2" : "gap-4")}>
                        {onToggleSelection && <Checkbox checked={selected} onCheckedChange={(checked) => onToggleSelection(story.id, checked === true)} onClick={(event) => event.stopPropagation()} aria-label={t('backlog_page.select_issue', { title: story.title, defaultValue: `Select ${story.title}` })} className="shrink-0" />}
                        <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={story.priority} showIcon />
                            <span className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded font-mono font-bold tracking-widest text-muted-foreground opacity-70">{story.key ? story.key : `#${story.id.substring(0, 5)}`}</span>
                        </div>
                        {!compact && story.parent && story.parent.itemType === 'EPIC' && (
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-wide uppercase shrink-0 max-w-[120px] truncate",
                                getEpicBadgeStyle(story.parent.title)
                            )}>
                                {story.parent.title}
                            </span>
                        )}
                        <span className={cn(
                            "truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors",
                            isDeleted && "line-through text-muted-foreground"
                        )}>
                            {story.title}
                        </span>
                    </div>

                    <div className={cn("flex shrink-0 items-center", compact ? "ml-2 gap-2" : "ml-4 gap-3")}>
                        {!compact && <StatusBadge status={story.status} showIcon={false} className="hidden sm:inline-flex" />}
                        {(story._count?.testCases === 0) && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs">{t("backlog_item.no_test_case_tooltip")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {points !== undefined && points !== null && (
                            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary text-[10px] font-bold text-secondary-foreground ring-1 ring-border/50">
                                {points}
                            </div>
                        )}
                        {story.assignee && (
                            <div className="flex -space-x-2">
                                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border/50">
                                    <AvatarFallback className="text-[10px] font-bold">
                                        {story.assignee.firstName?.[0]}{story.assignee.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">{t('common.actions')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateTestsMutation.mutate(); }} disabled={generateTestsMutation.isPending || isDeleted}>
                                    {generateTestsMutation.isPending ? <LoadingSpinner size="sm" className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    {t("backlog_item.generate_tests")}
                                </DropdownMenuItem>
                                {isDeleted ? (
                                    <PermissionGate permission="stories:update">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); restoreMutation.mutate(); }} className="text-green-600">
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                            {t("common.restore", "Geri Yükle")}
                                        </DropdownMenuItem>
                                    </PermissionGate>
                                ) : (
                                    <PermissionGate permission="stories:delete">
                                        <DropdownMenuItem onClick={async (e) => {
                                            e.stopPropagation();
                                            if (await confirm({ description: `${t('common.confirm_delete')} Soft silme geri alınabilir; hard delete kalıcıdır.`, confirmLabel: t('common.delete'), destructive: true })) {
                                                deleteMutation.mutate(false);
                                            }
                                        }} className="text-red-600">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Çöpe taşı
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={async (e) => {
                                            e.stopPropagation();
                                            if (await confirm({ description: 'Bu kayıt kalıcı olarak silinecek ve geri alınamayacak.', confirmLabel: 'Kalıcı sil', destructive: true })) deleteMutation.mutate(true);
                                        }} className="text-red-700">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Kalıcı sil
                                        </DropdownMenuItem>
                                    </PermissionGate>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
