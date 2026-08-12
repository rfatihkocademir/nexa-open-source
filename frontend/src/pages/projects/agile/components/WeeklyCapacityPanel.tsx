import { useQuery } from '@tanstack/react-query';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { worklogService } from '@/services/worklog.service';
import { formatWorklogDuration } from '@/lib/worklogDuration';

const hours = (minutes: number) => formatWorklogDuration(minutes);

export function WeeklyCapacityPanel({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const { data = [], isLoading } = useQuery({ queryKey: ['worklog-weekly-summary', projectId], queryFn: () => worklogService.weeklySummary(projectId) });
    return <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><div><h3 className="text-sm font-semibold">{t('capacity.title')}</h3><p className="text-xs text-muted-foreground">{t('capacity.description')}</p></div></div>
        {isLoading ? <div className="h-20 animate-pulse rounded-lg bg-muted" /> : data.length === 0 ? <p className="text-xs text-muted-foreground">{t('capacity.empty')}</p> : <div className="grid gap-3 md:grid-cols-2">{data.map((row) => {
            const percent = row.capacityMinutes > 0 ? Math.round((row.loggedMinutes / row.capacityMinutes) * 100) : 0;
            return <div key={row.userId} className="space-y-2 rounded-lg border p-3"><div className="flex justify-between text-xs"><span className="font-semibold">{row.name}</span><span className="tabular-nums text-muted-foreground">{hours(row.loggedMinutes)} / {hours(row.capacityMinutes)}</span></div><Progress value={Math.min(percent, 100)} /><div className="flex flex-wrap gap-1.5">{Object.entries(row.byCategory).map(([category, minutes]) => <span key={category} className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{t(`worklog.categories.${category}`)} · {hours(minutes)}</span>)}</div></div>;
        })}</div>}
    </div>;
}
