import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertCircle, Edit, PlayCircle } from "lucide-react";
import { auditService, type AuditEntry } from "@/services/audit.service";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDateLocale } from "@/hooks/useDateLocale";
import { formatDateTime } from "@/lib/formatters";

interface WorkItemHistoryProps {
    workItemId: string;
}

export function WorkItemHistory({ workItemId }: WorkItemHistoryProps) {
    const [history, setHistory] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const dateLocale = useDateLocale();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const response = await auditService.list({ entityId: workItemId, entityType: 'WorkItem', take: 50 });
                setHistory(response.items);
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setLoading(false);
            }
        };

        if (workItemId) {
            fetchHistory();
        }
    }, [workItemId]);

    const getActionIcon = (action: string) => {
        if (action.includes('CREATE')) return <PlayCircle className="h-4 w-4 text-emerald-500" />;
        if (action.includes('UPDATE')) return <Edit className="h-4 w-4 text-blue-500" />;
        if (action.includes('DELETE')) return <AlertCircle className="h-4 w-4 text-red-500" />;
        return <Clock className="h-4 w-4 text-gray-500" />;
    };

    const getActionLabel = (action: string) => {
        if (action === 'WORKITEM_CREATE') return 'Oluşturuldu';
        if (action === 'WORKITEM_UPDATE') return 'Güncellendi';
        if (action === 'WORKITEM_DELETE') return 'Silindi';
        return action;
    };

    const renderDiffs = (before: any, after: any) => {
        if (!before || !after) return null;
        const changes = [];
        for (const key of Object.keys(after)) {
            if (key.startsWith('_') || key === 'updatedAt') continue;
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                let label = key;
                if (key === 'status') label = 'Statü';
                if (key === 'description') label = 'Açıklama';
                if (key === 'title') label = 'Başlık';
                
                const valBefore = before[key] === null || before[key] === undefined ? 'Boş' : String(before[key]).substring(0, 50);
                const valAfter = after[key] === null || after[key] === undefined ? 'Boş' : String(after[key]).substring(0, 50);

                changes.push(
                    <div key={key} className="text-[11px] mt-1 p-1.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-500 mr-2">{label}:</span>
                        <span className="line-through text-red-400 mr-2">{valBefore}</span>
                        <span className="text-emerald-500 font-medium">➔ {valAfter}</span>
                    </div>
                );
            }
        }
        return changes;
    };

    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Clock className="animate-spin h-4 w-4" /> Geçmiş yükleniyor...</div>;
    }

    if (history.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground text-center">Bu kayıt için tarihçe bulunamadı.</div>;
    }

    return (
        <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                {history.map((entry) => {
                    const actorName = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : (entry.actorId || 'Sistem');
                    const initial = entry.actor?.firstName?.[0] || 'S';
                    const diffs = renderDiffs(entry.before, entry.after);

                    return (
                        <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                {getActionIcon(entry.action)}
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initial}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">{actorName}</span>
                                    </div>
                                    <time className="text-[10px] text-slate-500 font-medium">
                                        {formatDateTime(entry.createdAt, dateLocale.code === 'tr' ? 'tr-TR' : 'en-US')}
                                    </time>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 mb-2 font-normal">
                                        {getActionLabel(entry.action)}
                                    </Badge>
                                    {diffs && diffs.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {diffs}
                                        </div>
                                    )}
                                </div>
                                {entry.integrityHash && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                        <span className="text-[9px] text-slate-400 font-mono truncate" title={entry.integrityHash}>
                                            Hash: {entry.integrityHash.substring(0, 16)}...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
