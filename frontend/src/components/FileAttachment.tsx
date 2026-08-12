import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadMedia, validateMediaFile, getImageUrl, isVideoFile } from '@/services/upload.service';
import type { UploadResult } from '@/services/upload.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Upload, X, Loader2, Play, Film } from 'lucide-react';
import { ImagePreview } from '@/components/ImagePreview';

export interface UploadedFile {
    url: string;
    id: string;
    filename: string;
    mimetype?: string;
}

interface FileAttachmentProps {
    /** Currently attached files */
    files?: UploadedFile[];
    /** Called when a new file is uploaded */
    onUpload?: (file: UploadedFile) => void;
    /** Called when a file is removed */
    onRemove?: (id: string) => void;
    /** Maximum number of files */
    maxFiles?: number;
    /** Custom class for the container */
    className?: string;
    /** Label text */
    label?: string;
    /** Compact mode — shows a small button instead of a dropzone */
    compact?: boolean;
    /** Additional options for upload */
    uploadOptions?: {
        workItemId?: string;
        commentId?: string;
        testResultId?: string;
        testCaseId?: string;
        wikiPageId?: string;
        category?: string;
    };
    /** Allow video uploads (default: true) */
    allowVideo?: boolean;
}

export function FileAttachment({
    files = [],
    onUpload,
    onRemove,
    maxFiles = 5,
    className,
    label,
    compact = false,
    uploadOptions,
    allowVideo = true,
}: FileAttachmentProps) {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [previewVideo, setPreviewVideo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getUploadErrorMessage = useCallback((error: unknown) => {
        if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
            return error.message;
        }
        return t('upload.error');
    }, [t]);

    const handleUpload = useCallback(async (file: File) => {
        const error = validateMediaFile(file);
        if (error) {
            toast.error(error);
            return;
        }

        setIsUploading(true);
        try {
            const result: UploadResult = await uploadMedia(file, uploadOptions);
            onUpload?.({
                url: result.url,
                id: result.id,
                filename: result.filename,
                mimetype: result.mimetype,
            });
        } catch (error: unknown) {
            toast.error(getUploadErrorMessage(error));
        } finally {
            setIsUploading(false);
        }
    }, [getUploadErrorMessage, onUpload, uploadOptions]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        const remainingSlots = maxFiles - files.length;

        selectedFiles.slice(0, remainingSlots).forEach(handleUpload);

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [files.length, maxFiles, handleUpload]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
            f.type.startsWith('image/') || (allowVideo && f.type.startsWith('video/'))
        );
        const remainingSlots = maxFiles - files.length;
        droppedFiles.slice(0, remainingSlots).forEach(handleUpload);
    }, [files.length, maxFiles, handleUpload, allowVideo]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handlePickerKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInputRef.current?.click();
        }
    }, []);

    const canAddMore = files.length < maxFiles;

    const acceptTypes = allowVideo ? 'image/*,video/mp4,video/webm,video/ogg' : 'image/*';

    const isVideo = (file: UploadedFile) =>
        file.mimetype?.startsWith('video/') || isVideoFile(file.mimetype || '');

    // ─── Compact Mode ─────────────────────────────────────────────────────────
    if (compact) {
        return (
            <div className={cn("flex items-center gap-2 flex-wrap", className)}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptTypes}
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                />

                {files.map((file) => (
                    <div key={file.id} className="relative group">
                        {isVideo(file) ? (
                            <button
                                type="button"
                                className="h-10 w-10 rounded-md border border-border bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => setPreviewVideo(getImageUrl(file.url))}
                                aria-label={t('upload.preview_video', { filename: file.filename })}
                                title={t('upload.preview_video', { filename: file.filename })}
                            >
                                <Film className="h-4 w-4 text-muted-foreground" />
                            </button>
                        ) : (
                            <ImagePreview
                                src={getImageUrl(file.url)}
                                alt={file.filename}
                                className="h-10 w-10 rounded-md object-cover border border-border"
                            />
                        )}
                        {onRemove && (
                            <button
                                type="button"
                                onClick={() => onRemove(file.id)}
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={t('upload.remove_file', { filename: file.filename })}
                                title={t('upload.remove_file', { filename: file.filename })}
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        )}
                    </div>
                ))}

                {canAddMore && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-10 w-10 rounded-md border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-all disabled:opacity-50"
                        aria-label={t('upload.add_files')}
                        title={t('upload.add_files')}
                    >
                        {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>
        );
    }

    // ─── Full Mode ────────────────────────────────────────────────────────────
    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-sm font-medium text-foreground">{label}</label>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept={acceptTypes}
                multiple
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Dropzone */}
            {canAddMore && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={handlePickerKeyDown}
                    role="button"
                    tabIndex={0}
                    aria-label={t('upload.open_picker')}
                    className={cn(
                        "relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all",
                        isDragging
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30",
                        isUploading && "pointer-events-none opacity-60"
                    )}
                >
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">{t('upload.uploading')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {t('upload.drag_drop')}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {allowVideo
                                        ? t('upload.accepted_formats_video')
                                        : t('upload.accepted_formats')
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* File thumbnails */}
            {files.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2">
                    {files.map((file) => (
                        <div
                            key={file.id}
                            className="relative group rounded-lg border bg-card overflow-hidden shadow-sm w-24"
                        >
                            {isVideo(file) ? (
                                <button
                                    type="button"
                                    className="w-full h-16 bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => setPreviewVideo(getImageUrl(file.url))}
                                    aria-label={t('upload.preview_video', { filename: file.filename })}
                                    title={t('upload.preview_video', { filename: file.filename })}
                                >
                                    <div className="relative">
                                        <Film className="h-6 w-6 text-muted-foreground" />
                                        <Play className="h-3 w-3 text-primary absolute -bottom-0.5 -right-0.5" />
                                    </div>
                                </button>
                            ) : (
                                <ImagePreview
                                    src={getImageUrl(file.url)}
                                    alt={file.filename}
                                    className="w-full h-16 object-cover"
                                    buttonClassName="w-full"
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground truncate px-1.5 py-1">
                                {file.filename}
                            </p>
                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(file.id)}
                                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    aria-label={t('upload.remove_file', { filename: file.filename })}
                                    title={t('upload.remove_file', { filename: file.filename })}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Video Preview Modal */}
            {previewVideo && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
                    onClick={() => setPreviewVideo(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-card rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewVideo(null)}
                            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                            aria-label={t('upload.close_preview')}
                            title={t('upload.close_preview')}
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <video
                            src={previewVideo}
                            controls
                            autoPlay
                            className="w-full max-h-[80vh]"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
