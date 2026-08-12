export const releaseStatusTone: Record<string, string> = {
    READY: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    CONDITIONAL: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    NOT_READY: 'bg-red-500/15 text-red-700 border-red-500/30',
    RELEASED: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
    CANCELLED: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
    DRAFT: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
};

export function formatReleaseStatus(value: string) {
    return value.replace(/_/g, ' ');
}
