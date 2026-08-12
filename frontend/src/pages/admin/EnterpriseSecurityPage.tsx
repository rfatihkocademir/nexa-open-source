import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Download, LockKeyhole, Network, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { enterpriseSecurityService, type SecurityPolicy } from '@/services/enterprise-security.service';
import { PageHeader } from '@/components/layout/PageChrome';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { LegalHold } from '@/services/enterprise-security.service';

type PolicyForm = Omit<SecurityPolicy, 'organizationId' | 'updatedAt'>;

export default function EnterpriseSecurityPage() {
    const client = useQueryClient();
    const policyQuery = useQuery({ queryKey: ['enterprise-security-policy'], queryFn: enterpriseSecurityService.getPolicy });
    const projectsQuery = useQuery({ queryKey: ['enterprise-project-security'], queryFn: enterpriseSecurityService.listProjects });
    const legalHoldsQuery = useQuery({ queryKey: ['enterprise-legal-holds'], queryFn: enterpriseSecurityService.listLegalHolds });
    const retentionQuery = useQuery({ queryKey: ['enterprise-retention-preview'], queryFn: enterpriseSecurityService.retentionPreview });
    const [form, setForm] = useState<PolicyForm>();
    const [ipText, setIpText] = useState<string>();
    const [holdForm, setHoldForm] = useState({ projectId: 'organization', title: '', reason: '', reference: '' });
    const [releaseTarget, setReleaseTarget] = useState<LegalHold>();
    const [releaseReason, setReleaseReason] = useState('');
    const loadedForm: PolicyForm | undefined = policyQuery.data ? {
        enforceSso: policyQuery.data.enforceSso,
        requireMfa: policyQuery.data.requireMfa,
        allowedIpRanges: policyQuery.data.allowedIpRanges,
        sessionIdleMinutes: policyQuery.data.sessionIdleMinutes,
        sessionMaxMinutes: policyQuery.data.sessionMaxMinutes,
        auditRetentionDays: policyQuery.data.auditRetentionDays,
        dataResidency: policyQuery.data.dataResidency,
    } : undefined;
    const currentForm = form ?? loadedForm;
    const currentIpText = ipText ?? loadedForm?.allowedIpRanges.join('\n') ?? '';

    const save = useMutation({
        mutationFn: () => enterpriseSecurityService.updatePolicy({ ...currentForm!, allowedIpRanges: currentIpText.split(/[,\n]/).map((value) => value.trim()).filter(Boolean) }),
        onSuccess: () => { toast.success('Güvenlik politikası kaydedildi. Yeniden giriş yapmanız gerekecek.'); void client.invalidateQueries({ queryKey: ['enterprise-security-policy'] }); },
        onError: (error: Error) => toast.error(error.message || 'Politika kaydedilemedi'),
    });
    const updateProject = useMutation({
        mutationFn: ({ id, dataClassification, requireExplicitAdminMembership }: { id: string; dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'; requireExplicitAdminMembership: boolean }) => enterpriseSecurityService.updateProject(id, { dataClassification, requireExplicitAdminMembership }),
        onSuccess: () => { toast.success('Proje güvenliği güncellendi'); void client.invalidateQueries({ queryKey: ['enterprise-project-security'] }); },
        onError: (error: Error) => toast.error(error.message || 'Proje güvenliği güncellenemedi'),
    });
    const createHold = useMutation({
        mutationFn: () => enterpriseSecurityService.createLegalHold({ projectId: holdForm.projectId === 'organization' ? null : holdForm.projectId, title: holdForm.title, reason: holdForm.reason, reference: holdForm.reference || undefined }),
        onSuccess: () => { toast.success('Legal hold etkinleştirildi'); setHoldForm({ projectId: 'organization', title: '', reason: '', reference: '' }); void client.invalidateQueries({ queryKey: ['enterprise-legal-holds'] }); void client.invalidateQueries({ queryKey: ['enterprise-retention-preview'] }); },
        onError: (error: Error) => toast.error(error.message || 'Legal hold oluşturulamadı'),
    });
    const releaseHold = useMutation({
        mutationFn: () => enterpriseSecurityService.releaseLegalHold(releaseTarget!.id, releaseReason),
        onSuccess: () => { toast.success('Legal hold kontrollü olarak kaldırıldı'); setReleaseTarget(undefined); setReleaseReason(''); void client.invalidateQueries({ queryKey: ['enterprise-legal-holds'] }); void client.invalidateQueries({ queryKey: ['enterprise-retention-preview'] }); },
        onError: (error: Error) => toast.error(error.message || 'Legal hold kaldırılamadı'),
    });
    const exportData = useMutation({
        mutationFn: enterpriseSecurityService.exportOrganization,
        onSuccess: (blob) => {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `nexa-kurum-verisi-${new Date().toISOString().slice(0, 10)}.ndjson.gz`;
            anchor.click();
            URL.revokeObjectURL(url);
            toast.success('Kurum dışa aktarımı tamamlandı');
        },
        onError: (error: Error) => toast.error(error.message || 'Kurum verisi dışa aktarılamadı'),
    });

    if (!currentForm) return <div className="page-shell space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
    return <div className="page-shell page-stack">
        <PageHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />Kurumsal güvenlik</span>} description="Kimlik, ağ, oturum ve hassas proje erişim kurallarını kurum genelinde tek noktadan yönetin." />
        <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Kimlik ve oturum politikası</CardTitle><CardDescription>Politika kaydedildiğinde mevcut oturumlar sonlandırılır.</CardDescription></CardHeader><CardContent className="space-y-5">
                <PolicyToggle label="Kurumsal SSO’yu zorunlu kıl" description="Parola ile girişi kapatır; önce etkin OIDC sağlayıcısı gerekir." checked={currentForm.enforceSso} onChange={(enforceSso) => setForm({ ...currentForm, enforceSso })} />
                <PolicyToggle label="MFA’yı zorunlu kıl" description="MFA’sı eksik aktif kullanıcı varken etkinleştirilemez." checked={currentForm.requireMfa} onChange={(requireMfa) => setForm({ ...currentForm, requireMfa })} />
                <div className="grid gap-4 sm:grid-cols-2"><NumberField label="Boşta kalma (dk)" value={currentForm.sessionIdleMinutes} onChange={(sessionIdleMinutes) => setForm({ ...currentForm, sessionIdleMinutes })} /><NumberField label="Azami oturum (dk)" value={currentForm.sessionMaxMinutes} onChange={(sessionMaxMinutes) => setForm({ ...currentForm, sessionMaxMinutes })} /><NumberField label="Denetim kaydı saklama (gün)" value={currentForm.auditRetentionDays} onChange={(auditRetentionDays) => setForm({ ...currentForm, auditRetentionDays })} /><div className="space-y-2"><Label>Veri yerleşimi</Label><Select value={currentForm.dataResidency} onValueChange={(dataResidency: PolicyForm['dataResidency']) => setForm({ ...currentForm, dataResidency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TR">Türkiye</SelectItem><SelectItem value="EU">Avrupa Birliği</SelectItem><SelectItem value="GLOBAL">Global</SelectItem></SelectContent></Select></div></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" />İzin verilen ağlar</CardTitle><CardDescription>Her satıra bir IP veya CIDR yazın. Boş bırakılırsa tüm ağlara izin verilir.</CardDescription></CardHeader><CardContent className="space-y-3"><textarea className="min-h-40 w-full rounded-lg border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" value={currentIpText} onChange={(event) => setIpText(event.target.value)} placeholder={'203.0.113.10\n10.0.0.0/8\n2001:db8::/32'} /><p className="text-xs text-muted-foreground">Dikkat: Kendi ağınızı eklemeden kısıtı kaydetmek erişiminizi engelleyebilir.</p></CardContent></Card>
        </div>
        <div className="flex justify-end"><Button data-testid="admin-security-save-policy-btn" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Kaydediliyor…' : 'Politikayı kaydet'}</Button></div>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Proje veri sınıflandırması</CardTitle><CardDescription>Kısıtlı projelerde yönetici dahil herkes için açık proje üyeliği isteyebilirsiniz.</CardDescription></CardHeader><CardContent className="space-y-2">
            {projectsQuery.data?.map((project) => <div key={project.id} className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[minmax(220px,1fr)_190px_220px]">
                <div><div className="font-medium">{project.name} <Badge variant="outline">{project.key}</Badge></div><div className="text-xs text-muted-foreground">{project.memberCount} üye · {project.status}</div></div>
                <Select value={project.dataClassification} onValueChange={(dataClassification: typeof project.dataClassification) => updateProject.mutate({ id: project.id, dataClassification, requireExplicitAdminMembership: project.requireExplicitAdminMembership })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUBLIC">Herkese açık</SelectItem><SelectItem value="INTERNAL">Kurum içi</SelectItem><SelectItem value="CONFIDENTIAL">Gizli</SelectItem><SelectItem value="RESTRICTED">Kısıtlı</SelectItem></SelectContent></Select>
                <div className="flex items-center justify-between gap-3"><Label htmlFor={`explicit-${project.id}`} className="text-sm">Yöneticiden açık üyelik iste</Label><Switch id={`explicit-${project.id}`} checked={project.requireExplicitAdminMembership} onCheckedChange={(requireExplicitAdminMembership) => updateProject.mutate({ id: project.id, dataClassification: project.dataClassification, requireExplicitAdminMembership })} /></div>
            </div>)}
        </CardContent></Card>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" />Legal hold</CardTitle><CardDescription>Hukuki inceleme, denetim veya soruşturma süresince kurum ya da proje verilerinin kalıcı silinmesini durdurun.</CardDescription></CardHeader><CardContent className="space-y-4">
                <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                    <div className="space-y-2"><Label>Kapsam</Label><Select value={holdForm.projectId} onValueChange={(projectId) => setHoldForm({ ...holdForm, projectId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="organization">Tüm kurum</SelectItem>{projectsQuery.data?.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Başlık</Label><Input value={holdForm.title} onChange={(event) => setHoldForm({ ...holdForm, title: event.target.value })} placeholder="Örn. 2026 bağımsız denetimi" /></div>
                    <div className="space-y-2"><Label>Referans</Label><Input value={holdForm.reference} onChange={(event) => setHoldForm({ ...holdForm, reference: event.target.value })} placeholder="Dava, olay veya denetim numarası" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>Gerekçe</Label><Textarea value={holdForm.reason} onChange={(event) => setHoldForm({ ...holdForm, reason: event.target.value })} placeholder="Verilerin neden korunması gerektiğini en az 10 karakterle açıklayın." /></div>
                    <div className="md:col-span-2 flex justify-end"><Button data-testid="admin-security-create-hold-btn" onClick={() => createHold.mutate()} disabled={createHold.isPending || holdForm.title.trim().length < 3 || holdForm.reason.trim().length < 10}>{createHold.isPending ? 'Etkinleştiriliyor…' : 'Legal hold etkinleştir'}</Button></div>
                </div>
                <div className="space-y-2">{legalHoldsQuery.data?.map((hold) => <div key={hold.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{hold.title}</span><Badge variant={hold.status === 'ACTIVE' ? 'destructive' : 'secondary'}>{hold.status === 'ACTIVE' ? 'Aktif' : 'Kaldırıldı'}</Badge><Badge variant="outline">{hold.projectId ? `${hold.projectKey} · ${hold.projectName}` : 'Tüm kurum'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{hold.reason}</p><p className="mt-1 text-xs text-muted-foreground">{hold.createdByName} · {new Date(hold.createdAt).toLocaleString('tr-TR')}{hold.reference ? ` · ${hold.reference}` : ''}</p>{hold.releaseReason && <p className="mt-2 text-xs">Kaldırma: {hold.releaseReason}</p>}</div>{hold.status === 'ACTIVE' && <Button data-testid="admin-security-release-hold-btn" variant="outline" onClick={() => setReleaseTarget(hold)}>Kontrollü kaldır</Button>}</div>)}</div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5" />Saklama ve taşınabilirlik</CardTitle><CardDescription>Sistem otomatik silme yapmadan önce etkilenecek kayıtları gösterir.</CardDescription></CardHeader><CardContent className="space-y-3">{retentionQuery.data ? <><Metric label="Denetim saklama süresi" value={`${retentionQuery.data.auditRetentionDays} gün`} /><Metric label="Süresi dolmuş denetim kaydı" value={retentionQuery.data.expiredAuditLogs} /><Metric label="Soft-delete test case" value={retentionQuery.data.softDeletedCases} /><Metric label="Soft-delete work item" value={retentionQuery.data.softDeletedWorkItems} /><Metric label="Aktif legal hold" value={retentionQuery.data.activeHolds} /><Badge variant={retentionQuery.data.purgeAllowed ? 'outline' : 'destructive'}>{retentionQuery.data.purgeAllowed ? 'Temizleme değerlendirilebilir' : 'Temizleme legal hold nedeniyle kilitli'}</Badge><p className="text-xs text-muted-foreground">Güvenli varsayılan: yalnızca önizleme. Otomatik kalıcı silme etkin değildir.</p><Button data-testid="admin-security-export-btn" className="w-full" variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}><Download className="mr-2 h-4 w-4" />{exportData.isPending ? 'Dışa aktarılıyor…' : 'Kurum verisini dışa aktar'}</Button><p className="text-xs text-muted-foreground">Sayfalı NDJSON + gzip. Parolalar, tokenlar ve secret değerler dahil edilmez.</p></> : <Skeleton className="h-36" />}</CardContent></Card>
        </div>
        <Dialog open={Boolean(releaseTarget)} onOpenChange={(open) => { if (!open) { setReleaseTarget(undefined); setReleaseReason(''); } }}><DialogContent><DialogHeader><DialogTitle>Legal hold kaldırılsın mı?</DialogTitle><DialogDescription>Bu işlem yeniden kalıcı silmeye izin verebilir ve denetim kaydına yazılır.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Kaldırma gerekçesi</Label><Textarea value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} placeholder="Yetkili kararını ve gerekçeyi en az 10 karakterle açıklayın." /></div><DialogFooter><Button variant="outline" onClick={() => setReleaseTarget(undefined)}>Vazgeç</Button><Button data-testid="admin-security-release-confirm-btn" variant="destructive" onClick={() => releaseHold.mutate()} disabled={releaseReason.trim().length < 10 || releaseHold.isPending}>{releaseHold.isPending ? 'Kaldırılıyor…' : 'Hold’u kaldır'}</Button></DialogFooter></DialogContent></Dialog>
    </div>;
}

function PolicyToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><Label className="text-sm font-medium">{label}</Label><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch aria-label={label} checked={checked} onCheckedChange={onChange} /></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input aria-label={label} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"><span className="text-sm text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>; }
