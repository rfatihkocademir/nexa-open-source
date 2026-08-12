import React from 'react';
import { Inbox, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ElementType;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon: Icon = Inbox,
    actionLabel,
    onAction,
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 backdrop-blur-md space-y-4 my-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                <Icon className="h-8 w-8" />
            </div>
            <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-slate-100 font-heading">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
            </div>
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 mt-2"
                >
                    <Plus className="h-4 w-4" />
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};
