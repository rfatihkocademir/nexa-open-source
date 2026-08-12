import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Play, SearchCheck, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { enterpriseMigrationService, type DryRunResult, type MigrationJob } from '@/services/enterprise-migration.service';
import { integrationService } from '@/services/integration.service';
import { projectService } from '@/services/project.service';

const DEFAULT_MAPPING = JSON.stringify({
    typeMap: { Epic: 'EPIC', Story: 'STORY', Task: 'TASK', Bug: 'BUG', Incident: 'INCIDENT' },
    statusMap: { 'To Do': 'TODO', 'In Progress': 'IN_PROGRESS', Done: 'DONE' },
    priorityMap: { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH', Highest: 'CRITICAL' },
    userMap: {},
}, null, 2);

const summaryItems = (summary?: MigrationJob['summary']) => summary ? [
    ['migration_center.total', summary.total],
    ['migration_center.valid', summary.valid],
    ['migration_center.invalid', summary.invalid],
    ['migration_center.work_items', summary.workItems],
    ['migration_center.test_cases', summary.testCases],
] as const : [];

export function EnterpriseMigrationCenter({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [payload, setPayload] = useState<unknown>();
    const [sourceMode, setSourceMode] = useState<'FILE' | 'LIVE'>('FILE');
    const [integrationId, setIntegrationId] = useState('');
    const [jql, setJql] = useState('');
    const [maxIssues, setMaxIssues] = useState(1000);
    const [includeXray, setIncludeXray] = useState(false);
    const [fileName, setFileName] = useState('');
    const [mappingText, setMappingText] = useState(DEFAULT_MAPPING);
    const [job, setJob] = useState<MigrationJob>();
    const [preview, setPreview] = useState<DryRunResult>();
    const historyKey = ['enterprise-migrations', projectId];
    const history = useQuery({ queryKey: historyKey, queryFn: () => enterpriseMigrationService.list(projectId) });
    const integrations = useQuery({ queryKey: ['integrations', projectId], queryFn: () => integrationService.getAll(projectId) });
    const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectService.getById(projectId) });
    const jiraIntegrations = (integrations.data ?? []).filter((integration) => integration.type === 'JIRA' && integration.isActive);

    const analyze = useMutation({
        mutationFn: async () => {
            let mapping: Record<string, unknown>;
            try { mapping = JSON.parse(mappingText); } catch { throw new Error(t('migration_center.mapping_invalid')); }
            if (sourceMode === 'LIVE') {
                if (!integrationId) throw new Error(t('migration_center.integration_required'));
                return includeXray
                    ? enterpriseMigrationService.analyzeJiraXray(projectId, integrationId, jql, maxIssues, mapping)
                    : enterpriseMigrationService.analyzeJira(projectId, integrationId, jql, maxIssues, mapping);
            }
            if (!payload) throw new Error(t('migration_center.file_required'));
            return enterpriseMigrationService.analyze(projectId, payload, mapping);
        },
        onSuccess: async (result) => {
            setJob(result); setPreview(undefined);
            await queryClient.invalidateQueries({ queryKey: historyKey });
            toast.success(t('migration_center.analysis_complete'));
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : t('migration_center.analysis_error')),
    });
    const testConnection = useMutation({
        mutationFn: async () => {
            const jira = await enterpriseMigrationService.testJira(projectId, integrationId);
            if (includeXray) await enterpriseMigrationService.testXray(projectId, integrationId);
            return jira;
        },
        onSuccess: (result) => toast.success(includeXray ? t('migration_center.jira_xray_connection_success', { name: result.displayName }) : t('migration_center.connection_success', { name: result.displayName })),
        onError: () => toast.error(t('migration_center.connection_error')),
    });
    const dryRun = useMutation({
        mutationFn: () => enterpriseMigrationService.dryRun(projectId, job!.id),
        onSuccess: (result) => { setPreview(result); toast.success(t('migration_center.preview_ready')); },
        onError: () => toast.error(t('migration_center.preview_error')),
    });
    const execute = useMutation({
        mutationFn: () => enterpriseMigrationService.execute(projectId, job!.id),
        onSuccess: async (result) => {
            setJob(result);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: historyKey }),
                queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
            ]);
            toast.success(t('migration_center.import_complete'));
        },
        onError: () => toast.error(t('migration_center.import_error')),
    });
    const loadDetail = useMutation({
        mutationFn: (jobId: string) => enterpriseMigrationService.get(projectId, jobId),
        onSuccess: (result) => { setJob(result); setPreview(undefined); },
        onError: () => toast.error(t('migration_center.detail_error')),
    });

    const readFile = async (file?: File) => {
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) return toast.error(t('migration_center.file_too_large'));
        try {
            setPayload(JSON.parse(await file.text()));
            setFileName(file.name);
            setJob(undefined); setPreview(undefined);
        } catch { toast.error(t('migration_center.file_invalid')); }
    };
    const setUserMapping = (accountId: string, userId: string) => {
        try {
            const mapping = JSON.parse(mappingText) as Record<string, unknown> & { userMap?: Record<string, string> };
            mapping.userMap = { ...(mapping.userMap || {}) };
            if (userId === '__unmapped__') delete mapping.userMap[accountId];
            else mapping.userMap[accountId] = userId;
            setMappingText(JSON.stringify(mapping, null, 2));
        } catch {
            toast.error(t('migration_center.mapping_invalid'));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" />{t('migration_center.title')}</CardTitle>
                <CardDescription>{t('migration_center.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    <Label>{t('migration_center.source_mode')}</Label>
                    <Select value={sourceMode} onValueChange={(value) => { setSourceMode(value as 'FILE' | 'LIVE'); setJob(undefined); setPreview(undefined); }}>
                        <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="FILE">{t('migration_center.source_file_mode')}</SelectItem><SelectItem value="LIVE">{t('migration_center.source_live_mode')}</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    {sourceMode === 'FILE' ? <div className="space-y-2">
                        <Label>{t('migration_center.source_file')}</Label>
                        <Input ref={fileRef} type="file" accept=".json,application/json" onChange={(event) => void readFile(event.target.files?.[0])} />
                        <p className="text-xs text-muted-foreground">{fileName ? t('migration_center.selected_file', { name: fileName }) : t('migration_center.file_help')}</p>
                    </div> : <div className="space-y-3 rounded-lg border p-3">
                        <div className="space-y-1.5"><Label>{t('migration_center.jira_integration')}</Label><Select value={integrationId} onValueChange={setIntegrationId}><SelectTrigger><SelectValue placeholder={t('migration_center.select_integration')} /></SelectTrigger><SelectContent>{jiraIntegrations.map((integration) => <SelectItem key={integration.id} value={integration.id}>{integration.name} · {integration.config.url}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><Label>{t('migration_center.jql')}</Label><Input value={jql} onChange={(event) => setJql(event.target.value)} placeholder='project = "PROJ" ORDER BY key ASC' /><p className="text-xs text-muted-foreground">{t('migration_center.jql_help')}</p></div>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-background p-3">
                            <Checkbox checked={includeXray} onCheckedChange={(checked) => setIncludeXray(checked === true)} />
                            <span><span className="block text-sm font-medium">{t('migration_center.include_xray')}</span><span className="block text-xs text-muted-foreground">{t('migration_center.include_xray_help')}</span></span>
                        </label>
                        <div className="flex items-end gap-2"><div className="flex-1 space-y-1.5"><Label>{t('migration_center.max_issues')}</Label><Input type="number" min={1} max={5000} value={maxIssues} onChange={(event) => setMaxIssues(Math.min(5000, Math.max(1, Number(event.target.value))))} /></div><Button variant="outline" onClick={() => testConnection.mutate()} disabled={!integrationId || testConnection.isPending}>{testConnection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('migration_center.test_connection')}</Button></div>
                        {!jiraIntegrations.length && <p className="text-xs text-amber-600">{t('migration_center.no_jira_integration')}</p>}
                    </div>}
                    <div className="space-y-2">
                        <Label>{t('migration_center.mapping')}</Label>
                        <Textarea className="min-h-36 font-mono text-xs" value={mappingText} onChange={(event) => setMappingText(event.target.value)} spellCheck={false} />
                        <p className="text-xs text-muted-foreground">{t('migration_center.mapping_help')}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => analyze.mutate()} disabled={(sourceMode === 'FILE' ? !payload : !integrationId) || analyze.isPending}>
                        {analyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}{t('migration_center.analyze')}
                    </Button>
                    <Button variant="outline" onClick={() => dryRun.mutate()} disabled={!job || dryRun.isPending || job.status === 'RUNNING'}>
                        {dryRun.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}{t('migration_center.dry_run')}
                    </Button>
                    <Button onClick={async () => {
                        if (!preview) return;
                        if (await confirm({ description: t('migration_center.execute_confirm', { create: preview.summary.create ?? 0, update: preview.summary.update ?? 0 }), confirmLabel: t('migration_center.execute') })) execute.mutate();
                    }} disabled={!preview || execute.isPending || (preview.summary.invalid ?? 0) > 0}>
                        {execute.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{t('migration_center.execute')}
                    </Button>
                </div>

                {job && <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">{t('migration_center.analysis')}</h4><Badge variant={job.summary.invalid ? 'destructive' : 'secondary'}>{job.status}</Badge></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{summaryItems(job.summary).map(([key, value]) => <div key={key} className="rounded-lg border bg-background p-3"><div className="text-xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{t(key)}</div></div>)}</div>
                    <div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{t('migration_center.execution_count', { count: job.summary.testExecutions ?? 0 })}</Badge><Badge variant="outline">{t('migration_center.comment_count', { count: job.summary.comments ?? 0 })}</Badge><Badge variant="outline">{t('migration_center.link_count', { count: job.summary.links ?? 0 })}</Badge><Badge variant="outline">{t('migration_center.sprint_count', { count: job.summary.sprints ?? 0 })}</Badge></div>
                    {!!job.summary.discoveredUsers?.length && <div className="mt-4 space-y-2">
                        <div><h5 className="text-sm font-semibold">{t('migration_center.user_mapping')}</h5><p className="text-xs text-muted-foreground">{t('migration_center.user_mapping_help')}</p></div>
                        <div className="grid gap-2 md:grid-cols-2">{job.summary.discoveredUsers.map((sourceUser) => {
                            let selected = '__unmapped__';
                            try { selected = (JSON.parse(mappingText).userMap || {})[sourceUser.accountId] || '__unmapped__'; } catch { /* validation is shown on analyze */ }
                            return <div key={sourceUser.accountId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-background p-2">
                                <div className="min-w-0"><div className="truncate text-xs font-medium">{sourceUser.displayName}</div><div className="truncate text-[11px] text-muted-foreground">{sourceUser.accountId}</div></div>
                                <Select value={selected} onValueChange={(value) => setUserMapping(sourceUser.accountId, value)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unmapped__">{t('migration_center.user_unmapped')}</SelectItem>{(project.data?.members || []).map(({ user }) => <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>)}</SelectContent></Select>
                            </div>;
                        })}</div>
                        <p className="text-xs text-amber-700">{t('migration_center.reanalyze_after_mapping')}</p>
                    </div>}
                    {!!job.summary.invalid && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{t('migration_center.resolve_invalid')}</p>}
                </div>}

                {preview && <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{t('migration_center.preview')}</h4>
                    <div className="flex flex-wrap gap-2">
                        <Badge>{t('migration_center.create_count', { count: preview.summary.create })}</Badge>
                        <Badge variant="secondary">{t('migration_center.update_count', { count: preview.summary.update })}</Badge>
                        <Badge variant="outline">{t('migration_center.unchanged_count', { count: preview.summary.unchanged })}</Badge>
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                        {preview.actions.slice(0, 200).map((action) => <div key={`${action.entityType}-${action.externalId}`} className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-0"><span><FileJson className="mr-2 inline h-3.5 w-3.5" />{action.sourceKey} · {action.entityType}</span><Badge variant={action.action === 'CREATE' ? 'default' : action.action === 'UPDATE' ? 'secondary' : 'outline'}>{action.action}</Badge></div>)}
                    </div>
                </div>}

                {job?.records && job.records.length > 0 && <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{t('migration_center.reconciliation')}</h4><Button variant="outline" size="sm" onClick={async () => {
                        const report = await enterpriseMigrationService.downloadReport(projectId, job.id);
                        const url = URL.createObjectURL(report);
                        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nexa-migration-${job.id}.json`; anchor.click(); URL.revokeObjectURL(url);
                    }}>{t('migration_center.download_report')}</Button></div>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">{job.records.map((record) => <div key={record.id} className="grid grid-cols-[1fr_auto] gap-2 border-b px-3 py-2 text-xs last:border-0"><div className="min-w-0"><div className="truncate font-medium">{record.externalId}</div><div className="text-muted-foreground">{record.entityType}{record.error ? ` · ${record.error}` : ''}</div></div><Badge variant={record.status === 'CREATED' ? 'default' : record.status === 'UPDATED' ? 'secondary' : 'outline'}>{record.status}</Badge></div>)}</div>
                </div>}
                {job?.errors && job.errors.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><h4 className="mb-2 text-sm font-semibold text-destructive">{t('migration_center.errors')}</h4><div className="max-h-40 space-y-1 overflow-y-auto">{job.errors.map((error, index) => <p key={`${error.externalId || error.key || index}`} className="text-xs">{error.externalId || error.key || `#${(error.index ?? index) + 1}`}: {error.message}</p>)}</div></div>}

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{t('migration_center.history')}</h4>
                    <div className="max-h-52 overflow-y-auto rounded-lg border">
                        {(history.data ?? []).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-0"><div className="min-w-0"><div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />{entry.source}<Badge variant="outline">{entry.status}</Badge></div><div className="mt-1 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()} · {t('migration_center.record_count', { count: entry._count?.records ?? 0 })}</div></div><Button variant="ghost" size="sm" onClick={() => loadDetail.mutate(entry.id)} disabled={loadDetail.isPending}>{t('common.view')}</Button></div>)}
                        {!history.isLoading && !history.data?.length && <p className="p-4 text-center text-xs text-muted-foreground">{t('migration_center.no_history')}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
