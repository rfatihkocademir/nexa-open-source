import { ArrowRight, Gauge, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { WorkflowColumn, WorkflowTransition } from '@/services/workflow-scheme.service';

interface WorkflowDiagramProps {
    columns: WorkflowColumn[];
    transitions?: WorkflowTransition[];
}

const NODE_WIDTH = 176;
const NODE_HEIGHT = 112;
const NODE_GAP = 76;
const NODE_Y = 72;

export function WorkflowDiagram({ columns, transitions = [] }: WorkflowDiagramProps) {
    const { t } = useTranslation();
    const width = Math.max(640, columns.length * (NODE_WIDTH + NODE_GAP) + 40);
    const explicitEdges = columns.flatMap((source, sourceIndex) =>
        (source.allowedTransitions ?? []).map((targetId) => {
            const targetIndex = columns.findIndex((column) => column.id === targetId);
            return targetIndex < 0 ? null : { source, sourceIndex, targetIndex };
        }).filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
    );

    if (columns.length === 0) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                <GitBranch className="mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">{t('agile_board.workflow_diagram.empty')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" />{t('agile_board.workflow_diagram.explicit')}</span>
                <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-amber-500" />{t('agile_board.workflow_diagram.free')}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background">
                <div className="relative" style={{ width, height: 300 }}>
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} 300`} aria-hidden="true">
                        <defs>
                            <marker id="workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                                <path d="M0,0 L8,4 L0,8 Z" className="fill-primary" />
                            </marker>
                        </defs>
                        {explicitEdges.map(({ source, sourceIndex, targetIndex }, edgeIndex) => {
                            const sourceX = 20 + sourceIndex * (NODE_WIDTH + NODE_GAP);
                            const targetX = 20 + targetIndex * (NODE_WIDTH + NODE_GAP);
                            const forward = targetIndex > sourceIndex;
                            const startX = forward ? sourceX + NODE_WIDTH : sourceX;
                            const endX = forward ? targetX : targetX + NODE_WIDTH;
                            const y = NODE_Y + NODE_HEIGHT / 2;
                            const bendY = forward
                                ? 34 - (edgeIndex % 3) * 10
                                : 224 + (edgeIndex % 3) * 18;
                            return (
                                <path
                                    key={`${source.id}-${columns[targetIndex].id}`}
                                    d={`M ${startX} ${y} C ${startX} ${bendY}, ${endX} ${bendY}, ${endX} ${y}`}
                                    fill="none"
                                    className="stroke-primary/70"
                                    strokeWidth="2"
                                    markerEnd="url(#workflow-arrow)"
                                />
                            );
                        })}
                    </svg>

                    {columns.map((column, index) => (
                        <div
                            key={column.id}
                            className="absolute flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md"
                            style={{ left: 20 + index * (NODE_WIDTH + NODE_GAP), top: NODE_Y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                        >
                            <div className="h-1.5 shrink-0" style={{ backgroundColor: column.color || '#6B7280' }} />
                            <div className="flex min-h-0 flex-1 flex-col p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="truncate text-sm font-semibold" title={column.name}>{column.name}</span>
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{index + 1}</span>
                                </div>
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                    {column.mappedStatus ? t(`agile_board.status_options.${column.mappedStatus}`) : t('agile_board.column_dialog.no_mapping')}
                                </p>
                                <div className="mt-auto flex items-center justify-between gap-1">
                                    {(column.allowedTransitions?.length ?? 0) === 0 ? (
                                        <Badge variant="outline" className="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[9px] text-amber-600">
                                            <GitBranch className="mr-1 h-3 w-3" />{t('agile_board.workflow_diagram.free_short')}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                                            {t('agile_board.workflow_diagram.transition_count', { count: column.allowedTransitions?.length ?? 0 })}
                                        </Badge>
                                    )}
                                    {column.wipLimit != null && column.wipLimit > 0 && (
                                        <span className="flex items-center gap-1 text-[9px] text-muted-foreground" title={t('agile_board.column_dialog.wip_limit')}>
                                            <Gauge className="h-3 w-3" />{column.wipLimit}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {transitions.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {transitions.map((transition) => (
                        <div key={transition.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{transition.name}</span>
                                <Badge variant="secondary">{transition.itemTypes.length ? transition.itemTypes.map((type) => t(`work_item_types.${type}`)).join(', ') : t('common.all')}</Badge>
                            </div>
                            <div className="mt-1 text-muted-foreground">
                                {columns.find((column) => column.id === transition.fromColumnId)?.name} → {columns.find((column) => column.id === transition.toColumnId)?.name}
                                {' · '}{t('workflow_transitions.rule_count', { count: transition.conditions.length + transition.validators.length + transition.postActions.length })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
