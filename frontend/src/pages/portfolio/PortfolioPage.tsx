import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BarChart3, BriefcaseBusiness, CalendarRange, FolderKanban, Gauge, Layers3, Link2, Loader2, Plus, Route, Sparkles, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { portfolioService, type PortfolioDashboard, type PortfolioInitiative } from '@/services/portfolio.service';
import { projectService } from '@/services/project.service';
import { PageHeader } from '@/components/layout/PageChrome';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

type DialogMode = 'PORTFOLIO' | 'PROGRAM' | 'PROJECT' | 'INITIATIVE' | 'DEPENDENCY' | null;
const statusTone: Record<string, string> = { DONE: 'bg-emerald-500', IN_PROGRESS: 'bg-blue-500', AT_RISK: 'bg-amber-500', BLOCKED: 'bg-red-500', PLANNED: 'bg-slate-400', CANCELLED: 'bg-slate-300' };

export default function PortfolioPage() {
    const { t } = useTranslation();
    const client = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [dialog, setDialog] = useState<DialogMode>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [capacityDelta, setCapacityDelta] = useState(0);
    const [addedEffort, setAddedEffort] = useState(0);
    const portfolios = useQuery({ queryKey: ['portfolios'], queryFn: portfolioService.list });
    const requestedPortfolioId = searchParams.get('portfolio') || '';
    const focusedInitiativeId = searchParams.get('initiative') || '';
    const activeId = portfolios.data?.some((item) => item.id === requestedPortfolioId)
        ? requestedPortfolioId
        : portfolios.data?.[0]?.id || '';
    const selectPortfolio = (id: string) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('portfolio', id);
            next.delete('initiative');
            return next;
        });
    };
    const dashboard = useQuery({ queryKey: ['portfolio', activeId], queryFn: () => portfolioService.get(activeId), enabled: !!activeId });
    const projects = useQuery({ queryKey: ['projects', 'portfolio-picker'], queryFn: () => projectService.getAll(1, 100) });
    const scenario = useMutation({ mutationFn: () => portfolioService.scenario(activeId, { capacityDeltaPercent: capacityDelta, addedEffortPoints: addedEffort }), onError: () => toast.error(t('portfolio.scenario_error')) });
    const save = useMutation({
        mutationFn: async () => {
            if (dialog === 'PORTFOLIO') return portfolioService.create(form);
            if (dialog === 'PROGRAM') return portfolioService.createProgram(activeId, form);
            if (dialog === 'PROJECT') return portfolioService.linkProject(activeId, { ...form, priority: Number(form.priority || 50) });
            if (dialog === 'INITIATIVE') return portfolioService.createInitiative(activeId, { ...form, estimatedEffortPoints: Number(form.estimatedEffortPoints || 0) });
            if (dialog === 'DEPENDENCY') return portfolioService.addDependency(activeId, form);
        },
        onSuccess: async (result) => {
            if (dialog === 'PORTFOLIO' && result && typeof result === 'object' && 'id' in result) selectPortfolio(String(result.id));
            setDialog(null); setForm({});
            await Promise.all([client.invalidateQueries({ queryKey: ['portfolios'] }), client.invalidateQueries({ queryKey: ['portfolio', activeId] })]);
            toast.success(t('portfolio.saved'));
        }, onError: (error) => toast.error(error instanceof Error ? error.message : t('portfolio.save_error')),
    });
    const open = (mode: DialogMode) => { setForm({}); setDialog(mode); };

    useEffect(() => {
        if (!activeId || requestedPortfolioId === activeId) return;
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('portfolio', activeId);
            return next;
        }, { replace: true });
    }, [activeId, requestedPortfolioId, setSearchParams]);

    useEffect(() => {
        if (!focusedInitiativeId || !dashboard.data?.programs.some((program) => program.initiatives.some((item) => item.id === focusedInitiativeId))) return;
        const frame = window.requestAnimationFrame(() => {
            const target = document.getElementById(`initiative-${focusedInitiativeId}`);
            if (!target) return;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            target.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [dashboard.data, focusedInitiativeId]);

    if (portfolios.isLoading) return <div className="page-shell page-stack"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-[600px] rounded-2xl" /></div>;
    return <div className="page-shell page-stack">
        <PageHeader title={<span className="flex items-center gap-2"><BriefcaseBusiness className="h-6 w-6 text-primary" />{t('portfolio.title')}</span>} description={t('portfolio.description')}
            actions={<Button onClick={() => open('PORTFOLIO')}><Plus className="mr-2 h-4 w-4" />{t('portfolio.new_portfolio')}</Button>} />
        {!portfolios.data?.length ? <Card className="border-dashed"><CardContent className="flex min-h-96 flex-col items-center justify-center text-center"><Layers3 className="mb-4 h-14 w-14 text-muted-foreground/40" /><h2 className="text-xl font-semibold">{t('portfolio.empty_title')}</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('portfolio.empty_description')}</p><Button className="mt-5" onClick={() => open('PORTFOLIO')}><Plus className="mr-2 h-4 w-4" />{t('portfolio.create_first')}</Button></CardContent></Card>
        : <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"><Select value={activeId} onValueChange={selectPortfolio}><SelectTrigger className="w-72"><SelectValue /></SelectTrigger><SelectContent>{portfolios.data.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><div className="ml-auto flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => open('PROGRAM')}><Layers3 className="mr-2 h-4 w-4" />{t('portfolio.add_program')}</Button><Button variant="outline" size="sm" onClick={() => open('PROJECT')}><FolderKanban className="mr-2 h-4 w-4" />{t('portfolio.add_project')}</Button><Button size="sm" onClick={() => open('INITIATIVE')}><Target className="mr-2 h-4 w-4" />{t('portfolio.add_initiative')}</Button></div></div>
            {dashboard.isLoading ? <Skeleton className="h-[600px] rounded-2xl" /> : dashboard.data && <PortfolioWorkspace data={dashboard.data} focusedInitiativeId={focusedInitiativeId} open={open} scenario={scenario.data} capacityDelta={capacityDelta} setCapacityDelta={setCapacityDelta} addedEffort={addedEffort} setAddedEffort={setAddedEffort} runScenario={() => scenario.mutate()} loadingScenario={scenario.isPending} />}
        </>}
        <PortfolioDialog mode={dialog} open={!!dialog} onClose={() => setDialog(null)} form={form} setForm={setForm} save={() => save.mutate()} saving={save.isPending} data={dashboard.data} projects={projects.data?.data || []} />
    </div>;
}

