import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Story } from "@/types/agile";
import { cn } from "@/lib/utils";
import { Server, ShieldAlert, Monitor, Settings, Zap, Database } from "lucide-react";

const getEpicBadgeStyle = (title: string) => {
    const colors = [
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
        "border-info/20 bg-info/10 text-info",
        "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800"
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

const getCategoryIcon = (category: string) => {
    if (category === 'DB_MIGRATION') return <Database className="h-3 w-3 mr-1" />;
    if (category === 'CONFIG_CHANGE') return <Settings className="h-3 w-3 mr-1" />;
    if (category === 'API_INTEGRATION') return <Zap className="h-3 w-3 mr-1" />;
    if (category?.includes('BACKEND')) return <Server className="h-3 w-3 mr-1" />;
    return <Monitor className="h-3 w-3 mr-1" />;
};

const getRiskBadgeStyle = (risk: string) => {
    switch (risk) {
        case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
        case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
        case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
        default: return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    }
};

interface BoardCardProps {
    item: Story;
    index: number;
    onItemClick?: (itemId: string) => void;
}

export function BoardCard({ item, index, onItemClick }: BoardCardProps) {
    const customFields = item.customFields || {};
    const hasCategory = !!customFields.technicalCategory;
    const riskLevel = customFields.riskLevel;
    const hasFrontendImpact = customFields.frontendImpact;

    return (
        <Draggable draggableId={item.id} index={index}>
            {(provided) => (
                <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-md shadow-sm relative overflow-hidden"
                    onClick={() => onItemClick?.(item.id)}
                >
                    {riskLevel === 'CRITICAL' && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                    )}
                    <CardHeader className="p-3 pb-0">
                        <div className="space-y-2">
                            {item.parent && item.parent.itemType === 'EPIC' && (
                                <div className="flex">
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wide uppercase truncate max-w-[150px]",
                                        getEpicBadgeStyle(item.parent.title)
                                    )}>
                                        {item.parent.title}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-sm font-medium leading-tight">
                                    {item.title}
                                </CardTitle>
                            </div>
                            
                            {/* AI Metadata Visual Badges */}
                            {(hasCategory || riskLevel) && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {hasCategory && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-slate-50 font-normal">
                                            {getCategoryIcon(customFields.technicalCategory)}
                                            {customFields.technicalCategory.replace(/_/g, ' ')}
                                        </Badge>
                                    )}
                                    {riskLevel && (
                                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 font-semibold", getRiskBadgeStyle(riskLevel))}>
                                            {riskLevel === 'CRITICAL' && <ShieldAlert className="h-3 w-3 mr-1" />}
                                            {riskLevel} RISK
                                        </Badge>
                                    )}
                                    {hasFrontendImpact && (
                                        <Badge variant="outline" title="Arayüz/Kontrat Etkisi Var" className="text-[9px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                                            UI
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2">
                        <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-[10px] h-5">
                                {item.key || item.id.substring(0, 8)}
                            </Badge>
                            {item.assignee && (
                                <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px]">
                                        {item.assignee.firstName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </Draggable>
    );
}
