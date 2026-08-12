import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, tr } from "date-fns/locale";
import {
    AlarmClock,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    CircleDot,
    Clock3,
    MoreHorizontal,
    Pencil,
    UserRound,
    Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ActionCenterItem, ActionCenterStatus } from "@/types/action-center";
import { localizeActionText } from "../action-center-i18n";

const severityStyles = {
    LOW: "border-slate-300/70 bg-slate-100/60 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    MEDIUM: "border-sky-300/70 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    HIGH: "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    CRITICAL: "border-rose-300/70 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
} as const;

const statusStyles: Record<ActionCenterStatus, string> = {
    OPEN: "border-blue-300/70 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    ACKNOWLEDGED: "border-violet-300/70 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    IN_PROGRESS: "border-cyan-300/70 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    RESOLVED: "border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    DISMISSED: "border-slate-300/70 bg-slate-100/60 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

interface ActionCenterItemCardProps {
    item: ActionCenterItem;
    selected: boolean;
    canMutate: boolean;
    onSelectedChange: (selected: boolean) => void;
    onEdit: () => void;
    onResolve: () => void;
    onSnooze: () => void;
    onConvert: () => void;
    onStatusChange: (status: ActionCenterStatus) => void;
    converting?: boolean;
    updating?: boolean;
    now: number;
}

export function ActionCenterItemCard({ item, selected, canMutate, onSelectedChange, onEdit, onResolve, onSnooze, onConvert, onStatusChange, converting, updating, now }: ActionCenterItemCardProps) {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language.startsWith("tr") ? tr : enUS;
    const dueDate = validDate(item.dueDate);
    const snoozedUntil = validDate(item.snoozedUntil);
    const updatedAt = validDate(item.updatedAt);
    const terminal = item.status === "RESOLVED" || item.status === "DISMISSED";
    const isOverdue = Boolean(dueDate && dueDate.getTime() < now && !terminal);
    const safeActionUrl = safeInternalPath(item.actionUrl);
    const assigneeName = item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : t("action_center.unassigned");
    const initials = item.assignee ? `${item.assignee.firstName[0] || ""}${item.assignee.lastName[0] || ""}` : "";
    const title = localizeActionText(item.title, item.metadata, t, i18n);
    const description = item.description ? localizeActionText(item.description, item.metadata, t, i18n) : item.description;
    const canAct = canMutate && !updating;

    const updatedLabel = useMemo(() => updatedAt ? formatDistanceToNow(updatedAt, { addSuffix: true, locale: dateLocale }) : undefined, [dateLocale, updatedAt]);

    return (
        <article aria-busy={updating || undefined} className={cn(
            "group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/25",
            selected && "border-primary/45 bg-primary/[0.025] ring-1 ring-primary/10",
            item.severity === "CRITICAL" && "border-l-4 border-l-rose-500",
        )}>
            <div className="flex items-start gap-3">
                <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => onSelectedChange(checked === true)}
                    aria-label={t("action_center.select_item", { title })}
                    disabled={!canAct}
                    className="mt-1"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-bold", severityStyles[item.severity])}>
                            {t(`action_center.severity.${item.severity}`)}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", statusStyles[item.status])}>
                            {t(`action_center.status.${item.status}`)}
                        </Badge>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {t(`action_center.action_types.${item.actionType}`, { defaultValue: humanizeToken(item.actionType) })}
                        </span>
                    </div>

                    <div className="mt-2 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold leading-5 text-foreground">{title}</h2>
                            {description && <p className="mt-1 line-clamp-2 max-w-4xl text-xs leading-5 text-muted-foreground">{description}</p>}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8 shrink-0" aria-label={t("action_center.item_actions")}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={onEdit} disabled={!canAct}><Pencil className="mr-2 h-4 w-4" />{t("action_center.actions.edit")}</DropdownMenuItem>
                                {item.status === "OPEN" && <DropdownMenuItem onClick={() => onStatusChange("ACKNOWLEDGED")} disabled={!canAct}><CircleDot className="mr-2 h-4 w-4" />{t("action_center.actions.acknowledge")}</DropdownMenuItem>}
                                {!["IN_PROGRESS", "RESOLVED", "DISMISSED"].includes(item.status) && <DropdownMenuItem onClick={() => onStatusChange("IN_PROGRESS")} disabled={!canAct}><Clock3 className="mr-2 h-4 w-4" />{t("action_center.actions.start")}</DropdownMenuItem>}
                                {!terminal && <DropdownMenuItem onClick={onSnooze} disabled={!canAct}><AlarmClock className="mr-2 h-4 w-4" />{t("action_center.actions.snooze")}</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onConvert} disabled={!canAct || converting || terminal}><Wrench className="mr-2 h-4 w-4" />{t("action_center.actions.convert")}</DropdownMenuItem>
                                {safeActionUrl && <DropdownMenuItem asChild><Link to={safeActionUrl}><ArrowUpRight className="mr-2 h-4 w-4" />{t("action_center.actions.open_source")}</Link></DropdownMenuItem>}
                                {!terminal && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onResolve} disabled={!canAct}><CheckCircle2 className="mr-2 h-4 w-4" />{t("action_center.actions.resolve")}</DropdownMenuItem></>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        {item.project && (
                            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/75">
                                <span className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">{item.project.key}</span>
                                <span className="max-w-48 truncate">{item.project.name}</span>
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                            <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px] font-bold">{initials || <UserRound className="h-3 w-3" />}</AvatarFallback></Avatar>
                            {assigneeName}
                        </span>
                        {dueDate && (
                            <span className={cn("inline-flex items-center gap-1", isOverdue && "font-semibold text-destructive")}>
                                <CalendarDays className="h-3.5 w-3.5" />
                                {isOverdue ? t("action_center.overdue") : t("action_center.due")}: {dueDate.toLocaleDateString(i18n.language)}
                            </span>
                        )}
                        {snoozedUntil && snoozedUntil.getTime() > now && (
                            <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300"><AlarmClock className="h-3.5 w-3.5" />{t("action_center.snoozed_until", { date: snoozedUntil.toLocaleString(i18n.language) })}</span>
                        )}
                        {updatedLabel && <span className="sm:ml-auto">{t("action_center.updated", { value: updatedLabel })}</span>}
                        {safeActionUrl && <Link to={safeActionUrl} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{t("action_center.actions.open")}<ChevronRight className="h-3.5 w-3.5" /></Link>}
                    </div>
                </div>
            </div>
        </article>
    );
}

function humanizeToken(value: string) {
    return value
        .toLocaleLowerCase()
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
        .join(" ");
}

function validDate(value?: string | null) {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function safeInternalPath(value?: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.origin !== window.location.origin) return undefined;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return undefined;
    }
}
