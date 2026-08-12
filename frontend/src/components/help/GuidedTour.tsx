import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

export function GuidedTour({ projectContext }: { projectContext: boolean }) {
    const { i18n } = useTranslation();
    const tr = i18n.language.startsWith('tr');
    const steps = useMemo(() => [
        { target: '[data-tour="brand"]', title: tr ? 'Nexa ana alanı' : 'Nexa home', description: tr ? 'Logoya tıklayarak ana başlangıç alanına dönebilirsiniz.' : 'Select the logo to return to the main starting area.' },
        ...(projectContext ? [{ target: '[data-tour="project-selector"]', title: tr ? 'Aktif proje' : 'Active project', description: tr ? 'Tüm iş, test ve release verileri bu proje bağlamında çalışır. Buradan projeyi hızla değiştirebilirsiniz.' : 'All work, test, and release data operates in this project context. Switch projects here.' }] : []),
        { target: '[data-tour="primary-navigation"]', title: tr ? 'Ana iş akışı' : 'Primary workflow', description: tr ? 'Planlama, Agile Board, test ve release alanlarına buradan ulaşırsınız. Daha Fazla menüsü ikincil araçları toplar.' : 'Open planning, Agile Board, test, and release areas here. More contains secondary tools.' },
        { target: '[data-tour="global-search"]', title: tr ? 'Hızlı arama ve komutlar' : 'Quick search and commands', description: tr ? 'Kayıtlara gitmek ve komutları çalıştırmak için bu alanı kullanın.' : 'Use this area to navigate to records and run commands.' },
        { target: '[data-tour="help-center"]', title: tr ? 'Yardım merkezi' : 'Help center', description: tr ? 'Kısaltmaları, ürün sözlüğünü ve bu turu istediğiniz zaman yeniden açabilirsiniz.' : 'Reopen abbreviations, the product glossary, and this tour at any time.' },
        { target: '[data-tour="account-menu"]', title: tr ? 'Kişisel ayarlar' : 'Personal settings', description: tr ? 'Profil, dil, tema, ekran yoğunluğu ve güvenlik ayarları burada bulunur.' : 'Profile, language, theme, display density, and security settings are here.' },
    ], [projectContext, tr]);
    const [active, setActive] = useState(false);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);

    const close = useCallback(() => { setActive(false); setIndex(0); setRect(null); }, []);
    useEffect(() => {
        const start = () => { setIndex(0); setActive(true); };
        window.addEventListener('nexa:tour:start', start);
        return () => window.removeEventListener('nexa:tour:start', start);
    }, []);
    useEffect(() => {
        if (!active) return;
        const update = () => {
            const element = document.querySelector(steps[index]?.target) as HTMLElement | null;
            if (!element) { setRect(null); return; }
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const value = element.getBoundingClientRect();
            setRect({ top: value.top - 6, left: value.left - 6, right: value.right + 6, bottom: value.bottom + 6, width: value.width + 12, height: value.height + 12 });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); if (event.key === 'ArrowRight') setIndex((value) => Math.min(steps.length - 1, value + 1)); if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1)); };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.removeEventListener('keydown', onKey); };
    }, [active, close, index, steps]);
    if (!active) return null;
    const step = steps[index];
    const panelTop = rect && rect.bottom + 220 < window.innerHeight ? rect.bottom + 12 : Math.max(12, (rect?.top ?? 100) - 190);
    const panelLeft = Math.min(Math.max(12, rect?.left ?? 12), Math.max(12, window.innerWidth - 372));
    return <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={tr ? 'İnteraktif ürün turu' : 'Interactive product tour'}>
        {rect ? <>
            <div className="fixed left-0 right-0 top-0 bg-black/60" style={{ height: Math.max(0, rect.top) }} />
            <div className="fixed left-0 bg-black/60" style={{ top: rect.top, width: Math.max(0, rect.left), height: rect.height }} />
            <div className="fixed right-0 bg-black/60" style={{ top: rect.top, left: rect.right, height: rect.height }} />
            <div className="fixed bottom-0 left-0 right-0 bg-black/60" style={{ top: rect.bottom }} />
            <div className="pointer-events-none fixed rounded-lg border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
        </> : <div className="fixed inset-0 bg-black/60" />}
        <section className="fixed w-[360px] max-w-[calc(100vw-24px)] rounded-xl border bg-card p-5 text-card-foreground shadow-2xl" style={{ top: panelTop, left: panelLeft }}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{index + 1} / {steps.length}</p><h2 className="mt-1 text-lg font-semibold">{step.title}</h2></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={close} aria-label={tr ? 'Turu kapat' : 'Close tour'} title={tr ? 'Turu kapat' : 'Close tour'}><X className="h-4 w-4" /></Button></div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            <div className="mt-5 flex items-center justify-between"><Button variant="ghost" size="sm" onClick={close}>{tr ? 'Turu geç' : 'Skip tour'}</Button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setIndex((value) => value - 1)} disabled={index === 0}><ChevronLeft className="mr-1 h-4 w-4" />{tr ? 'Geri' : 'Back'}</Button>{index === steps.length - 1 ? <Button size="sm" onClick={close}>{tr ? 'Tamamla' : 'Finish'}</Button> : <Button size="sm" onClick={() => setIndex((value) => value + 1)}>{tr ? 'İleri' : 'Next'}<ChevronRight className="ml-1 h-4 w-4" /></Button>}</div></div>
        </section>
    </div>;
}
