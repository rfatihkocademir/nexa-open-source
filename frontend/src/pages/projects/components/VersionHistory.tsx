import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { History, GitCommit, RotateCcw } from "lucide-react"
import { testCaseService } from "@/services/testCase.service"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { TestCaseHistoryEntry } from "@/services/testCase.service"
import { useAppDialog } from "@/components/ui/app-dialog-context"

interface VersionHistoryProps {
    testCaseId: string
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function VersionHistory({ testCaseId, trigger, open, onOpenChange }: VersionHistoryProps) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const { data: history, isLoading } = useQuery({
        queryKey: ["test-case-history", testCaseId],
        queryFn: () => testCaseService.getHistory(testCaseId),
        enabled: !!testCaseId && (open === true || open === undefined), // Only fetch when open
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col bg-background border-primary/10 shadow-2xl">
                <DialogHeader className="flex flex-row items-center gap-4 pb-2 border-b border-border/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <History className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {t('version_history.title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground/80">
                            {t('version_history.description')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-4 p-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </div>
                ) : !history || history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
                        <div className="p-4 bg-muted/50 rounded-full">
                            <History className="h-8 w-8 opacity-20" />
                        </div>
                        <p>{t('version_history.no_history')}</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-0 p-1 relative">
                            {/* Vertical Line */}
                            <div className="absolute bottom-4 left-[19px] top-4 w-px bg-border" />

                            {history.map((version: TestCaseHistoryEntry) => (
                                <div key={version.id} className="relative pl-12 pb-8 last:pb-0 group">
                                    {/* Timeline Node */}
                                    <div className="absolute left-3 top-1 z-10 h-4 w-4 rounded-full border-2 border-primary bg-background" />

                                    <div className="flex flex-col gap-3 bg-card/50 hover:bg-card border border-transparent hover:border-primary/10 p-4 rounded-xl transition-all duration-200 hover:shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-mono">v{version.version}</Badge>
                                                <span className="font-semibold text-foreground/90">{version.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded-md">
                                                    {format(new Date(version.changedAt), "MMM d, yyyy HH:mm")}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                    title={t('version_history.revert_tooltip')}
                                                    onClick={async () => {
                                                        if (await confirm({
                                                            description: t('version_history.revert_confirm'),
                                                            confirmLabel: t('common.restore', 'Geri yükle'),
                                                        })) {
                                                            try {
                                                                await testCaseService.revertToVersion(testCaseId, version.version)
                                                                toast.success(t('version_history.revert_success'))
                                                                onOpenChange?.(false)
                                                                // Invalidate queries handled by parent or context? 
                                                                // QueryClient usage needed here or passed down.
                                                                // Better to use queryClient hook.
                                                            } catch {
                                                                toast.error(t('version_history.revert_error'))
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                                            <GitCommit className="h-3.5 w-3.5" />
                                            <span>{t('version_history.changed_by')} <span className="font-medium text-foreground/80">{version.changedBy?.firstName} {version.changedBy?.lastName}</span></span>
                                        </div>

                                        {/* Steps Preview */}
                                        <div className="mt-1 bg-muted/30 rounded-lg border border-border/50 p-3 text-xs">
                                            <div className="font-semibold mb-2 flex items-center gap-2 text-foreground/80">
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                                                {t('version_history.steps_count', { count: version.steps.length })}
                                            </div>
                                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                                {version.steps.map((step, i) => (
                                                    <div key={i} className="grid grid-cols-[1fr,1fr] gap-3 p-2 rounded bg-background/50 border border-border/30">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">{t('version_history.action_label')}</span>
                                                            <span className="text-foreground/90">{step.action}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">{t('version_history.expected_label')}</span>
                                                            <span className="text-foreground/90">{step.expected || step.expectedResult}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    )
}
