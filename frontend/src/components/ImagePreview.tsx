import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
    src: string;
    alt: string;
    className?: string;
    buttonClassName?: string;
}

/** Renders an image that can be opened in a larger, accessible preview. */
export function ImagePreview({ src, alt, className, buttonClassName }: ImagePreviewProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={cn('block cursor-zoom-in text-left', buttonClassName)}
                onClick={() => setOpen(true)}
                aria-label={t('upload.preview_image', { filename: alt })}
                title={t('upload.preview_image', { filename: alt })}
            >
                <img src={src} alt={alt} className={className} />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-fit max-w-[95vw] border-0 bg-transparent p-2 shadow-none sm:rounded-xl">
                    <DialogTitle className="sr-only">
                        {t('upload.preview_image', { filename: alt })}
                    </DialogTitle>
                    <img
                        src={src}
                        alt={alt}
                        className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
