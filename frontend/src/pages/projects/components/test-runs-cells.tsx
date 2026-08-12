import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { RunStatus, TestRunItem } from "@/types/testRun"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

export const StatusBadge = ({ status }: { status: RunStatus }) => {
    const { t } = useTranslation()
    const colors: Record<RunStatus, string> = {
        OPEN: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
        ARCHIVED: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    }
    return <Badge variant="outline" className={`${colors[status]} font-medium`}>{t(`common.statuses.${status}`, { defaultValue: status })}</Badge>
}

interface ProgressBarProps {
    items?: TestRunItem[];
    totalItems?: number;
    passedCount?: number;
    failedCount?: number;
    blockedCount?: number;
    untestedCount?: number;
    t: TFunction;
}

export const ProgressBar = ({
    items,
    totalItems,
    passedCount,
    failedCount,
    blockedCount,
    untestedCount,
    t,
}: ProgressBarProps) => {
    // The run list endpoint returns summary counters instead of the full items array.
    // Prefer item details when available, otherwise use those counters so the list
    // still renders progress for completed and paginated runs.
    const hasCompleteItems = Boolean(items?.length && (!totalItems || items.length >= totalItems));
    const summaryTotal = totalItems ?? ((passedCount ?? 0) + (failedCount ?? 0) + (blockedCount ?? 0) + (untestedCount ?? 0));
    const total = hasCompleteItems ? items!.length : summaryTotal;
    const passed = hasCompleteItems ? items!.filter(i => i.finalStatus === 'PASS').length : (passedCount ?? 0);
    const failed = hasCompleteItems ? items!.filter(i => i.finalStatus === 'FAIL').length : (failedCount ?? 0);
    const blocked = hasCompleteItems ? items!.filter(i => i.finalStatus === 'BLOCK').length : (blockedCount ?? 0);
    const untested = hasCompleteItems
        ? Math.max(total - passed - failed - blocked, 0)
        : Math.max(untestedCount ?? total - passed - failed - blocked, 0);
    const otherExecuted = Math.max(total - passed - failed - blocked - untested, 0);

    if (total === 0) {
        return <div className="h-2 w-24 rounded-full bg-muted" aria-label={t('test_run_list.tooltip.untested', { count: 0 })} />;
    }

    const getPercent = (count: number) => (count / total) * 100
    const executed = total - untested
    const progress = Math.round((executed / total) * 100)

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2" aria-label={`${progress}%`}>
                        <div className="flex h-2 w-24 overflow-hidden rounded-full bg-secondary cursor-help">
                            <div style={{ width: `${getPercent(passed)}%` }} className="bg-green-500" />
                            <div style={{ width: `${getPercent(failed)}%` }} className="bg-red-500" />
                            <div style={{ width: `${getPercent(blocked)}%` }} className="bg-orange-500" />
                            <div style={{ width: `${getPercent(otherExecuted)}%` }} className="bg-blue-500" />
                            <div style={{ width: `${getPercent(untested)}%` }} className="bg-muted-foreground/20" />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{progress}%</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" /> {t('test_run_list.tooltip.pass', { count: passed })}</div>
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-500" /> {t('test_run_list.tooltip.fail', { count: failed })}</div>
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-orange-500" /> {t('test_run_list.tooltip.block', { count: blocked })}</div>
                        {otherExecuted > 0 && <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> {t('test_run_list.tooltip.executed', { count: otherExecuted })}</div>}
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-muted-foreground/20" /> {t('test_run_list.tooltip.untested', { count: untested })}</div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
