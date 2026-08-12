import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { glossaryText, type GlossaryKey } from '@/lib/productGlossary';
import { cn } from '@/lib/utils';

export function GlossaryTerm({ term, children, className, showIcon = false }: { term: GlossaryKey; children?: ReactNode; className?: string; showIcon?: boolean }) {
    const { i18n } = useTranslation();
    const [expanded, description] = glossaryText(term, i18n.language);
    return <Tooltip>
        <TooltipTrigger asChild>
            <button type="button" className={cn('inline-flex cursor-help items-center gap-1 border-b border-dotted border-current/50 text-left font-inherit', className)} aria-label={`${term}: ${expanded}. ${description}`}>
                {children ?? term}{showIcon && <CircleHelp className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
            </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-popover px-3 py-2 text-popover-foreground shadow-lg" sideOffset={6}>
            <p className="font-semibold">{term} · {expanded}</p><p className="mt-1 leading-relaxed text-muted-foreground">{description}</p>
        </TooltipContent>
    </Tooltip>;
}
