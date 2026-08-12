import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
    name: string;
    color?: string; // hex color
    className?: string;
    onClick?: () => void;
}

export function TagBadge({ name, color = "#6B7280", className, onClick }: TagBadgeProps) {
    // Generate a background color with opacity based on the tag color
    // Since we receive hex, we can use it directly or try to make it look nicer with inline styles

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-normal text-xs px-2 py-0.5 border-0 cursor-default",
                onClick && "cursor-pointer hover:opacity-80",
                className
            )}
            style={{
                backgroundColor: `${color}20`, // 12% opacity
                color: color,
                // border: `1px solid ${color}40`
            }}
            onClick={(e) => {
                if (onClick) {
                    e.stopPropagation();
                    onClick();
                }
            }}
        >
            {name}
        </Badge>
    );
}
