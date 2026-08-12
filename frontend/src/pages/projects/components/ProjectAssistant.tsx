import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Brain, FileText, History, Link as LinkIcon, MessageSquare, Plus, Send, Sparkles } from 'lucide-react';
import { aiService } from '@/services/ai.service';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl } from '@/services/upload.service';
import { motion, AnimatePresence } from 'framer-motion';
import { wikiService } from '@/services/wiki.service';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { marked } from 'marked';
import { escapeHtml, sanitizeHtml } from '@/lib/sanitizeHtml';

interface Source {
    id: string;
    type: string;
    similarity: number;
    snippet?: string;
    title?: string;
    href?: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
}

interface ConversationSession {
    id: string;
    title: string;
    preview: string;
    updatedAt: string;
    messages: Message[];
}

const LEGACY_WELCOME_MESSAGES = [
    'Merhaba! Ben Proje Asistanınızım. Bu proje için indekslenmiş wiki, backlog, test ve yorum hafızasını kullanarak cevap veririm. Sorularınızı kaynak göstererek yanıtlarım.',
    "Hello! I'm your Project Assistant. I answer using the indexed wiki, backlog, test, and comment memory for this project, and I cite my sources.",
];

const buildWelcomeMessage = (t: TFunction): Message => ({
    role: 'assistant',
    content: t('project_assistant.welcome_message'),
});

const buildInitialMessages = (t: TFunction): Message[] => [buildWelcomeMessage(t)];

const getLegacyStorageKey = (projectId: string) => `nexa-project-memory-chat:${projectId}`;
const getSessionsStorageKey = (projectId: string) => `nexa-project-memory-sessions:${projectId}`;
const getActiveSessionStorageKey = (projectId: string) => `nexa-project-memory-active:${projectId}`;

function createSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractWikiHtml(content: unknown): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null && 'content' in content) {
        const inner = (content as { content?: unknown }).content;
        return typeof inner === 'string' ? inner : JSON.stringify(content, null, 2);
    }
    return JSON.stringify(content, null, 2);
}

function isWelcomeMessage(content: string, welcomeContent: string): boolean {
    return content === welcomeContent || LEGACY_WELCOME_MESSAGES.includes(content);
}

function deriveSessionTitle(messages: Message[], t: TFunction): string {
    const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim().length > 0);
    if (!firstUserMessage) {
        return t('project_assistant.session.new_chat');
    }

    return firstUserMessage.content.trim().slice(0, 48);
}

function deriveSessionPreview(messages: Message[], t: TFunction, welcomeContent: string): string {
    const lastMeaningfulMessage = [...messages]
        .reverse()
        .find((message) => message.content.trim().length > 0 && !isWelcomeMessage(message.content, welcomeContent));

    if (!lastMeaningfulMessage) {
        return t('project_assistant.session.preview_placeholder');
    }

    return lastMeaningfulMessage.content.trim().slice(0, 90);
}

function buildSession(t: TFunction, messages: Message[] = buildInitialMessages(t)): ConversationSession {
    const welcomeContent = buildWelcomeMessage(t).content;

    return {
        id: createSessionId(),
        title: deriveSessionTitle(messages, t),
        preview: deriveSessionPreview(messages, t, welcomeContent),
        updatedAt: new Date().toISOString(),
        messages,
    };
}

function normalizeSession(session: Partial<ConversationSession> | null | undefined, t: TFunction, welcomeContent: string): ConversationSession | null {
    if (!session || typeof session.id !== 'string') {
        return null;
    }

    const messages = Array.isArray(session.messages) && session.messages.length > 0
        ? session.messages as Message[]
        : buildInitialMessages(t);

    return {
        id: session.id,
        title: typeof session.title === 'string' && session.title.trim().length > 0
            ? session.title
            : deriveSessionTitle(messages, t),
        preview: typeof session.preview === 'string' && session.preview.trim().length > 0
            ? session.preview
            : deriveSessionPreview(messages, t, welcomeContent),
        updatedAt: typeof session.updatedAt === 'string' && session.updatedAt
            ? session.updatedAt
            : new Date().toISOString(),
        messages,
    };
}

