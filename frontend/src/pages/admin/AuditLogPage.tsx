import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, FileClock, Search, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { auditService, type AuditEntry } from '@/services/audit.service';
import { PageHeader, PageToolbar } from '@/components/layout/PageChrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';

const PAGE_SIZE = 25;

export default function AuditLogPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [entityType, setEntityType] = useState('');
    const [action, setAction] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AuditEntry>();
    const filters = { search: search || undefined, entityType: entityType || undefined, action: action || undefined, from: from || undefined, to: to ? `${to}T23:59:59.999Z` : undefined, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
    const logs = useQuery({ queryKey: ['audit-logs', filters], queryFn: () => auditService.list(filters) });
    const integrity = useQuery({ queryKey: ['audit-integrity'], queryFn: auditService.verify });

    const exportCsv = async () => {
        try {
            const blob = await auditService.exportCsv(filters);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = `nexa-audit-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
            URL.revokeObjectURL(url);
        } catch { toast.error(t('audit_log.export_error')); }
    };

    return <div className="page-shell page-stack">
        <PageHeader title={<span className="flex items-center gap-2"><FileClock className="h-6 w-6 text-primary" />{t('audit_log.title')}</span>} description={t('audit_log.description')}
            actions={<div className="flex items-center gap-2">
                <Badge variant={integrity.data?.valid ? 'outline' : 'destructive'} className={integrity.data?.valid ? 'border-emerald-500 text-emerald-700' : ''}>
                    {integrity.data?.valid ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <ShieldAlert className="mr-1 h-3.5 w-3.5" />}
                    {integrity.isLoading ? t('audit_log.verifying') : integrity.data?.valid ? t('audit_log.chain_valid', { count: integrity.data.checked }) : t('audit_log.chain_invalid')}
                </Badge>
                <Button data-testid="admin-audit-export-btn" variant="outline" onClick={() => void exportCsv()}><Download className="mr-2 h-4 w-4" />{t('audit_log.export')}</Button>
            </div>} />
        <PageToolbar>
            <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input data-testid="admin-audit-search-input" aria-label={t('audit_log.search')} className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('audit_log.search')} /></div>
            <Input aria-label={t('audit_log.entity_type')} className="w-44" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} placeholder={t('audit_log.entity_type')} />
            <Input data-testid="admin-audit-action-input" aria-label={t('audit_log.action')} className="w-48" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder={t('audit_log.action')} />
            <Input aria-label={t('audit_log.from')} className="w-40" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            <Input aria-label={t('audit_log.to')} className="w-40" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </PageToolbar>
        <div className="overflow-hidden rounded-xl border bg-card">
            {logs.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
                : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">{t('audit_log.time')}</th><th className="px-4 py-3">{t('audit_log.actor')}</th><th className="px-4 py-3">{t('audit_log.action')}</th><th className="px-4 py-3">{t('audit_log.entity')}</th><th className="px-4 py-3">{t('audit_log.ip')}</th></tr></thead>
                    <tbody>{(logs.data?.items || []).map((entry) => <tr key={entry.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => setSelected(entry)}><td className="whitespace-nowrap px-4 py-3 text-xs">{new Date(entry.createdAt).toLocaleString()}</td><td className="px-4 py-3"><div className="font-medium">{entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : t('audit_log.system')}</div><div className="text-xs text-muted-foreground">{entry.actor?.email}</div></td><td className="px-4 py-3"><Badge variant={entry.action.startsWith('SECURITY_') ? 'destructive' : 'secondary'}>{entry.action}</Badge></td><td className="px-4 py-3"><div className="font-medium">{entry.entityType}</div><div className="max-w-52 truncate text-xs text-muted-foreground">{entry.entityId}</div></td><td className="px-4 py-3 text-xs text-muted-foreground">{entry.ip || '—'}</td></tr>)}</tbody>
                </table>{!logs.data?.items.length && <p className="p-10 text-center text-sm text-muted-foreground">{t('audit_log.empty')}</p>}</div>}
        </div>
        <PaginationControls currentPage={page} totalPages={Math.max(1, Math.ceil((logs.data?.total || 0) / PAGE_SIZE))} onPageChange={setPage} />
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(undefined)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected?.action}</DialogTitle><DialogDescription>{selected?.entityType} · {selected?.entityId}</DialogDescription></DialogHeader>
            <div className="grid gap-4 md:grid-cols-2"><JsonPanel title={t('audit_log.before')} value={selected?.before} /><JsonPanel title={t('audit_log.after')} value={selected?.after} /></div>
            <div className="rounded-lg border p-3 text-xs"><span className="font-medium">{t('audit_log.integrity_hash')}:</span> <span className="break-all font-mono text-muted-foreground">{selected?.integrityHash || '—'}</span></div>
        </DialogContent></Dialog>
    </div>;
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
    return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><pre className="max-h-96 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{value == null ? '—' : JSON.stringify(value, null, 2)}</pre></div>;
}