function PortfolioWorkspace({ data, focusedInitiativeId, open, scenario, capacityDelta, setCapacityDelta, addedEffort, setAddedEffort, runScenario, loadingScenario }: { data: PortfolioDashboard; focusedInitiativeId: string; open: (mode: DialogMode) => void; scenario?: { baselineWeeks: number; forecastWeeks: number; availableWeeks?: number; projectedUtilization: number; risk: string; deltaWeeks: number }; capacityDelta: number; setCapacityDelta: (value: number) => void; addedEffort: number; setAddedEffort: (value: number) => void; runScenario: () => void; loadingScenario: boolean }) {
    const { t } = useTranslation();
    const initiatives = data.programs.flatMap((program) => program.initiatives);
    return <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric icon={FolderKanban} label={t('portfolio.projects')} value={data.metrics.projectCount} /><Metric icon={Target} label={t('portfolio.initiatives')} value={data.metrics.initiativeCount} /><Metric icon={AlertTriangle} label={t('portfolio.at_risk')} value={data.metrics.atRiskCount} danger={data.metrics.atRiskCount > 0} /><Metric icon={Route} label={t('portfolio.blocked')} value={data.metrics.blockedCount} danger={data.metrics.blockedCount > 0} /><Metric icon={BarChart3} label={t('portfolio.progress')} value={`${data.metrics.averageProgress}%`} /><Metric icon={Gauge} label={t('portfolio.capacity')} value={`${data.metrics.capacityUtilization}%`} danger={data.metrics.capacityUtilization > 100} /></div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>{t('portfolio.roadmap')}</CardTitle><CardDescription>{t('portfolio.roadmap_description')}</CardDescription></div><Button variant="outline" size="sm" onClick={() => open('DEPENDENCY')} disabled={initiatives.length < 2}><Link2 className="mr-2 h-4 w-4" />{t('portfolio.add_dependency')}</Button></CardHeader><CardContent><Roadmap data={data} focusedInitiativeId={focusedInitiativeId} /></CardContent></Card>
            <div className="space-y-5"><ScenarioCard capacityDelta={capacityDelta} setCapacityDelta={setCapacityDelta} addedEffort={addedEffort} setAddedEffort={setAddedEffort} result={scenario} run={runScenario} loading={loadingScenario} /><ProjectHealth projects={data.projects} /></div>
        </div>
    </div>;
}

