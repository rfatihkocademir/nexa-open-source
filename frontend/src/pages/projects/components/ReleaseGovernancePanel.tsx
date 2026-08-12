import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PackageCheck, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { releaseService } from '@/services/release.service';
import type { ProjectQualityTier, StakeholderDecision } from '@/types/release';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlossaryTerm } from '@/components/help/GlossaryTerm';
import { HelpTooltip } from '@/components/help/HelpTooltip';

const errorMessage = (error: any) => error?.response?.data?.message || 'İşlem tamamlanamadı.';

export function ReleaseGovernancePanel({ projectId, releaseId }: { projectId: string; releaseId: string }) {
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const canManage = useAuthStore((state) => state.checkPermission(projectId, 'project.manage'));
    const canFinalize = useAuthStore((state) => state.checkPermission(projectId, 'release.finalize'));
    const [decision, setDecision] = useState<StakeholderDecision>('APPROVE');
    const [rationale, setRationale] = useState('');
    const queryKey = ['release-governance', projectId, releaseId];
    const { data, isLoading } = useQuery({ queryKey, queryFn: () => releaseService.getGovernance(projectId, releaseId) });
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    const mutationOptions = { onSuccess: refresh, onError: (error: any) => toast.error(errorMessage(error)) };
    const tierMutation = useMutation({ mutationFn: (tier: ProjectQualityTier) => releaseService.updateQualityTier(projectId, tier), ...mutationOptions });
    const roundMutation = useMutation({ mutationFn: () => releaseService.startApprovalRound(projectId, releaseId), onSuccess: () => { refresh(); toast.success('Mutabakat turu başlatıldı.'); }, onError: mutationOptions.onError });
    const decisionMutation = useMutation({ mutationFn: () => releaseService.submitApprovalDecision(projectId, releaseId, data!.latestRound!.id, decision, rationale), onSuccess: () => { setRationale(''); refresh(); toast.success('Kararınız gerekçesiyle kaydedildi.'); }, onError: mutationOptions.onError });
    const packageMutation = useMutation({ mutationFn: () => releaseService.createDeployPackage(projectId, releaseId), onSuccess: () => { refresh(); toast.success('Deploy paketi oluşturuldu.'); }, onError: mutationOptions.onError });

    if (isLoading || !data) return <Card><CardContent className="py-8 text-sm text-muted-foreground">Kalite yönetişimi yükleniyor…</CardContent></Card>;
    const { preview, latestRound } = data;
    const dimensions = preview.metrics.dimensions;
    const trend = preview.metrics.trend;
    const currentDecision = latestRound?.decisions.find((item) => item.userId === user?.id);
    const isStakeholder = Boolean(user && latestRound?.requiredStakeholderIds.includes(user.id));
    const gateTone = preview.qualityResult === 'READY' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' : preview.qualityResult === 'CONDITIONAL' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700' : 'border-destructive/30 bg-destructive/10 text-destructive';

    return <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
            <div><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />Kalite kapısı ve deploy mutabakatı <HelpTooltip label="Kalite kapısı" description="Test kanıtı, hata riski, kapsam ve istatistiksel güveni birlikte değerlendirerek release kararını korur." /></CardTitle><p className="mt-1 text-sm text-muted-foreground">Kapsam dondurulur, tüm paydaşların gerekçeli onayı olmadan paket oluşturulamaz.</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className={gateTone}>{preview.qualityResult}</Badge><GlossaryTerm term="TIER" showIcon><span className="sr-only">Proje kalite seviyesi</span></GlossaryTerm><Select value={preview.manifest.project.qualityTier} onValueChange={(value) => tierMutation.mutate(value as ProjectQualityTier)} disabled={!canManage || tierMutation.isPending}><SelectTrigger className="w-32" aria-label="Proje kalite seviyesini seçin"><SelectValue /></SelectTrigger><SelectContent>{['TIER_0','TIER_1','TIER_2','TIER_3'].map((tier) => <SelectItem key={tier} value={tier}>{tier.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">Pass oranı / eşik</span><div className="mt-1 text-2xl font-semibold">%{preview.metrics.passRate} <span className="text-sm text-muted-foreground">/ %{preview.policy.minPassRate}</span></div><Progress className="mt-3" value={preview.metrics.passRate} /></div>
                <div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">Yürütme / eşik</span><div className="mt-1 text-2xl font-semibold">%{preview.metrics.executionRate} <span className="text-sm text-muted-foreground">/ %{preview.policy.minExecutionRate}</span></div><Progress className="mt-3" value={preview.metrics.executionRate} /></div>
                <div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">Kritik / yüksek hata</span><div className="mt-1 text-2xl font-semibold">{preview.metrics.criticalOpenBugs} / {preview.metrics.highOpenBugs}</div></div>
                <div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">Paket kapsamı</span><div className="mt-1 text-2xl font-semibold">{preview.manifest.workItems.length} iş · {preview.manifest.testRuns.length} koşum</div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border bg-primary/[0.03] p-4"><span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bileşik kalite skoru <HelpTooltip label="Bileşik kalite skoru" description="Pass güveni, yürütme, kapsam, izlenebilirlik, hata sağlığı ve kanıt miktarını geometrik modelle birleştirir." /></span><div className="mt-1 text-3xl font-semibold">{dimensions.qualityScore}<span className="text-base text-muted-foreground"> / 100</span></div><p className="mt-2 text-xs text-muted-foreground"><GlossaryTerm term="TIER">Tier</GlossaryTerm> eşiği: {preview.policy.minQualityScore}. Geometrik model zayıf bir boyutun diğerleriyle gizlenmesini engeller.</p></div>
                <div className="rounded-xl border p-4"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground"><GlossaryTerm term="WILSON">%95 pass güven aralığı</GlossaryTerm></span><div className="mt-1 text-3xl font-semibold">%{dimensions.passConfidenceLower}–%{dimensions.passConfidenceUpper}</div><p className="mt-2 text-xs text-muted-foreground">Wilson alt sınır eşiği: %{preview.policy.minPassConfidence}. Örneklem: {preview.metrics.executed} test.</p></div>
                <div className="rounded-xl border p-4"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regresyon eğilimi</span><div className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Badge variant="outline">{trend.direction}</Badge><span>{trend.slope > 0 ? '+' : ''}{trend.slope} puan/koşum</span></div><p className="mt-2 text-xs text-muted-foreground"><GlossaryTerm term="EWMA">EWMA</GlossaryTerm> %{trend.ewma} · oynaklık {trend.volatility} · {trend.sampleSize} koşum</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[['Test yürütme', dimensions.executionRate], ['Onaylı kapsam', dimensions.coverageRate], ['İzlenebilirlik', dimensions.traceabilityRate], ['Hata sağlığı', dimensions.defectIntegrity], ['Kanıt güveni', dimensions.evidenceConfidence]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><strong>%{value}</strong></div><Progress className="mt-2 h-1.5" value={Number(value)} /></div>)}
            </div>
            {[...preview.blockers, ...preview.warnings].length > 0 && <div className="space-y-2">{preview.blockers.map((message) => <div key={message} className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>)}{preview.warnings.map((message) => <div key={message} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">{message}</div>)}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><div><p className="font-medium">{latestRound ? `Mutabakat turu #${latestRound.roundNumber}` : 'Henüz mutabakat turu yok'}</p><p className="text-xs text-muted-foreground">Kapsam hash: {(latestRound?.scopeSnapshot.scopeHash || preview.scopeHash).slice(0, 16)}…</p></div>{canFinalize && latestRound?.status !== 'AWAITING_CONSENSUS' && latestRound?.status !== 'CONSENSUS_REACHED' ? <Button onClick={() => roundMutation.mutate()} disabled={roundMutation.isPending}><Users className="mr-2 h-4 w-4" />{preview.qualityResult === 'BLOCKED' ? 'Risk istisnası mutabakatı başlat' : 'Mutabakatı başlat'}</Button> : null}</div>
            {latestRound && <div className="space-y-3"><div className="flex items-center gap-2"><Badge variant="secondary">{latestRound.status}</Badge><span className="text-sm text-muted-foreground">{latestRound.decisions.length}/{latestRound.requiredStakeholderIds.length} karar kaydedildi</span></div>{data.stakeholders.map((stakeholder) => { const vote = latestRound.decisions.find((item) => item.userId === stakeholder.id); return <div key={stakeholder.id} className="rounded-xl border px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{stakeholder.firstName} {stakeholder.lastName}</span><Badge variant={vote ? 'outline' : 'secondary'}>{vote?.decision || 'BEKLENİYOR'}</Badge></div>{vote && <p className="mt-2 text-sm text-muted-foreground">{vote.rationale}</p>}</div>; })}</div>}
            {latestRound?.status === 'AWAITING_CONSENSUS' && isStakeholder && <div className="rounded-xl border bg-muted/20 p-4"><p className="mb-3 font-medium">Kararınız {currentDecision ? `(${currentDecision.decision})` : ''}</p><div className="grid gap-3 md:grid-cols-[240px_1fr_auto]"><Select value={decision} onValueChange={(value) => setDecision(value as StakeholderDecision)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="APPROVE">Onayla</SelectItem><SelectItem value="APPROVE_WITH_RESERVATION">Şerhli onayla</SelectItem><SelectItem value="REJECT">Reddet</SelectItem><SelectItem value="ABSTAIN">Çekimser</SelectItem></SelectContent></Select><Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Riskleri, koşulları ve gerekçenizi açıklayın (en az 10 karakter)" /><Button onClick={() => decisionMutation.mutate()} disabled={rationale.trim().length < 10 || decisionMutation.isPending}>Kararı kaydet</Button></div></div>}
            {latestRound?.status === 'CONSENSUS_REACHED' && canFinalize && <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-medium">Tam mutabakat sağlandı.</span></div><Button onClick={() => packageMutation.mutate()} disabled={packageMutation.isPending}><PackageCheck className="mr-2 h-4 w-4" />Deploy paketi oluştur</Button></div>}
            {data.packages.length > 0 && <div className="space-y-2"><p className="font-medium">Deploy paketleri</p>{data.packages.map((item) => <details key={item.id} className="rounded-lg border px-3 py-2 text-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span>Paket #{item.packageNumber} · {item.status}</span><code className="text-xs text-muted-foreground">{item.packageHash.slice(0, 16)}…</code></summary><div className="mt-3 grid gap-4 border-t pt-3 md:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paketteki işler</p>{item.manifest.workItems?.length ? item.manifest.workItems.map((workItem) => <div key={workItem.id} className="py-1"><span className="font-medium">{workItem.key}</span> · {workItem.title} <Badge variant="outline" className="ml-1">{workItem.status}</Badge></div>) : <p className="text-muted-foreground">İş kaydı yok.</p>}</div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test kanıtları</p>{item.manifest.testRuns?.length ? item.manifest.testRuns.map((run) => <div key={run.id} className="py-1"><span className="font-medium">{run.key}</span> · {run.title} <Badge variant="outline" className="ml-1">{run.status}</Badge></div>) : <p className="text-muted-foreground">Test koşumu yok.</p>}</div></div></details>)}</div>}
        </CardContent>
    </Card>;
}
