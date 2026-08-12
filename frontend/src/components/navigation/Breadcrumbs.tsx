import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { 
    Breadcrumb, 
    BreadcrumbItem, 
    BreadcrumbLink, 
    BreadcrumbList, 
    BreadcrumbPage, 
    BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import React from "react";

export interface BreadcrumbItemType {
    label: string;
    href?: string;
    icon?: React.ComponentType<{ className?: string }>;
    active?: boolean;
}

interface AppBreadcrumbsProps {
    items: BreadcrumbItemType[];
    className?: string;
    showHome?: boolean;
    compact?: boolean;
}

export function AppBreadcrumbs({ items, className, showHome = true, compact = false }: AppBreadcrumbsProps) {
    return (
        <Breadcrumb className={cn(compact ? "mb-0" : "mb-4", className)}>
            <BreadcrumbList className={cn(compact && "gap-1 text-xs sm:gap-1.5")}>
                {showHome && (
                    <>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/" className="flex items-center gap-1">
                                    <Home className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator>
                            <ChevronRight className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                        </BreadcrumbSeparator>
                    </>
                )}

                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    
                    return (
                        <React.Fragment key={index}>
                            <BreadcrumbItem>
                                {item.href && !isLast ? (
                                    <BreadcrumbLink asChild>
                                        <Link to={item.href} className="flex items-center gap-1.5">
                                            {item.icon && <item.icon className={cn(compact ? "h-3 w-3 opacity-70" : "h-3.5 w-3.5 opacity-70")} />}
                                            {item.label}
                                        </Link>
                                    </BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                                        {item.icon && <item.icon className={cn(compact ? "h-3 w-3 opacity-70" : "h-3.5 w-3.5 opacity-70")} />}
                                        {item.label}
                                    </BreadcrumbPage>
                                )}
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator>
                                    <ChevronRight className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                </BreadcrumbSeparator>
                            )}
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
