import { Check, LayoutGrid, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { PageQueryError } from '@/components/layout/PageQueryError';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DashboardWidgetCatalogItem, DashboardWidgetType } from '@/types/dashboard-studio';
import { widgetPresentation } from '../dashboard-studio-config';

interface WidgetLibrarySheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    catalog: DashboardWidgetCatalogItem[];
    widgetTypes: DashboardWidgetType[];
    widgetCount: number;
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    onAdd: (item: DashboardWidgetCatalogItem) => void;
}

type CategoryFilter = 'ALL' | DashboardWidgetCatalogItem['category'];

export function WidgetLibrarySheet({ open, onOpenChange, catalog, widgetTypes, widgetCount, loading = false, error = false, onRetry, onAdd }: WidgetLibrarySheetProps) {
    const { t, i18n } = useTranslation();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('ALL');
    const normalizedSearch = search.trim().toLocaleLowerCase(i18n.language);
    const filtered = useMemo(() => catalog.filter((item) => {
        if (category !== 'ALL' && item.category !== category) return false;
        if (!normalizedSearch) return true;
        return `${t(`dashboard_studio.widgets.${item.type}.title`)} ${t(`dashboard_studio.widgets.${item.type}.description`)}`
            .toLocaleLowerCase(i18n.language).includes(normalizedSearch);
    }), [catalog, category, i18n.language, normalizedSearch, t]);
    const categories: CategoryFilter[] = ['ALL', ...Array.from(new Set(catalog.map((item) => item.category)))];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
                <SheetHeader className="border-b px-6 py-5 pr-12">
                    <SheetTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" />{t('dashboard_studio.library.title')}</SheetTitle>
                    <SheetDescription>{t('dashboard_studio.library.description')}</SheetDescription>
                </SheetHeader>
                <div className="space-y-3 border-b px-6 py-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('dashboard_studio.library.search_placeholder')}
                            aria-label={t('dashboard_studio.library.search_label')}
                            className="pl-9"
                        />
                    </div>
                    <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
                        <TabsList className="h-auto w-full flex-wrap justify-start bg-transparent p-0">
                            {categories.map((item) => (
                                <TabsTrigger key={item} value={item} className="h-8 rounded-md border border-transparent px-3 data-[state=active]:border-border data-[state=active]:bg-muted">
                                    {t(`dashboard_studio.library.categories.${item}`)}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('dashboard_studio.library.result_count', { count: filtered.length })}</span>
                        <span>{t('dashboard_studio.library.widget_limit', { current: widgetCount, limit: 30 })}</span>
                    </div>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    {error ? (
                        <div className="p-6"><PageQueryError onRetry={onRetry} /></div>
                    ) : loading ? (
                        <div className="grid gap-3 p-6 sm:grid-cols-2" aria-busy="true">
                            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48 rounded-xl" />)}
                        </div>
                    ) : <>
                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
                        {filtered.map((item) => {
                            const presentation = widgetPresentation[item.type];
                            const Icon = presentation.icon;
                            const addedCount = widgetTypes.filter((type) => type === item.type).length;
                            const limitReached = widgetCount >= 30;
                            return (
                                <article key={item.type} className="flex min-h-48 flex-col rounded-xl border border-border/70 bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${presentation.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
                                        <Badge variant="outline">{t(`dashboard_studio.library.categories.${item.category}`)}</Badge>
                                    </div>
                                    <h3 className="mt-4 text-sm font-semibold">{t(`dashboard_studio.widgets.${item.type}.title`)}</h3>
                                    <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{t(`dashboard_studio.widgets.${item.type}.description`)}</p>
                                    <Button
                                        type="button"
                                        variant={addedCount ? 'outline' : 'secondary'}
                                        size="sm"
                                        className="mt-4 w-full"
                                        disabled={limitReached}
                                        onClick={() => onAdd(item)}
                                    >
                                        {addedCount ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                        {addedCount
                                            ? t('dashboard_studio.library.add_another', { count: addedCount })
                                            : t('dashboard_studio.library.add')}
                                    </Button>
                                </article>
                            );
                        })}
                    </div>
                    {!filtered.length && (
                        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                            <Search className="mb-3 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm font-medium">{t('dashboard_studio.library.no_results')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{t('dashboard_studio.library.no_results_description')}</p>
                        </div>
                    )}
                    </>}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
