import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { uploadMedia, getImageUrl } from '@/services/upload.service';
import { toast } from 'sonner';
import { marked } from 'marked';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

// ─── Markdown Detection & Conversion ─────────────────────────────────────────

/**
 * Detects if a string is raw Markdown (not HTML) and converts it to HTML.
 * AI services return Markdown but TipTap expects HTML.
 */
export function isMarkdownContent(text: string): boolean {
    if (!text || text.trim().length === 0) return false;
    // If it already starts with an HTML tag, it's probably HTML
    if (/^\s*<[a-z]/.test(text)) return false;
    // Check for common markdown patterns
    const mdPatterns = [
        /^#{1,6}\s+/m,          // Headings: # Title
        /\*\*[^*]+\*\*/,        // Bold: **text**
        /^\s*[*+-]\s+/m,         // Unordered list: * item or - item
        /^\s*\d+\.\s+/m,        // Ordered list: 1. item
        /^---$/m,               // Horizontal rule
        /^>\s+/m,               // Blockquote
        /```/,                  // Code block
    ];
    const matchCount = mdPatterns.filter(p => p.test(text)).length;
    return matchCount >= 2;
}

export function ensureHtml(text: string): string {
    if (!text || text.trim().length === 0) return '';
    if (!isMarkdownContent(text)) return sanitizeHtml(text);
    // Configure marked for clean output
    marked.setOptions({
        breaks: true,
        gfm: true,
    });
    const html = marked.parse(text);
    return sanitizeHtml(typeof html === 'string' ? html : text);
}
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Heading1, Heading2, Heading3, List, ListOrdered, Quote,
    Code, Code2, Undo2, Redo2, Minus, Link as LinkIcon, RemoveFormatting,
    ImagePlus,
} from 'lucide-react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
    uploadOptions?: {
        testResultId?: string;
        testCaseId?: string;
        wikiPageId?: string;
        category?: string;
    };
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
}: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "h-8 w-8 flex items-center justify-center rounded-md transition-all",
                "hover:bg-muted/80 active:scale-95",
                isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                disabled && "opacity-30 cursor-not-allowed"
            )}
        >
            {children}
        </button>
    );
}

function ToolbarDivider() {
    return <div className="w-px h-6 bg-border/50 mx-1" />;
}

// ─── Editor Toolbar ──────────────────────────────────────────────────────────

function EditorToolbar({ editor, onInsertImage }: { editor: Editor | null; onInsertImage: () => void }) {
    const { t } = useTranslation()
    const { prompt } = useAppDialog()

    const setLink = useCallback(async () => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        const url = await prompt({
            title: t('markdown_editor.prompt_url'),
            defaultValue: previousUrl,
            placeholder: 'https://',
            confirmLabel: t('common.save'),
        });
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor, prompt, t]);

    if (!editor) return null;

    return (
        <div className="border-b border-border/50 bg-muted/30 px-3 py-2 flex items-center gap-1 flex-wrap overflow-x-auto no-scrollbar">
            {/* Headings */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title={t('markdown_editor.toolbar.heading_1')}
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title={t('markdown_editor.toolbar.heading_2')}
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title={t('markdown_editor.toolbar.heading_3')}
            >
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Text formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title={t('markdown_editor.toolbar.bold')}
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title={t('markdown_editor.toolbar.italic')}
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title={t('markdown_editor.toolbar.underline')}
            >
                <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title={t('markdown_editor.toolbar.strikethrough')}
            >
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title={t('markdown_editor.toolbar.inline_code')}
            >
                <Code className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Lists */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title={t('markdown_editor.toolbar.bullet_list')}
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title={t('markdown_editor.toolbar.ordered_list')}
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Blocks */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title={t('markdown_editor.toolbar.quote')}
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title={t('markdown_editor.toolbar.code_block')}
            >
                <Code2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title={t('markdown_editor.toolbar.horizontal_rule')}
            >
                <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={setLink}
                isActive={editor.isActive('link')}
                title={t('markdown_editor.toolbar.link')}
            >
                <LinkIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Image insert */}
            <ToolbarButton
                onClick={onInsertImage}
                title={t('markdown_editor.toolbar.insert_image')}
            >
                <ImagePlus className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Clear formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                title={t('markdown_editor.toolbar.clear_formatting')}
            >
                <RemoveFormatting className="h-4 w-4" />
            </ToolbarButton>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Undo/Redo */}
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title={t('markdown_editor.toolbar.undo')}
            >
                <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title={t('markdown_editor.toolbar.redo')}
            >
                <Redo2 className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export function MarkdownEditor({ value, onChange, placeholder, className, minHeight = "300px", uploadOptions }: MarkdownEditorProps) {
    const { t } = useTranslation()
    const isInternalUpdate = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUploadingRef = useRef(false);

    // ── Image upload handler ──────────────────────────────────────────────────
    const handleImageUpload = useCallback(async (file: File, editor: Editor) => {
        if (isUploadingRef.current) return;
        if (!file.type.startsWith('image/')) return;

        isUploadingRef.current = true;

        // Insert a placeholder while uploading
        const placeholderId = `upload-${Date.now()}`;
        editor.chain().focus().setImage({
            src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            alt: t('markdown_editor.uploading_image_alt'),
            title: placeholderId,
        }).run();

        try {
            const result = await uploadMedia(file, uploadOptions || { category: 'GENERAL' });
            const fullUrl = getImageUrl(result.url);

            // Replace placeholder with real image
            const { doc } = editor.state;
            let placeholderPos: number | null = null;

            doc.descendants((node, pos) => {
                if (node.type.name === 'image' && node.attrs.title === placeholderId) {
                    placeholderPos = pos;
                    return false;
                }
            });

            if (placeholderPos !== null) {
                const tr = editor.state.tr;
                tr.setNodeMarkup(placeholderPos, undefined, {
                    src: fullUrl,
                    alt: result.filename,
                    title: result.filename,
                });
                editor.view.dispatch(tr);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            toast.error(errorMessage || t('upload.error'));
            // Remove the placeholder
            editor.commands.undo();
        } finally {
            isUploadingRef.current = false;
        }
    }, [t, uploadOptions]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: placeholder || t('markdown_editor.start_writing'),
                emptyEditorClass: 'is-editor-empty',
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline cursor-pointer',
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: false,
                HTMLAttributes: {
                    class: 'rounded-lg border border-border shadow-sm max-w-full h-auto my-4 mx-auto block',
                },
            }),
        ],
        content: ensureHtml(value || ''),
        onUpdate: ({ editor }) => {
            isInternalUpdate.current = true;
            const html = editor.getHTML();
            onChange(html);
        },
        editorProps: {
            attributes: {
                class: cn(
                    'focus:outline-none p-5 md:p-6',
                    'prose prose-slate dark:prose-invert max-w-none w-full container mx-auto',
                    'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground',
                    'prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-3',
                    'prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-6',
                    'prose-h3:text-xl prose-h3:mb-4 prose-h3:mt-6',
                    'prose-p:leading-relaxed prose-p:my-4 prose-p:text-[15px] prose-p:text-foreground/90',
                    'prose-li:leading-relaxed prose-li:my-1 prose-li:text-[15px]',
                    'prose-ul:list-disc prose-ul:pl-5 prose-ul:my-4',
                    'prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-4',
                    'prose-code:text-foreground/90 prose-code:bg-muted/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:font-medium prose-code:text-[13px] before:prose-code:content-none after:prose-code:content-none',
                    'prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:italic prose-blockquote:pl-5 prose-blockquote:my-6 prose-blockquote:text-muted-foreground',
                    'prose-a:text-primary prose-a:font-medium prose-a:underline-offset-4 hover:prose-a:underline transition-colors',
                    'prose-hr:border-border/50 prose-hr:my-8',
                    'prose-strong:font-semibold prose-strong:text-foreground',
                    'prose-pre:bg-slate-950 dark:prose-pre:bg-black/50 prose-pre:text-slate-200 prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-6 prose-pre:border prose-pre:border-border/50',
                    'prose-img:rounded-xl prose-img:border prose-img:border-border/50 prose-img:shadow-sm prose-img:max-w-full',
                ),
            },

            // ── Handle paste (clipboard images) ──────────────────────────
            handlePaste: (_view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file && editor) {
                            handleImageUpload(file, editor);
                        }
                        return true;
                    }
                }
                return false;
            },
            // ── Handle drop (drag and drop images) ──────────────────────
            handleDrop: (_view, event) => {
                const files = event.dataTransfer?.files;
                if (!files || files.length === 0) return false;

                const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                if (imageFiles.length === 0) return false;

                event.preventDefault();
                imageFiles.forEach(file => {
                    if (editor) handleImageUpload(file, editor);
                });
                return true;
            },
        },
    }, [placeholder, t]);

    // ── Toolbar "Insert Image" click handler ─────────────────────────────────
    const handleInsertImageClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            if (editor) handleImageUpload(file, editor);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [editor, handleImageUpload]);

    // Sync external value changes (e.g. page switch, initial load, AI generation)
    useEffect(() => {
        if (!editor) return;

        // Skip if the change came from our own onUpdate
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

        const incomingHtml = ensureHtml(value || '');
        const currentHtml = editor.getHTML();
        if (currentHtml !== incomingHtml) {
            editor.commands.setContent(incomingHtml);
        }
    }, [value, editor]);

    return (
        <div className={cn("border rounded-lg overflow-hidden bg-background flex flex-col shadow-sm", className)}>
            <EditorToolbar editor={editor} onInsertImage={handleInsertImageClick} />

            {/* Hidden file input for toolbar image button */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
            />

            <div
                className="flex-1 overflow-auto cursor-text"
                style={{ minHeight }}
                onClick={() => editor?.chain().focus().run()}
            >
                <EditorContent
                    editor={editor}
                    className={cn(
                        "h-full",
                        "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
                        "[&_.is-editor-empty:first-child::before]:text-muted-foreground/50",
                        "[&_.is-editor-empty:first-child::before]:float-left",
                        "[&_.is-editor-empty:first-child::before]:h-0",
                        "[&_.is-editor-empty:first-child::before]:pointer-events-none",
                    )}
                />
            </div>
        </div>
    );
}