function Metric({ icon: Icon, label, value, danger }: { icon: typeof Gauge; label: string; value: string | number; danger?: boolean }) { return <Card className={cn(danger && 'border-destructive/30 bg-destructive/5')}><CardContent className="flex items-center gap-3 p-4"><div className={cn('rounded-lg bg-primary/10 p-2 text-primary', danger && 'bg-destructive/10 text-destructive')}><Icon className="h-4 w-4" /></div><div><div className="text-xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></CardContent></Card>; }

function Roadmap({ data, focusedInitiativeId }: { data: PortfolioDashboard; focusedInitiativeId: string }) {
    const { t } = useTranslation();
    const all = data.programs.flatMap((program) => program.initiatives);
    const dates = all.flatMap((item) => [item.startDate, item.targetDate]).filter(Boolean).map((value) => new Date(value!).getTime());
    const start = dates.length ? Math.min(...dates) : 0; const end = dates.length ? Math.max(...dates) : start + 90 * 86400000; const span = Math.max(86400000, end - start);
    if (!data.programs.length) return <div className="flex min-h-64 flex-col items-center justify-center text-center text-sm text-muted-foreground"><CalendarRange className="mb-3 h-10 w-10 opacity-40" />{t('portfolio.no_programs')}</div>;
    return <div className="overflow-x-auto"><div className="min-w-[760px] space-y-5">{data.programs.map((program) => <div key={program.id}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: program.color }} />{program.name}<Badge variant="outline">{program.initiatives.length}</Badge></div><div className="space-y-2 border-l-2 pl-3" style={{ borderColor: program.color }}>{program.initiatives.map((item) => <InitiativeRow key={item.id} item={item} start={start} span={span} focused={item.id === focusedInitiativeId} />)}{!program.initiatives.length && <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{t('portfolio.no_initiatives')}</div>}</div></div>)}</div></div>;
}