function loadSessions(projectId: string, t: TFunction): ConversationSession[] {
    const welcomeContent = buildWelcomeMessage(t).content;

    if (typeof window === 'undefined') {
        return [buildSession(t)];
    }

    try {
        const rawSessions = window.localStorage.getItem(getSessionsStorageKey(projectId));
        if (rawSessions) {
            const parsed = JSON.parse(rawSessions);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .map((session) => normalizeSession(session, t, welcomeContent))
                    .filter((session): session is ConversationSession => Boolean(session));
                if (normalized.length > 0) {
                    return normalized.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
                }
            }
        }

        const legacyRaw = window.localStorage.getItem(getLegacyStorageKey(projectId));
        if (legacyRaw) {
            const parsed = JSON.parse(legacyRaw);
            const legacyMessages = Array.isArray(parsed) && parsed.length > 0 ? parsed as Message[] : buildInitialMessages(t);
            return [buildSession(t, legacyMessages)];
        }
    } catch {
        return [buildSession(t)];
    }

    return [buildSession(t)];
}

function loadActiveSessionId(projectId: string, sessions: ConversationSession[]): string {
    if (typeof window === 'undefined') {
        return sessions[0]?.id || '';
    }

    const stored = window.localStorage.getItem(getActiveSessionStorageKey(projectId));
    if (stored && sessions.some((session) => session.id === stored)) {
        return stored;
    }

    return sessions[0]?.id || '';
}

function resolveLocale(language: string): string {
    return language.toLowerCase().startsWith('tr') ? 'tr-TR' : 'en-US';
}

