import { useEffect, useState } from 'react';
import { useTimeTrackerStore } from '../../store/useTimeTrackerStore';
import { Square, X, Clock, Loader2 } from 'lucide-react';
import { worklogService } from '../../services/worklog.service';
import { toast } from 'sonner';

export function TimeTrackerWidget() {
    const { activeTimer, stopTimer, cancelTimer } = useTimeTrackerStore();
    const [elapsed, setElapsed] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!activeTimer) {
            setElapsed(0);
            return;
        }

        const interval = setInterval(() => {
            const start = new Date(activeTimer.startedAt).getTime();
            const now = new Date().getTime();
            setElapsed(Math.floor((now - start) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeTimer]);

    if (!activeTimer) return null;

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    const formatTime = (h: number, m: number, s: number) => {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStop = async () => {
        const timer = stopTimer();
        if (!timer) return;

        const totalMinutes = Math.floor(elapsed / 60);
        
        if (totalMinutes < 1) {
            toast.success("Çalışma süresi 1 dakikadan az olduğu için kaydedilmedi.");
            return;
        }

        setIsSaving(true);
        try {
            await worklogService.create({
                startedAt: timer.startedAt,
                durationMinutes: totalMinutes,
                description: "Otomatik zaman takibi",
                projectId: timer.projectId,
                workItemId: timer.workItemId,
                category: 'DEVELOPMENT',
                billable: true
            });
            toast.success(`${totalMinutes} dakikalık efor kaydedildi!`);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Efor kaydedilirken hata oluştu");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-primary/20 bg-card p-2 pr-4 shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary animate-pulse" />
            </div>
            
            <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                    {activeTimer.key}
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatTime(hours, minutes, seconds)}
                </span>
            </div>

            <div className="ml-2 flex items-center gap-1 border-l pl-3 border-border/50">
                <button
                    onClick={handleStop}
                    disabled={isSaving}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors disabled:opacity-50"
                    title="Durdur ve Kaydet"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-current" />}
                </button>
                <button
                    onClick={() => cancelTimer()}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                    title="İptal Et"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
