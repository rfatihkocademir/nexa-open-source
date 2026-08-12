import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { agileService, type SprintCompletionStats } from '@/services/agile.service';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ArrowRight, ArchiveX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface SprintCompletionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stats: SprintCompletionStats | null;
    onComplete: () => void;
}

export function SprintCompletionDialog({
    open, onOpenChange, stats, onComplete
}: SprintCompletionDialogProps) {
    const { t } = useTranslation();
    const [action, setAction] = useState<'MOVE_TO_BACKLOG' | 'MOVE_TO_NEXT_SPRINT'>('MOVE_TO_BACKLOG');
    const [selectedNextSprint, setSelectedNextSprint] = useState<string>('');

    const completeMutation = useMutation({
        mutationFn: () => agileService.completeSprint(
            stats!.sprint.id,
            action,
            action === 'MOVE_TO_NEXT_SPRINT' ? selectedNextSprint : undefined
        ),
        onSuccess: (result) => {
            toast.success(
                result.movedItems > 0
                    ? t('sprint_completion.success_with_moved', { count: result.movedItems })
                    : t('sprint_completion.success')
            );
            onOpenChange(false);
            onComplete();
        },
        onError: () => {
            toast.error(t('sprint_completion.error'));
        }
    });

    if (!stats) return null;

    const hasIncomplete = stats.incompleteItems > 0;
    const canSubmit = action === 'MOVE_TO_BACKLOG' || (action === 'MOVE_TO_NEXT_SPRINT' && selectedNextSprint);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        {t('sprint_completion.title', { name: stats.sprint.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t('sprint_completion.description')}
                    </DialogDescription>
                </DialogHeader>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3 py-2">
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                        <div className="text-2xl font-bold text-foreground">{stats.totalItems}</div>
                        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {t('sprint_completion.total_issues')}
                        </div>
                    </div>
                    <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-center">
                        <div className="text-2xl font-bold text-success">{stats.doneItems}</div>
                        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-success/70">
                            {t('sprint_completion.completed')}
                        </div>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${hasIncomplete ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50 bg-muted/30'}`}>
                        <div className={`text-2xl font-bold ${hasIncomplete ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {stats.incompleteItems}
                        </div>
                        <div className={`mt-0.5 text-[11px] font-medium uppercase tracking-wider ${hasIncomplete ? 'text-amber-500/70' : 'text-muted-foreground'}`}>
                            {t('sprint_completion.incomplete')}
                        </div>
                    </div>
                </div>

                {/* Completion Rate Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>{t('sprint_completion.completion_rate')}</span>
                        <span className="font-bold text-foreground">{stats.completionRate}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-success transition-all duration-500"
                            style={{ width: `${stats.completionRate}%` }}
                        />
                    </div>
                </div>

                {/* Incomplete Items Action */}
                {hasIncomplete && (
                    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            {t('sprint_completion.incomplete_items_header', { count: stats.incompleteItems })}
                        </div>

                        {/* Incomplete item list preview */}
                        {stats.incompleteItemsList.slice(0, 4).map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-xs">
                                <span className="truncate font-medium text-foreground/80">{item.title}</span>
                                <Badge variant="outline" className="ml-2 shrink-0 text-[9px] uppercase">
                                    {item.status.replace(/_/g, ' ')}
                                </Badge>
                            </div>
                        ))}
                        {stats.incompleteItemsList.length > 4 && (
                            <p className="text-center text-[11px] text-muted-foreground">
                                {t('sprint_completion.more_items', { count: stats.incompleteItemsList.length - 4 })}
                            </p>
                        )}

                        <RadioGroup
                            value={action}
                            onValueChange={(v) => setAction(v as typeof action)}
                            className="space-y-2 pt-1"
                        >
                            <div className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${action === 'MOVE_TO_BACKLOG' ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
                                <RadioGroupItem value="MOVE_TO_BACKLOG" id="backlog" />
                                <Label htmlFor="backlog" className="flex cursor-pointer items-center gap-2">
                                    <ArchiveX className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-semibold">{t('sprint_completion.move_to_backlog')}</div>
                                        <div className="text-[11px] text-muted-foreground">{t('sprint_completion.move_to_backlog_desc')}</div>
                                    </div>
                                </Label>
                            </div>

                            <div className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors ${action === 'MOVE_TO_NEXT_SPRINT' ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="MOVE_TO_NEXT_SPRINT" id="next-sprint" />
                                    <Label htmlFor="next-sprint" className="flex cursor-pointer items-center gap-2">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="text-sm font-semibold">{t('sprint_completion.move_to_next_sprint')}</div>
                                            <div className="text-[11px] text-muted-foreground">{t('sprint_completion.move_to_next_sprint_desc')}</div>
                                        </div>
                                    </Label>
                                </div>

                                {action === 'MOVE_TO_NEXT_SPRINT' && (
                                    <Select value={selectedNextSprint} onValueChange={setSelectedNextSprint}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder={t('sprint_completion.select_sprint')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stats.nextSprints.length === 0 ? (
                                                <div className="p-2 text-center text-xs text-muted-foreground">
                                                    {t('sprint_completion.no_planned_sprints')}
                                                </div>
                                            ) : (
                                                stats.nextSprints.map(s => (
                                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                                        {s.name}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </RadioGroup>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={completeMutation.isPending}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={() => completeMutation.mutate()}
                        disabled={completeMutation.isPending || !canSubmit}
                        className="gap-2"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {completeMutation.isPending ? t('sprint_completion.completing') : t('sprint_completion.complete_sprint')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
