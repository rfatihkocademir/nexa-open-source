import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckCircle2, HelpCircle, Kanban, Rocket, Search, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { productGlossary, glossaryText, type GlossaryKey } from '@/lib/productGlossary';

const STORAGE_KEY = 'nexa-help-welcome-seen-v1';

export function HelpCenter({ projectContext = false, context = 'overview', role = 'TESTER' }: { projectContext?: boolean; context?: string; role?: string }) {
    const { i18n } = useTranslation();
    const tr = i18n.language.startsWith('tr');
    const [open, setOpen] = useState(false);
    const [isNew, setIsNew] = useState(() => !window.localStorage.getItem(STORAGE_KEY));
    const [query, setQuery] = useState('');
    const copy = tr ? {
        title: 'Nexa Yardım Merkezi', description: 'Bulunduğunuz ekranı ve temel kavramları hızla öğrenin.', search: 'Terim veya konu ara…', quick: 'Hızlı başlangıç', glossary: 'Terimler ve kısaltmalar', empty: 'Aramanızla eşleşen terim bulunamadı.', button: 'Yardım ve terimler', tour: 'İnteraktif ürün turunu başlat',
        steps: [
            ['Backlog ile planlayın', 'İhtiyaçları epic, story, task ve bug olarak parçalayıp önceliklendirin.'],
            ['Agile Board ile ilerletin', 'İşleri durumlar arasında taşıyın; WIP kuralları ve workflow politikaları süreci korur.'],
            ['Test kanıtı oluşturun', 'Test case\'leri koşumlara ekleyin; pass, fail ve bloklu sonuçları kanıtlarıyla kaydedin.'],
            ['Release kararı verin', 'Kapsam, kalite skoru, riskler ve paydaş onayları tamamlandığında deploy paketi oluşturun.'],
        ],
    } : {
        title: 'Nexa Help Center', description: 'Quickly learn the current screen and core concepts.', search: 'Search a term or topic…', quick: 'Quick start', glossary: 'Terms and abbreviations', empty: 'No term matches your search.', button: 'Help and terminology', tour: 'Start interactive product tour',
        steps: [
            ['Plan with the backlog', 'Break needs into epics, stories, tasks, and bugs, then prioritize them.'],
            ['Progress on the Agile Board', 'Move work through statuses while WIP and workflow policies protect the process.'],
            ['Build test evidence', 'Add test cases to runs and record pass, fail, or blocked results with evidence.'],
            ['Make a release decision', 'Create a deploy package when scope, quality, risks, and stakeholder approvals are complete.'],
        ],
    };
    const icons = [BookOpen, Kanban, TestTube2, Rocket];
    const contextGuides: Record<string, [string, string, string]> = tr ? {
        overview: ['Proje genel bakışı', 'Projenin sağlığını, ilerlemesini ve son aktivitelerini buradan izleyin.', 'Sonraki adım: Backlog\'daki öncelikli işleri kontrol edin.'],
        backlog: ['Backlog', 'Henüz sprintte olmayan veya planlanmayı bekleyen işleri önceliklendirin ve parçalayın.', 'Sonraki adım: Hazır işleri sprint kapsamına alın.'],
        board: ['Agile Board', 'Aktif işleri workflow durumlarında ilerletin; WIP limitleri ekip odağını korur.', 'Sonraki adım: Bloklu ve uzun süre hareketsiz kalan işleri inceleyin.'],
        'test-cases': ['Test case alanı', 'Beklenen davranışı tekrar kullanılabilir test adımlarına dönüştürün.', 'Sonraki adım: Onaylanan testleri bir test koşumuna ekleyin.'],
        'test-runs': ['Test koşumları', 'Belirli sürüm ve ortam için test sonuçlarını ve kanıtları kaydedin.', 'Sonraki adım: Fail ve bloklu sonuçları bug kayıtlarına bağlayın.'],
        runs: ['Test koşumları', 'Belirli sürüm ve ortam için test sonuçlarını ve kanıtları kaydedin.', 'Sonraki adım: Fail ve bloklu sonuçları bug kayıtlarına bağlayın.'],
        traceability: ['İzlenebilirlik', 'Gereksinim, iş, test ve bug bağlantılarındaki boşlukları bulun.', 'Sonraki adım: Kaynağı veya test kanıtı olmayan kayıtları tamamlayın.'],
        releases: ['Release Hub', 'Canlıya alınacak kapsamı, kalite kanıtını ve paydaş kararlarını yönetin.', 'Sonraki adım: Kalite kapısını kontrol edip mutabakat turunu başlatın.'],
    } : {
        overview: ['Project overview', 'Monitor project health, progress, and recent activity.', 'Next: review priority work in the backlog.'],
        backlog: ['Backlog', 'Prioritize and break down work that is not yet in a sprint.', 'Next: move ready work into sprint scope.'],
        board: ['Agile Board', 'Progress active work through workflow statuses while WIP limits protect focus.', 'Next: review blocked and stale work.'],
        'test-cases': ['Test case workspace', 'Turn expected behavior into reusable test steps.', 'Next: add approved tests to a test run.'],
        'test-runs': ['Test runs', 'Record results and evidence for a specific version and environment.', 'Next: link failed and blocked results to defects.'],
        runs: ['Test runs', 'Record results and evidence for a specific version and environment.', 'Next: link failed and blocked results to defects.'],
        traceability: ['Traceability', 'Find gaps between requirements, work, tests, and defects.', 'Next: complete records without origin or test evidence.'],
        releases: ['Release Hub', 'Manage deploy scope, quality evidence, and stakeholder decisions.', 'Next: review the quality gate and start consensus.'],
    };
    const contextGuide = contextGuides[context] ?? contextGuides.overview;
    const roleGuides: Record<string, string> = tr ? {
        ADMIN: 'Yönetici odağı: önce proje rollerini, güvenlik politikalarını ve entegrasyon sağlığını kontrol edin.',
        TESTER: 'Test uzmanı odağı: atanmış koşumları, test kanıtlarını ve yeniden test bekleyen bug\'ları kontrol edin.',
        TEAM_LEADER: 'Takım lideri odağı: WIP birikimini, bloklu işleri, haftalık kapasiteyi ve release risklerini kontrol edin.',
        PRODUCT_OWNER: 'Ürün sahibi odağı: backlog önceliğini, kabul kriterlerini, kapsam kararlarını ve release içeriğini kontrol edin.',
        SCRUM_MASTER: 'Scrum Master odağı: akış darboğazlarını, WIP limitlerini, sprint ilerlemesini ve ekip kapasitesini kontrol edin.',
        DEVELOPER: 'Geliştirici odağı: size atanan işleri, workflow koşullarını, açık bug\'ları ve test geri bildirimlerini kontrol edin.',
        ANALYST: 'Analist odağı: gereksinimlerin kabul kriterlerini, izlenebilirlik bağlantılarını ve kapsam boşluklarını kontrol edin.',
    } : {
        ADMIN: 'Admin focus: review project roles, security policies, and integration health first.', TESTER: 'Tester focus: review assigned runs, evidence, and defects awaiting retest.', TEAM_LEADER: 'Team leader focus: review WIP, blocked work, weekly capacity, and release risks.', PRODUCT_OWNER: 'Product owner focus: review backlog priority, acceptance criteria, scope decisions, and release contents.', SCRUM_MASTER: 'Scrum Master focus: review flow bottlenecks, WIP limits, sprint progress, and capacity.', DEVELOPER: 'Developer focus: review assigned work, workflow conditions, open defects, and test feedback.', ANALYST: 'Analyst focus: review acceptance criteria, traceability links, and scope gaps.',
    };
    const entries = useMemo(() => (Object.keys(productGlossary) as GlossaryKey[]).map((key) => ({ key, text: glossaryText(key, i18n.language) })).filter(({ key, text }) => `${key} ${text.join(' ')}`.toLocaleLowerCase(i18n.language).includes(query.trim().toLocaleLowerCase(i18n.language))), [i18n.language, query]);
    const handleOpen = (next: boolean) => {
        setOpen(next);
        if (next && isNew) {
            window.localStorage.setItem(STORAGE_KEY, 'true');
            setIsNew(false);
        }
    };

    return <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="icon" className="relative text-sidebar-foreground/70" aria-label={copy.button} title={copy.button} data-tour="help-center"><HelpCircle className="h-5 w-5" />{isNew && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" aria-hidden="true" />}</Button></DialogTrigger>
        <DialogContent className="flex max-h-[min(88dvh,860px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b px-6 py-5"><DialogTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" />{copy.title}</DialogTitle><DialogDescription>{copy.description}{projectContext && tr ? ' Proje içindeki yardımlar mevcut proje bağlamınıza göre sunulur.' : ''}</DialogDescription></DialogHeader>
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 pb-6 [scrollbar-gutter:stable]">
                <div className="relative my-5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="pl-9" autoFocus /></div>
                {!query && projectContext && <section className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.05] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{tr ? 'Bu ekran ne işe yarar?' : 'What is this screen for?'}</p><h3 className="mt-1 font-semibold">{contextGuide[0]}</h3><p className="mt-1 text-sm text-muted-foreground">{contextGuide[1]}</p><p className="mt-2 text-sm font-medium">{contextGuide[2]}</p><p className="mt-3 border-t border-primary/15 pt-3 text-xs leading-relaxed text-muted-foreground">{roleGuides[role] ?? roleGuides.TESTER}</p></section>}
                {!query && <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{copy.quick}</h3><Button size="sm" onClick={() => { handleOpen(false); window.setTimeout(() => window.dispatchEvent(new Event('nexa:tour:start')), 150); }}>{copy.tour}</Button></div><div className="grid gap-3 sm:grid-cols-2">{copy.steps.map(([title, description], index) => { const Icon = icons[index]; return <article key={title} className="rounded-xl border bg-muted/20 p-4"><div className="flex items-start gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span><div><h4 className="font-semibold">{index + 1}. {title}</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></div></article>; })}</div></section>}
                <section className="mt-6"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{copy.glossary}</h3><div className="grid gap-2">{entries.map(({ key, text: [expanded, description] }) => <article key={key} className="rounded-xl border px-4 py-3"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><h4 className="font-semibold"><span className="text-primary">{key}</span> · {expanded}</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></div></article>)}{entries.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.empty}</p>}</div></section>
            </div>
        </DialogContent>
    </Dialog>;
}