function InitiativeRow({ item, start, span, focused }: { item: PortfolioInitiative; start: number; span: number; focused: boolean }) {
    const left = clampPercent(((new Date(item.startDate || start).getTime() - start) / span) * 100); const width = Math.max(4, clampPercent(((new Date(item.targetDate || item.startDate || start + 86400000).getTime() - new Date(item.startDate || start).getTime()) / span) * 100));
    return <div id={`initiative-${item.id}`} tabIndex={-1} aria-current={focused ? 'true' : undefined} className={cn('grid grid-cols-[220px_minmax(300px,1fr)_72px] items-center gap-3 rounded-lg border bg-background p-2 outline-none transition-shadow', item.criticalPath && 'border-primary/40 ring-1 ring-primary/15', focused && 'border-amber-500 ring-2 ring-amber-500/35 shadow-lg shadow-amber-500/10')}><div className="min-w-0"><div className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', statusTone[item.status])} /><span className="truncate text-xs font-medium">{item.title}</span>{item.criticalPath && <Route className="h-3 w-3 shrink-0 text-primary" />}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{item.project ? `${item.project.key} · ${item.project.name}` : '—'}</div></div><div className="relative h-7 rounded bg-muted/60"><div className={cn('absolute top-1 h-5 rounded px-2 text-[10px] leading-5 text-white shadow-sm', item.riskScore >= 40 ? 'bg-amber-500' : statusTone[item.status])} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}><span className="block truncate">{item.progress}%</span></div></div><Badge variant={item.riskScore >= 40 ? 'destructive' : 'outline'} className="justify-center">{item.riskScore}</Badge></div>;
}
const clampPercent = (value: number) => Math.min(96, Math.max(0, value));

