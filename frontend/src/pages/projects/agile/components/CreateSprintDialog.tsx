import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sprintService, type CreateSprintInput } from "@/services/sprint.service";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function CreateSprintDialog({ open, onOpenChange, projectId: providedProjectId }: { open: boolean, onOpenChange: (open: boolean) => void, projectId?: string }) {
    const { t } = useTranslation();
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = providedProjectId ?? routeProjectId;
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [capacityPoints, setCapacityPoints] = useState("");

    const createSprint = useMutation({
        mutationFn: (data: CreateSprintInput) => sprintService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
            toast.success(t("create_sprint_dialog.toast.created"));
            onOpenChange(false);
            setName("");
            setStartDate("");
            setEndDate("");
            setCapacityPoints("");
        },
        onError: () => {
            toast.error(t("create_sprint_dialog.toast.create_error"));
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;

        createSprint.mutate({
            projectId,
            name,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            capacityPoints: capacityPoints ? Number(capacityPoints) : undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="create-sprint-dialog">
                <DialogHeader>
                    <DialogTitle>{t("create_sprint_dialog.title")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t("create_sprint_dialog.name_label")}</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("create_sprint_dialog.name_placeholder")} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="capacityPoints">{t("create_sprint_dialog.capacity_points", "Story point kapasitesi")}</Label>
                        <Input id="capacityPoints" type="number" min={1} value={capacityPoints} onChange={(event) => setCapacityPoints(event.target.value)} placeholder={t("create_sprint_dialog.capacity_points_placeholder", "Örn. 40")} />
                        <p className="text-xs text-muted-foreground">{t("create_sprint_dialog.capacity_points_help", "Sprint doluluğunu planlarken hedef toplam story point değeridir.")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">{t("create_sprint_dialog.start_date_label")}</Label>
                            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">{t("create_sprint_dialog.end_date_label")}</Label>
                            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
                        <Button type="submit" disabled={createSprint.isPending}>{t("common.create")}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
