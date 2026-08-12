import type { Epic } from "@/types/agile";
import { Droppable } from "@hello-pangea/dnd";
import { Plus, ChevronRight, Rocket, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { epicService } from "@/services/epic.service";
import { toast } from "sonner";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useAppDialog } from "@/components/ui/app-dialog-context";

interface EpicSidebarProps {
    epics: Epic[];
    selectedEpicId: string | null;
    onSelectEpic: (epicId: string | null) => void;
    onCreateEpic: () => void;
    width?: number;
}

export function EpicSidebar({ epics, selectedEpicId, onSelectEpic, onCreateEpic, width = 272 }: EpicSidebarProps) {
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const [isExpanded, setIsExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const deleteEpicMutation = useMutation({
        mutationFn: (id: string) => epicService.delete(id),
        onSuccess: () => {
            toast.success(t("epic_sidebar.toast.deleted", "Epik silindi"));
            queryClient.invalidateQueries({ queryKey: ["epics"] });
        },
        onError: () => {
            toast.error(t("epic_sidebar.toast.delete_error", "Silme işlemi başarısız"));
        }
    });

    const filteredEpics = useMemo(() => {
        if (!searchQuery.trim()) return epics;
        const q = searchQuery.toLowerCase();
        return epics.filter(epic =>
            epic.title.toLowerCase().includes(q) ||
            epic.description?.toLowerCase().includes(q)
        );
    }, [epics, searchQuery]);

    if (!isExpanded) {
        return (
            <div className="w-14 shrink-0 enterprise-card flex flex-col items-center py-4 gap-4 h-full p-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" onClick={() => setIsExpanded(true)} title={t("epic_sidebar.expand")}>
                    <Rocket className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="shrink-0 enterprise-card flex flex-col h-full p-0 overflow-hidden shadow-sm" style={{ width }}>
            <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary shadow-sm ring-1 ring-primary/10">
                        <Rocket className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-enterprise-header text-sm uppercase tracking-[0.14em] font-bold">
                        {t("epic_sidebar.title")}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary transition-colors" onClick={onCreateEpic}>
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">{t('common.create')}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted/80 transition-colors" onClick={() => setIsExpanded(false)}>
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span className="sr-only">{t('common.close')}</span>
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("epic_sidebar.search_placeholder")}
                        className="h-9 pl-9 text-[11px] bg-muted/20 border-border/50 focus-visible:ring-primary/20 transition-all rounded-xl"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {!searchQuery.trim() && (
                        <div
                            className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs font-semibold uppercase tracking-wider",
                                selectedEpicId === null
                                    ? "bg-primary text-primary-foreground ring-1 ring-primary/20"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => onSelectEpic(null)}
                        >
                            <span>{t("epic_sidebar.all_issues")}</span>
                        </div>
                    )}

                    {filteredEpics.map((epic) => (
                        <Droppable key={epic.id} droppableId={`epic:${epic.id}`}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "group flex flex-col p-3 rounded-xl cursor-pointer transition-all border text-sm",
                                        selectedEpicId === epic.id
                                            ? "bg-primary/[0.04] border-primary/30 shadow-[0_0_12px_rgba(var(--primary-rgb),0.06)] ring-1 ring-primary/10"
                                            : "border-transparent hover:bg-muted/60 hover:border-border/50",
                                        snapshot.isDraggingOver ? "ring-2 ring-primary bg-primary/8 border-primary shadow-lg scale-[1.02]" : ""
                                    )}
                                    onClick={() => onSelectEpic(epic.id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            "font-semibold truncate text-[13px] tracking-tight transition-colors",
                                            selectedEpicId === epic.id ? "text-primary" : "text-foreground/90"
                                        )}>
                                            {epic.title}
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="h-3 w-3" />
                                                    <span className="sr-only">{t('common.actions')}</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <PermissionGate permission="project.manage">
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (await confirm({
                                                                description: t('common.confirm_delete'),
                                                                confirmLabel: t('common.delete'),
                                                                destructive: true,
                                                            })) {
                                                                deleteEpicMutation.mutate(epic.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t("common.delete")}
                                                    </DropdownMenuItem>
                                                </PermissionGate>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center justify-between mt-2.5">
                                        <StatusBadge status={epic.priority} showIcon={false} className="h-4 px-1.5 text-[9px] font-bold" />
                                        {epic._count?.stories !== undefined && (
                                            <span className="text-[10px] text-muted-foreground/70 font-bold bg-muted/30 px-1.5 py-0.5 rounded border border-border/50">
                                                {epic._count.stories} {epic._count.stories === 1 ? 'ISSUE' : 'ISSUES'}
                                            </span>
                                        )}
                                    </div>
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    ))}

                    {filteredEpics.length === 0 && searchQuery.trim() && (
                        <div className="text-center text-xs text-muted-foreground py-8 px-4">
                            {t("epic_sidebar.no_match", { query: searchQuery })}
                        </div>
                    )}

                    {epics.length === 0 && !searchQuery.trim() && (
                        <div className="text-center text-xs text-muted-foreground py-8 px-4">
                            {t("epic_sidebar.empty")}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