function ScenarioCard({ capacityDelta, setCapacityDelta, addedEffort, setAddedEffort, result, run, loading }: { capacityDelta: number; setCapacityDelta: (v: number) => void; addedEffort: number; setAddedEffort: (v: number) => void; result?: { baselineWeeks: number; forecastWeeks: number; availableWeeks?: number; projectedUtilization: number; risk: string; deltaWeeks: number }; run: () => void; loading: boolean }) { const { t } = useTranslation(); return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />{t('portfolio.scenario')}</CardTitle><CardDescription>{t('portfolio.scenario_description')}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><div><Label>{t('portfolio.capacity_delta')}</Label><Input type="number" value={capacityDelta} onChange={(e) => setCapacityDelta(Number(e.target.value))} /></div><div><Label>{t('portfolio.added_effort')}</Label><Input type="number" min={0} value={addedEffort} onChange={(e) => setAddedEffort(Number(e.target.value))} /></div></div><Button className="w-full" variant="secondary" onClick={run} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gauge className="mr-2 h-4 w-4" />}{t('portfolio.calculate')}</Button>{result && <div className="space-y-2 rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t('portfolio.forecast')}</span><Badge variant={result.risk === 'HIGH' ? 'destructive' : result.risk === 'MEDIUM' ? 'secondary' : 'outline'}>{result.risk}</Badge></div><div className="flex items-end justify-between"><div className="text-2xl font-semibold">{result.forecastWeeks} <span className="text-sm font-normal text-muted-foreground">{t('portfolio.weeks')}</span></div><div className="text-xs text-muted-foreground">{result.deltaWeeks >= 0 ? '+' : ''}{result.deltaWeeks} {t('portfolio.weeks')}</div></div><Progress value={Math.min(100, result.projectedUtilization)} /><p className="text-xs text-muted-foreground">{t('portfolio.projected_utilization', { value: result.projectedUtilization })}</p></div>}</CardContent></Card>; }

function ProjectHealth({ projects }: { projects: PortfolioDashboard['projects'] }) { const { t } = useTranslation(); return <Card><CardHeader><CardTitle className="text-base">{t('portfolio.project_health')}</CardTitle></CardHeader><CardContent className="space-y-3">{projects.slice(0, 6).map((project) => <div key={project.id} className="space-y-1.5"><div className="flex items-center justify-between text-xs"><span className="font-medium">{project.key} · {project.name}</span><span className={cn(project.utilization > 100 && 'text-destructive')}>{project.utilization}%</span></div><Progress value={Math.min(100, project.utilization)} /><div className="flex justify-between text-[11px] text-muted-foreground"><span>{t('portfolio.progress_value', { value: project.progress })}</span><span>{t('portfolio.critical_bugs', { count: project.criticalBugs })}</span></div></div>)}{!projects.length && <p className="text-sm text-muted-foreground">{t('portfolio.no_projects')}</p>}</CardContent></Card>; }

function PortfolioDialog({ mode, open, onClose, form, setForm, save, saving, data, projects }: { mode: DialogMode; open: boolean; onClose: () => void; form: Record<string, string>; setForm: (form: Record<string, string>) => void; save: () => void; saving: boolean; data?: PortfolioDashboard; projects: Array<{ id: string; key: string; name: string }> }) {
    const { t } = useTranslation(); const set = (key: string, value: string) => setForm({ ...form, [key]: value }); const initiatives = data?.programs.flatMap((p) => p.initiatives) || [];
    return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t(`portfolio.dialog.${mode || 'PORTFOLIO'}.title`)}</DialogTitle><DialogDescription>{t(`portfolio.dialog.${mode || 'PORTFOLIO'}.description`)}</DialogDescription></DialogHeader><div className="space-y-4">
        {(mode === 'PORTFOLIO' || mode === 'PROGRAM') && <><Field label={t('portfolio.name')} value={form.name} onChange={(v) => set('name', v)} /><div><Label>{t('portfolio.details')}</Label><Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><DateField label={t('portfolio.start_date')} value={form.startDate} onChange={(v) => set('startDate', v)} /><DateField label={t('portfolio.target_date')} value={form.targetDate} onChange={(v) => set('targetDate', v)} /></div></>}
        {mode === 'PROJECT' && <><SelectField label={t('portfolio.project')} value={form.projectId} onChange={(v) => set('projectId', v)} options={projects.filter((p) => !data?.projects.some((existing) => existing.id === p.id)).map((p) => [p.id, `${p.key} · ${p.name}`])} /><SelectField label={t('portfolio.program')} value={form.programId} onChange={(v) => set('programId', v)} options={(data?.programs || []).map((p) => [p.id, p.name])} /><Field label={t('portfolio.business_priority')} value={form.priority || '50'} type="number" onChange={(v) => set('priority', v)} /></>}
        {mode === 'INITIATIVE' && <><Field label={t('portfolio.initiative_title')} value={form.title} onChange={(v) => set('title', v)} /><SelectField label={t('portfolio.program')} value={form.programId} onChange={(v) => set('programId', v)} options={(data?.programs || []).map((p) => [p.id, p.name])} /><SelectField label={t('portfolio.project_optional')} value={form.projectId} onChange={(v) => set('projectId', v)} options={(data?.projects || []).map((p) => [p.id, `${p.key} · ${p.name}`])} optional /><div className="grid grid-cols-2 gap-3"><DateField label={t('portfolio.start_date')} value={form.startDate} onChange={(v) => set('startDate', v)} /><DateField label={t('portfolio.target_date')} value={form.targetDate} onChange={(v) => set('targetDate', v)} /></div><Field label={t('portfolio.effort_points')} value={form.estimatedEffortPoints || '0'} type="number" onChange={(v) => set('estimatedEffortPoints', v)} /></>}
        {mode === 'DEPENDENCY' && <><SelectField label={t('portfolio.dependent')} value={form.sourceInitiativeId} onChange={(v) => set('sourceInitiativeId', v)} options={initiatives.map((i) => [i.id, i.title])} /><div className="flex justify-center"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div><SelectField label={t('portfolio.blocker')} value={form.targetInitiativeId} onChange={(v) => set('targetInitiativeId', v)} options={initiatives.filter((i) => i.id !== form.sourceInitiativeId).map((i) => [i.id, i.title])} /></>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button></div>
    </div></DialogContent></Dialog>;
}
function Field({ label, value = '', onChange, type = 'text' }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function DateField(props: { label: string; value?: string; onChange: (value: string) => void }) { return <Field {...props} type="date" />; }
function SelectField({ label, value, onChange, options, optional }: { label: string; value?: string; onChange: (value: string) => void; options: string[][]; optional?: boolean }) { return <div><Label>{label}</Label><Select value={value || (optional ? '__none__' : '')} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{optional && <SelectItem value="__none__">—</SelectItem>}{options.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></div>; }