function formatSessionTimestamp(value: string, language: string): string {
    try {
        return new Intl.DateTimeFormat(resolveLocale(language), {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    } catch {
        return value;
    }
}

export const ProjectAssistant: React.FC<{ projectId: string }> = ({ projectId }) => {
    const { t, i18n } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const initialSessionsRef = useRef<ConversationSession[] | null>(null);
    if (!initialSessionsRef.current) {
        initialSessionsRef.current = loadSessions(projectId, t);
    }
    const [sessions, setSessions] = useState<ConversationSession[]>(() => initialSessionsRef.current ?? loadSessions(projectId, t));
    const [activeSessionId, setActiveSessionId] = useState<string>(() => loadActiveSessionId(projectId, initialSessionsRef.current ?? loadSessions(projectId, t)));
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedSource, setSelectedSource] = useState<Source | null>(null);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const user = useAuthStore((state) => state.user);
    const welcomeContent = t('project_assistant.welcome_message');

    const activeSession = useMemo(
        () => sessions?.find((session) => session.id === activeSessionId) || sessions?.[0] || buildSession(t),
        [activeSessionId, sessions, t]
    );

    const messages = useMemo(() => activeSession?.messages || [], [activeSession?.messages]);


    const selectedWikiPageQuery = useQuery({
        queryKey: ['project-memory-source-page', selectedSource?.id],
        queryFn: () => wikiService.getPage(selectedSource!.id),
        enabled: selectedSource?.type === 'WikiPage' && Boolean(selectedSource?.id),
    });

    useEffect(() => {
        const loadedSessions = loadSessions(projectId, t);
        setSessions(loadedSessions);
        setActiveSessionId(loadActiveSessionId(projectId, loadedSessions));
        setSelectedSource(null);
        setInput('');
    }, [projectId, t]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(getSessionsStorageKey(projectId), JSON.stringify(sessions));
        window.localStorage.removeItem(getLegacyStorageKey(projectId));
    }, [projectId, sessions]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(getActiveSessionStorageKey(projectId), activeSessionId);
    }, [activeSessionId, projectId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading, activeSessionId]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateHeight = () => {
            if (!containerRef.current) {
                return;
            }

            const top = containerRef.current.getBoundingClientRect().top;
            const nextHeight = Math.max(window.innerHeight - top - 24, 520);
            setViewportHeight(nextHeight);
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);

        return () => {
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    const updateActiveSessionMessages = (nextMessages: Message[]) => {
        setSessions((prev) => {
            const updated = prev.map((session) => (
                session.id === activeSessionId
                    ? {
                        ...session,
                        messages: nextMessages,
                        title: deriveSessionTitle(nextMessages, t),
                        preview: deriveSessionPreview(nextMessages, t, welcomeContent),
                        updatedAt: new Date().toISOString(),
                    }
                    : session
            ));

            return [...updated].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        });
    };

    const handleCreateSession = () => {
        const session = buildSession(t);
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        setSelectedSource(null);
        setInput('');
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        const nextMessages = [...messages, userMessage];
        updateActiveSessionMessages(nextMessages);
        setInput('');
        setLoading(true);

        try {
            const response = await aiService.chatWithAssistant(projectId, nextMessages);
            updateActiveSessionMessages([
                ...nextMessages,
                {
                    role: 'assistant',
                    content: response.content,
                    sources: response.sources,
                },
            ]);
        } catch {
            updateActiveSessionMessages([
                ...nextMessages,
                {
                    role: 'assistant',
                    content: t('project_assistant.errors.connection'),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const renderMessageContent = (content: string, sources: Source[] = []) => {
        let processedContent = content;
        const citationRegex = /\[([A-Za-z]+):([0-9a-f-]+)\]/g;
        
        processedContent = processedContent.replace(citationRegex, (match, type, id) => {
            const source = sources.find((item) => item.type === type && item.id === id);
            if (source) {
                const title = source.title || `${type}:${id.slice(0, 8)}`;
                return `<button type="button" class="citation-btn inline rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">${escapeHtml(title)}</button>`;
            }
            return match;
        });

        const rendered = marked.parse(processedContent);
        return sanitizeHtml(typeof rendered === 'string' ? rendered : processedContent);
    };

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>, sources: Source[] = []) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('.citation-btn');
        if (btn) {
            const type = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            const source = sources.find(s => s.type === type && s.id === id);
            if (source) setSelectedSource(source);
        }
    };

    return (
        <div
            ref={containerRef}
            className="grid min-h-0 max-h-full items-stretch gap-4 overflow-hidden lg:grid-cols-2 xl:grid-cols-[280px_minmax(0,1.2fr)_minmax(340px,0.9fr)]"
            style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
        >
            <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-card lg:col-span-2 xl:col-span-1">
                <CardHeader className="border-b bg-muted/10 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-primary/10 p-2.5 shadow-inner">
                                <History className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold tracking-tight">{t('project_assistant.history_title')}</CardTitle>
                            </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleCreateSession} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t('project_assistant.actions.new_chat')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <ScrollArea className="min-h-0 flex-1 px-3 py-3">
                        <div className="space-y-2">
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveSessionId(session.id);
                                        setSelectedSource(null);
                                    }}
                                    className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${session.id === activeSessionId
                                            ? 'border-primary/40 bg-primary/8 shadow-sm'
                                            : 'border-border/70 bg-background/70 hover:border-primary/20 hover:bg-muted/20'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-foreground">{session.title}</p>
                                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                {session.preview}
                                            </p>
                                        </div>
                                        <MessageSquare className={`mt-0.5 h-4 w-4 shrink-0 ${session.id === activeSessionId ? 'text-primary' : 'text-muted-foreground'}`} />
                                    </div>
                                    <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                                        {formatSessionTimestamp(session.updatedAt, i18n.language)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
                <CardHeader className="border-b bg-muted/10 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 shadow-inner">
                            <Brain className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold tracking-tight">{t('project_assistant.title')}</CardTitle>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                {t('project_assistant.subtitle')}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-0">
                    <ScrollArea className="min-h-0 flex-1 px-6 py-6" ref={scrollRef}>
                        <div className="flex flex-col gap-6">
                            <AnimatePresence initial={false}>
                                {messages.map((message, index) => (
                                    <motion.div
                                        key={`${activeSessionId}-${index}`}
                                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                        className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                    >
                                        <Avatar className={`h-9 w-9 border-2 ${message.role === 'assistant' ? 'border-primary/20' : 'border-muted'}`}>
                                            {message.role === 'assistant' ? (
                                                <AvatarFallback className="bg-primary text-primary-foreground">
                                                    <Bot className="h-5 w-5" />
                                                </AvatarFallback>
                                            ) : (
                                                <>
                                                    <AvatarImage src={user?.avatarUrl ? getImageUrl(user.avatarUrl) : undefined} />
                                                    <AvatarFallback className="bg-muted font-semibold text-muted-foreground">
                                                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                                                    </AvatarFallback>
                                                </>
                                            )}
                                        </Avatar>
                                        <div className={`flex max-w-[80%] flex-col gap-2.5 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div 
                                                className={`whitespace-pre-wrap rounded-xl p-4 text-[14.5px] leading-relaxed shadow-sm ${message.role === 'user'
                                                    ? 'rounded-tr-none bg-primary text-primary-foreground'
                                                    : 'rounded-tl-none border bg-card text-card-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-li:my-0.5'
                                                }`}
                                                onClick={(e) => handleContentClick(e, message.sources)}
                                            >
                                                {message.role === 'assistant'
                                                    ? <div dangerouslySetInnerHTML={{ __html: renderMessageContent(message.content, message.sources) as string }} />
                                                    : message.content}
                                            </div>

                                            {message.sources && message.sources.length > 0 && (
                                                <div className="mt-1 w-full rounded-xl border border-border/70 bg-background/75 p-3">
                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('project_assistant.sources_label')}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {message.sources.map((source, sourceIndex) => (
                                                            <button
                                                                key={sourceIndex}
                                                                type="button"
                                                                onClick={() => setSelectedSource(source)}
                                                                className="group inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                                                                title={t('project_assistant.source_similarity', { value: Math.round(source.similarity * 100) })}
                                                            >
                                                                <LinkIcon className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
                                                                <span className="font-medium">
                                                                    {source.title || `${source.type}: ${source.id.substring(0, 8)}`}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {loading && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
                                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            <Bot className="h-5 w-5" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex items-center gap-3 rounded-xl rounded-tl-none border bg-card p-4 shadow-sm">
                                        <div className="flex gap-1.5">
                                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/50 [animation-delay:-0.3s]"></div>
                                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/50 [animation-delay:-0.15s]"></div>
                                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/50"></div>
                                        </div>
                                        <span className="text-xs font-medium italic text-muted-foreground">{t('project_assistant.loading')}</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="sticky bottom-0 z-10 border-t bg-background p-5">
                    <form className="flex w-full items-end gap-3" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
                        <div className="relative flex-1">
                            <textarea
                                data-testid="ai-assistant-input"
                                placeholder={t('project_assistant.input_placeholder')}

                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        handleSend();
                                    }
                                }}
                                disabled={loading}
                                rows={1}
                                className="flex min-h-[50px] w-full resize-none rounded-lg border border-input bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="absolute bottom-3 right-3 hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:block">
                                {t('project_assistant.input_shortcut')}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            aria-label={t('project_assistant.actions.send_message')}
                            disabled={loading || !input.trim()}
                            className="h-[50px] w-[50px] rounded-lg"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
                <CardHeader className="border-b bg-muted/10 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 shadow-inner">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight">
                                {selectedSource?.title || t('project_assistant.preview.title')}
                            </CardTitle>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {selectedSource?.type === 'WikiPage'
                                    ? t('project_assistant.preview.wiki_description')
                                    : t('project_assistant.preview.generic_description')}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    {selectedSource ? (
                        <>
                            <div className="border-b border-border/70 bg-muted/10 px-6 py-3 text-xs text-muted-foreground">
                                {selectedSource.snippet || t('project_assistant.preview.no_snippet')}
                            </div>
                            <ScrollArea className="min-h-0 flex-1 px-6 py-5">
                                {selectedSource.type === 'WikiPage' ? (
                                    selectedWikiPageQuery.isLoading ? (
                                        <p className="text-sm text-muted-foreground">{t('project_assistant.preview.loading_document')}</p>
                                    ) : selectedWikiPageQuery.data ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-foreground">{selectedWikiPageQuery.data.title}</h3>
                                                    <p className="text-xs text-muted-foreground">{t('project_assistant.preview.version', { value: selectedWikiPageQuery.data.version })}</p>
                                                </div>
                                                {selectedSource.href && (
                                                    <Button asChild type="button" variant="outline" size="sm">
                                                        <Link to={selectedSource.href}>{t('project_assistant.actions.open_full_document')}</Link>
                                                    </Button>
                                                )}
                                            </div>
                                            <div
                                                className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-li:my-0.5"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(marked.parse(extractWikiHtml(selectedWikiPageQuery.data.content)))) }}
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('project_assistant.preview.load_error')}</p>
                                    )
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-foreground">
                                            {t('project_assistant.preview.unsupported_source')}
                                        </p>
                                        {selectedSource.href && (
                                            <Button asChild type="button" variant="outline" size="sm">
                                                <Link to={selectedSource.href}>{t('project_assistant.actions.open_source_workspace')}</Link>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                            <div className="rounded-full border border-primary/10 bg-primary/5 p-4">
                                <FileText className="h-8 w-8 text-primary/60" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">{t('project_assistant.empty.title')}</h3>
                                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                    {t('project_assistant.empty.description')}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
