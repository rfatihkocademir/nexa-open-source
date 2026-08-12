import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from "zod";
import { Plus, ChevronRight, ChevronDown, FileText, Save, BookOpen, FolderOpen, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { wikiService } from '@/services/wiki.service';
import type { WikiSpace, WikiPage as IWikiPage } from '@/types/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { cn } from '@/lib/utils';
import { marked } from 'marked';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { appRoutes } from '@/lib/routes';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

// Helper to extract content from wiki page content field
// Handles both legacy markdown and new HTML formats
function extractContent(content: unknown): string {
    if (!content) return '';
    let raw = '';
    if (typeof content === 'string') {
        raw = content;
    } else if (typeof content === 'object' && content !== null && 'content' in content) {
        const contentValue = (content as { content?: unknown }).content;
        if (typeof contentValue === 'string') {
            raw = contentValue;
        }
    } else {
        raw = JSON.stringify(content, null, 2);
    }
    
    // If it already looks like HTML, return it directly
    if (/^\s*<[a-z]/i.test(raw)) {
        return sanitizeHtml(raw);
    }
    
    // Otherwise, treat as Markdown and convert to HTML
    marked.setOptions({ breaks: true, gfm: true });
    const parsed = marked.parse(raw);
    return sanitizeHtml(typeof parsed === 'string' ? parsed : raw);
}

const WikiPageTreeItem: React.FC<{ page: IWikiPage; level?: number; activePageId?: string; onSelect: (id: string) => void; onRestore?: (id: string) => void }> = ({ page, level = 0, activePageId, onSelect, onRestore }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(true);
    const hasChildren = page.children && page.children.length > 0;
    const isDeleted = !!(page as any).deletedAt;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm transition-all",
                    isDeleted
                        ? 'opacity-50 text-red-400'
                        : activePageId === page.id
                            ? 'bg-primary/5 font-bold text-primary shadow-[inset_4px_0_0_0_rgba(var(--primary),0.8)] rounded-none border-l-0'
                            : 'text-muted-foreground/80 hover:bg-muted/40 hover:text-foreground font-medium'
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => { if (!isDeleted) onSelect(page.id); }}
            >
                <div
                    className="shrink-0 rounded-md p-0.5 hover:bg-muted"
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                >
                    {hasChildren ? (
                        expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                    ) : <span className="w-3.5 h-3.5 block" />}
                </div>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className={cn("truncate block min-w-0", isDeleted && "line-through")}>{page.title}</span>
                {isDeleted && onRestore && (
                    <PermissionGate permission="wiki.update">
                        <button
                            className="ml-auto shrink-0 rounded-md p-1 text-green-600 hover:bg-green-500/10 hover:text-green-700 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onRestore(page.id); }}
                            title={t('wiki.restore')}
                        >
                            <RotateCcw className="h-3 w-3" />
                        </button>
                    </PermissionGate>
                )}
            </div>
            {expanded && hasChildren && (
                <div className="mt-0.5 space-y-0.5">
                    {page.children!.map(child => (
                        <WikiPageTreeItem key={child.id} page={child} level={level + 1} activePageId={activePageId} onSelect={onSelect} onRestore={onRestore} />
                    ))}
                </div>
            )}
        </div>
    );
};

