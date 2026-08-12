import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function HelpTooltip({ label, description, children, className }: { label: string; description: string; children?: ReactNode; className?: string }) {
    return <Tooltip><TooltipTrigger asChild>{children ?? <button type="button" className={cn('inline-flex rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label={`${label}: ${description}`}><CircleHelp className="h-4 w-4" /></button>}</TooltipTrigger><TooltipContent className="max-w-xs bg-popover px-3 py-2 text-popover-foreground shadow-lg"><p className="font-semibold">{label}</p><p className="mt-1 leading-relaxed text-muted-foreground">{description}</p></TooltipContent></Tooltip>;
}
