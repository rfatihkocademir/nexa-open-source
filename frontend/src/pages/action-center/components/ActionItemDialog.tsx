import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionCenterItem, ActionCenterPerson, ActionCenterProject, ActionCenterStatus, ConvertActionCenterItemInput, UpdateActionCenterItemInput } from "@/types/action-center";
import { localizeActionText } from "../action-center-i18n";

const UNASSIGNED = "__unassigned__";

interface ActionItemDialogProps {
    item: ActionCenterItem;
    assignees: ActionCenterPerson[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (input: UpdateActionCenterItemInput) => Promise<void>;
    pending?: boolean;
    allowDismiss?: boolean;
    initialStatus?: ActionCenterStatus;
    autoAssignToId?: string;
}

export function ActionItemDialog({ item, assignees, open, onOpenChange, onSubmit, pending, allowDismiss = false, initialStatus, autoAssignToId }: ActionItemDialogProps) {
    const { t, i18n } = useTranslation();
    const startingStatus = initialStatus || item.status;
    const startingResolution = item.resolution
        ? localizeActionText(item.resolution, item.metadata, t, i18n)
        : "";
    const shouldAutoAssign = startingStatus === "RESOLVED" && !item.assignee && autoAssignToId;
    const [status, setStatus] = useState<ActionCenterStatus>(startingStatus);
    const [assigneeId, setAssigneeId] = useState(item.assignee?.id || (shouldAutoAssign ? autoAssignToId : UNASSIGNED));
    const [dueDate, setDueDate] = useState(item.dueDate?.slice(0, 10) || "");
    const [resolution, setResolution] = useState(startingResolution);
    const [resolutionEdited, setResolutionEdited] = useState(false);

    const requiresResolution = status === "RESOLVED" || status === "DISMISSED";
    const canSubmit = !requiresResolution || resolution.trim().length > 0;
    const statusOptions = useMemo<ActionCenterStatus[]>(() => ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", ...(allowDismiss ? ["DISMISSED" as const] : [])], [allowDismiss]);
    const localizedTitle = localizeActionText(item.title, item.metadata, t, i18n);

    const submit = async () => {
        if (!canSubmit) return;
        try {
            await onSubmit({
                status,
                assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
                dueDate: dueDate ? new Date(`${dueDate}T23:59:59.999`).toISOString() : null,
                resolution: requiresResolution
                    ? (resolutionEdited ? resolution.trim() : item.resolution || resolution.trim())
                    : null,
            });
        } catch {
            // The owning mutation shows localized feedback and keeps the form open for correction.
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <CalendarClock className="h-5 w-5" />
                    </div>
                    <DialogTitle>{t("action_center.edit.title")}</DialogTitle>
                    <DialogDescription>{localizedTitle}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="action-status">{t("action_center.fields.status")}</Label>
                        <Select value={status} onValueChange={(value: ActionCenterStatus) => {
                            setStatus(value);
                            if ((value === "RESOLVED" || value === "DISMISSED") && assigneeId === UNASSIGNED && autoAssignToId) setAssigneeId(autoAssignToId);
                        }}>
                            <SelectTrigger id="action-status"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option} value={option}>{t(`action_center.status.${option}`)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="action-assignee">{t("action_center.fields.assignee")}</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                            <SelectTrigger id="action-assignee"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={UNASSIGNED}>{t("action_center.unassigned")}</SelectItem>
                                {assignees.map((person) => (
                                    <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="action-due-date">{t("action_center.fields.due_date")}</Label>
                        <Input id="action-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                    </div>
                    {requiresResolution && (
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="action-resolution">{t("action_center.fields.resolution")}</Label>
                            <Textarea
                                id="action-resolution"
                                value={resolution}
                                onChange={(event) => { setResolution(event.target.value); setResolutionEdited(true); }}
                                placeholder={t("action_center.fields.resolution_placeholder")}
                                rows={4}
                            />
                            {!canSubmit && <p className="text-xs text-destructive">{t("action_center.fields.resolution_required")}</p>}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{t("common.cancel")}</Button>
                    <Button onClick={() => void submit()} disabled={!canSubmit || pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("common.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ConvertActionDialogProps {
    item: ActionCenterItem;
    projects: ActionCenterProject[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (input: ConvertActionCenterItemInput) => Promise<void>;
    pending?: boolean;
}

export function ConvertActionDialog({ item, projects, open, onOpenChange, onSubmit, pending }: ConvertActionDialogProps) {
    const { t, i18n } = useTranslation();
    const localizedTitle = localizeActionText(item.title, item.metadata, t, i18n);
    const localizedDescription = item.description
        ? localizeActionText(item.description, item.metadata, t, i18n)
        : "";
    const [projectId, setProjectId] = useState(item.project?.id || "");
    const [title, setTitle] = useState(localizedTitle);
    const [description, setDescription] = useState(localizedDescription);
    const projectOptions = item.project && !projects.some((project) => project.id === item.project?.id)
        ? [item.project, ...projects]
        : projects;
    const valid = Boolean(projectId && title.trim());

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!valid || pending) return;
        try {
            await onSubmit({
                projectId,
                title: title.trim(),
                description: description.trim() || undefined,
                itemType: "OPERATIONAL",
            });
        } catch {
            // The owning mutation shows localized feedback and leaves the dialog available for retry.
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || !pending) onOpenChange(nextOpen); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <Wrench className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <DialogTitle>{t("action_center.actions.convert")}</DialogTitle>
                    <DialogDescription>{localizedTitle}</DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={submit}>
                    <div className="space-y-2">
                        <Label htmlFor="conversion-project">{t("common.project")}</Label>
                        <Select value={projectId} onValueChange={setProjectId} disabled={Boolean(item.project)}>
                            <SelectTrigger id="conversion-project"><SelectValue placeholder={t("action_center.filters.project")} /></SelectTrigger>
                            <SelectContent>
                                {projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="conversion-title">{t("common.title")}</Label>
                        <Input id="conversion-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} autoFocus />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="conversion-description">{t("common.description")}</Label>
                        <Textarea id="conversion-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={20_000} rows={6} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{t("common.cancel")}</Button>
                        <Button type="submit" disabled={!valid || pending}>
                            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("common.create")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface SnoozeActionDialogProps {
    item: ActionCenterItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (until: string) => Promise<void>;
    pending?: boolean;
}

export function SnoozeActionDialog({ item, open, onOpenChange, onSubmit, pending }: SnoozeActionDialogProps) {
    const { t, i18n } = useTranslation();
    const [minimumTime] = useState(() => Date.now());
    const [until, setUntil] = useState(() => {
        const initial = item?.snoozedUntil ? new Date(item.snoozedUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        return new Date(initial.getTime() - initial.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    });
    const localizedTitle = localizeActionText(item.title, item.metadata, t, i18n);
    const untilDate = until ? new Date(until) : undefined;
    const validUntil = Boolean(untilDate && !Number.isNaN(untilDate.getTime()) && untilDate.getTime() > minimumTime);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("action_center.snooze.title")}</DialogTitle>
                    <DialogDescription>{localizedTitle}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                    <Label htmlFor="snooze-until">{t("action_center.snooze.until")}</Label>
                    <Input id="snooze-until" type="datetime-local" min={toLocalDateTimeInput(new Date(minimumTime))} value={until} onChange={(event) => setUntil(event.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{t("common.cancel")}</Button>
                    <Button onClick={() => validUntil && untilDate && void onSubmit(untilDate.toISOString()).catch(() => undefined)} disabled={!validUntil || pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("action_center.snooze.submit")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function toLocalDateTimeInput(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
