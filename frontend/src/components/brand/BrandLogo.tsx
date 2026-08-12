import { cn } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    markClassName?: string;
    textClassName?: string;
    stacked?: boolean;
}

export function BrandLogo({
    className,
    markClassName,
    textClassName,
    stacked = false,
}: BrandLogoProps) {
    return (
        <div className={cn("flex items-center gap-3", stacked && "flex-col gap-4 text-center", className)}>
            <img
                src="/brand/nexa-mark-icon.svg"
                alt="Nexa logo"
                className={cn("h-12 w-12 rounded-lg", markClassName)}
            />
            <span className={cn("font-heading text-3xl font-bold tracking-[-0.035em] text-foreground", textClassName)}>
                Nexa
            </span>
        </div>
    );
}