const WikiPage: React.FC<{ resourceProjectId?: string; initialPageId?: string }> = ({ resourceProjectId, initialPageId }) => {
    const { t, i18n } = useTranslation();
    const { confirm } = useAppDialog();
    const navigate = useNavigate();
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = resourceProjectId ?? routeProjectId;
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const spaceId = searchParams.get('spaceId');
    const pageId = initialPageId ?? searchParams.get('pageId');

    // Editor state
    const [editMode, setEditMode] = useState(false);
    const [editorTitle, setEditorTitle] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [showDeletedPages, setShowDeletedPages] = useState(false);

    const { data: spaces = [] } = useQuery<WikiSpace[]>({
        queryKey: ['wiki-spaces', projectId],
        queryFn: () => wikiService.getSpaces(projectId!),
        enabled: Boolean(projectId),
    });

    const effectiveSpaceId = spaceId ?? spaces[0]?.id ?? '';

    const { data: pageTree = [] } = useQuery<IWikiPage[]>({
        queryKey: ['wiki-page-tree', effectiveSpaceId, showDeletedPages],
        queryFn: () => wikiService.getPageTree(effectiveSpaceId, showDeletedPages),
        enabled: Boolean(effectiveSpaceId),
    });

    const effectivePageId = pageId ?? pageTree[0]?.id ?? '';

    const { data: activePage } = useQuery<IWikiPage>({
        queryKey: ['wiki-page', effectivePageId],
        queryFn: () => wikiService.getPage(effectivePageId),
        enabled: Boolean(effectivePageId),
    });

    const createSpaceMutation = useMutation({
        mutationFn: (name: string) => wikiService.createSpace(projectId!, { name }),
    });

    const createPageMutation = useMutation({
        mutationFn: (payload: { sid: string; parentId?: string }) => wikiService.createPage({
            spaceId: payload.sid,
            title: t('wiki.untitled_page'),
            content: '',
            parentId: payload.parentId,
        }),
    });

    const updatePageMutation = useMutation({
        mutationFn: (payload: { pageId: string; title: string; content: string }) => wikiService.updatePage(payload.pageId, {
            title: payload.title,
            content: { type: 'html', content: payload.content },
        }),
    });

    const refreshTree = useCallback(async (sid: string) => {
        await queryClient.invalidateQueries({ queryKey: ['wiki-page-tree', sid] });
    }, [queryClient]);

    const startEditMode = useCallback(() => {
        if (!activePage) return;
        setEditorTitle(activePage.title);
        setEditorContent(extractContent(activePage.content));
        setEditMode(true);
    }, [activePage]);

    const handleCreatePage = async () => {
        if (!effectiveSpaceId) return;
        try {
            const newPage = await createPageMutation.mutateAsync({
                sid: effectiveSpaceId,
                parentId: activePage?.id
            });
            await refreshTree(effectiveSpaceId);
            if (newPage.key) {
                navigate(appRoutes.resource(newPage.key), { replace: true });
                return;
            }
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('spaceId', effectiveSpaceId);
                next.set('pageId', newPage.id);
                return next;
            });
            // Set empty title so user can type fresh (not append to "Untitled Page")
            setEditorTitle('');
            setEditorContent('');
            setEditMode(true);
        } catch {
            toast.error(t('wiki.toast.create_page_error'));
        }
    };

    const handleSave = async () => {
        if (!activePage || !effectiveSpaceId) return;
        try {
            await updatePageMutation.mutateAsync({
                pageId: activePage.id,
                title: editorTitle,
                content: editorContent
            });
            queryClient.invalidateQueries({ queryKey: ['wiki-page', activePage.id] });
            await refreshTree(effectiveSpaceId);
            toast.success(t('wiki.toast.page_updated'));
            setEditMode(false);
        } catch {
            toast.error(t('wiki.toast.update_error'));
        }
    };

    const handleDeletePage = async () => {
        if (!activePage) return;
        if (!await confirm({
            description: t('wiki.delete_confirm', 'Bu sayfayı silmek istediğinizden emin misiniz?'),
            confirmLabel: t('common.delete'),
            destructive: true,
        })) return;
        
        try {
            await wikiService.deletePage(activePage.id);
            toast.success(t('wiki.toast.page_deleted', 'Sayfa silindi'));
            queryClient.invalidateQueries({ queryKey: ['wiki-page-tree'] });
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('pageId');
                return next;
            });
        } catch {
            toast.error(t('wiki.toast.delete_error', 'Silme işlemi başarısız'));
        }
    };

    return (
        <div className="page-shell-wide flex h-[calc(100vh-140px)] min-h-0 w-full overflow-hidden rounded-xl border border-border/50 bg-card shadow-xl shadow-black/5">
            {/* Sidebar */}
            <div className="flex w-72 shrink-0 flex-col border-r border-border/50 bg-muted/20">
                <div className="border-b border-border/50 p-5 bg-muted/10">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary/80" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('wiki.space_label')}</label>
                        </div>
                        <select
                            data-testid="wiki-space-select"
                            className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-[13px] font-semibold text-foreground/80 shadow-none transition-all hover:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            value={effectiveSpaceId}
                            onChange={(e) => {
                                setEditMode(false);
                                setSearchParams(prev => {
                                    const next = new URLSearchParams(prev);
                                    next.set('spaceId', e.target.value);
                                    next.delete('pageId');
                                    return next;
                                });
                            }}
                        >
                            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <PermissionGate permission="wiki:write">
                            <FormDialog
                                title={t('wiki.new_space')}
                                description={t('wiki.create_space_desc')}
                                trigger={
                                    <Button data-testid="wiki-new-space-btn" variant="outline" size="sm" className="h-9 w-full rounded-lg border-border/50 bg-background/50 text-[11px] font-bold uppercase tracking-wider hover:bg-primary/5 hover:text-primary transition-all">
                                        <Plus className="w-3.5 h-3.5 mr-2" /> {t('wiki.new_space')}
                                    </Button>
                                }
                                schema={z.object({
                                    name: z.string().min(1, t('wiki.validation.space_name_required'))
                                })}
                                defaultValues={{ name: '' }}
                                submitText={t('common.create')}
                                onSubmit={async (data) => {
                                    try {
                                        const space = await createSpaceMutation.mutateAsync(data.name);
                                        await queryClient.invalidateQueries({ queryKey: ['wiki-spaces', projectId] });
                                        setSearchParams(prev => {
                                            const next = new URLSearchParams(prev);
                                            next.set('spaceId', space.id);
                                            next.delete('pageId');
                                            return next;
                                        });
                                        toast.success(t('wiki.toast.space_created'));
                                    } catch {
                                        toast.error(t('wiki.toast.create_space_error'));
                                    }
                                }}
                                renderFields={(form) => (
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('wiki.space_label')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('wiki.space_name_placeholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            />
                        </PermissionGate>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    <div className="mb-2 mt-2 flex items-center justify-between px-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('wiki.pages')}</span>
                        <div className="flex items-center gap-1">
                            <PermissionGate permission="wiki.update">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-6 w-6 rounded-lg", showDeletedPages ? "text-red-500" : "text-muted-foreground hover:text-foreground")}
                                    onClick={() => setShowDeletedPages(!showDeletedPages)}
                                    title={showDeletedPages ? t('wiki.hide_deleted') : t('wiki.show_deleted')}
                                >
                                    {showDeletedPages ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                            </PermissionGate>
                            <PermissionGate permission="wiki:write">
                                <Button data-testid="wiki-new-page-btn" variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground" onClick={handleCreatePage}>
                                    <Plus className="w-3 h-3" />
                                    <span className="sr-only">{t('common.create')}</span>
                                </Button>
                            </PermissionGate>
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        {pageTree.map(page => (
                            <WikiPageTreeItem
                                key={page.id}
                                page={page}
                                activePageId={effectivePageId}
                                onSelect={(id) => {
                                    setEditMode(false);
                                    const findPage = (pages: IWikiPage[]): IWikiPage | undefined => {
                                        for (const candidate of pages) {
                                            if (candidate.id === id) return candidate;
                                            const child = candidate.children ? findPage(candidate.children) : undefined;
                                            if (child) return child;
                                        }
                                    };
                                    const selectedPage = findPage(pageTree);
                                    if (selectedPage?.key) {
                                        navigate(appRoutes.resource(selectedPage.key));
                                        return;
                                    }
                                    setSearchParams(prev => {
                                        const next = new URLSearchParams(prev);
                                        next.set('spaceId', effectiveSpaceId);
                                        next.set('pageId', id);
                                        return next;
                                    });
                                }}
                                onRestore={showDeletedPages ? async (id) => {
                                    try {
                                        await wikiService.restorePage(id);
                                        toast.success(t('wiki.toast.page_restored', 'Sayfa geri yüklendi'));
                                        queryClient.invalidateQueries({ queryKey: ['wiki-page-tree'] });
                                    } catch {
                                        toast.error(t('wiki.toast.restore_page_error', 'Geri yükleme başarısız'));
                                    }
                                } : undefined}
                            />
                        ))}
                    </div>
                    {pageTree.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                            <FolderOpen className="h-8 w-8 mb-3 opacity-20" />
                            <p className="text-[11px] font-bold uppercase tracking-wider">{t('wiki.no_pages')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex min-w-0 flex-1 flex-col bg-background">
                {activePage ? (
                    <>
                        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-muted/10 px-6">
                            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                <span className="rounded-lg bg-background px-2 py-1 text-[10px] font-bold border border-border/50 text-foreground/70">v{activePage.version}</span>
                                <span className="text-border/60">•</span>
                                <span>{t('wiki.updated_on', { date: new Date(activePage.updatedAt).toLocaleDateString(i18n.language) })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {editMode ? (
                                    <>
                                        <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} className="h-8 rounded-lg">{t('common.cancel')}</Button>
                                        <PermissionGate permission="wiki:write">
                                            <Button data-testid="wiki-save-btn" variant="success" size="sm" onClick={handleSave} className="h-8 gap-1.5 rounded-lg">
                                                <Save className="w-3.5 h-3.5" /> {t('common.save')}
                                            </Button>
                                        </PermissionGate>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <PermissionGate permission="wiki.update">
                                            <Button data-testid="wiki-delete-btn" variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-red-500 hover:bg-red-500/10" onClick={handleDeletePage}>
                                                <Trash2 className="w-4 h-4" />
                                                <span className="sr-only">{t('common.delete')}</span>
                                            </Button>
                                        </PermissionGate>
                                        <PermissionGate permission="wiki:write">
                                            <Button data-testid="wiki-edit-btn" variant="outline" size="sm" className="h-9 rounded-lg border-border/50 bg-background px-4 text-[12px] font-bold uppercase tracking-wider hover:bg-primary/5 hover:text-primary transition-all" onClick={startEditMode}>{t('common.edit')}</Button>
                                        </PermissionGate>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
                                {editMode ? (
                                    <div className="space-y-6">
                                        <Input
                                            value={editorTitle}
                                            onChange={e => setEditorTitle(e.target.value)}
                                            className="h-auto rounded-none border-0 border-b border-border/50 bg-transparent px-0 py-4 text-4xl font-bold text-foreground placeholder:text-muted-foreground/30 focus-visible:ring-0"
                                            placeholder={t('wiki.page_title_placeholder')}
                                        />
                                        <MarkdownEditor
                                            value={editorContent}
                                            onChange={setEditorContent}
                                            placeholder={t('wiki.editor_placeholder')}
                                            minHeight="500px"
                                            uploadOptions={{ wikiPageId: activePage.id }}
                                        />
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <h1 className="mb-10 font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">{activePage.title}</h1>
                                        <div className="wiki-content max-w-none prose prose-slate dark:prose-invert">
                                            <div dangerouslySetInnerHTML={{ __html: extractContent(activePage.content) }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-muted/5">
                        <div className="enterprise-card border-dashed max-w-md w-full bg-background/50 p-12 text-center">
                            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 text-primary/30">
                                <BookOpen className="h-10 w-10" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-foreground">{t('wiki.select_page_title')}</h3>
                            <p className="text-sm font-medium text-muted-foreground/70 leading-relaxed">{t('wiki.select_page_desc')}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WikiPage;
