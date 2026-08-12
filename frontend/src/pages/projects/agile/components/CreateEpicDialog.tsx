import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { epicService } from "@/services/epic.service";
import { wikiService } from "@/services/wiki.service";
import type { WikiPage } from "@/types/wiki";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface CreateEpicDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

interface DocumentationPageOption {
    id: string;
    label: string;
    spaceName: string;
}

type EpicPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

function getCreateEpicErrorMessage(error: unknown, fallback: string) {
    if (typeof error !== "object" || error === null || !("response" in error)) {
        return fallback;
    }

    const response = error.response;
    if (typeof response !== "object" || response === null || !("data" in response)) {
        return fallback;
    }

    const data = response.data;
    if (typeof data !== "object" || data === null || !("error" in data)) {
        return fallback;
    }

    return typeof data.error === "string" ? data.error : fallback;
}

function flattenPages(pages: WikiPage[], spaceName: string, level: number = 0): DocumentationPageOption[] {
    return pages.flatMap((page) => {
        const prefix = level > 0 ? `${"  ".repeat(level)}-> ` : "";
        const current: DocumentationPageOption = {
            id: page.id,
            label: `${prefix}${page.title}`,
            spaceName
        };

        const children = page.children ? flattenPages(page.children, spaceName, level + 1) : [];
        return [current, ...children];
    });
}

export function CreateEpicDialog({ open, onOpenChange, projectId }: CreateEpicDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<EpicPriority>("MEDIUM");
    const [documentationPageId, setDocumentationPageId] = useState("");

    const { data: documentationPages = [], isLoading: isLoadingDocumentation } = useQuery({
        queryKey: ["epic-documentation-pages", projectId],
        enabled: open && !!projectId,
        queryFn: async (): Promise<DocumentationPageOption[]> => {
            const spaces = await wikiService.getSpaces(projectId);
            const trees = await Promise.all(
                spaces.map(async (space) => ({
                    spaceName: space.name,
                    tree: await wikiService.getPageTree(space.id)
                }))
            );

            return trees.flatMap((item) => flattenPages(item.tree, item.spaceName));
        }
    });

    const hasDocumentationPages = documentationPages.length > 0;
    const selectedDocumentationPageId = documentationPageId || documentationPages[0]?.id || "";

    const createEpicMutation = useMutation({
        mutationFn: () => epicService.create({
            title,
            description: description || undefined,
            priority,
            projectId,
            documentationPageId: selectedDocumentationPageId,
        }),
        onSuccess: () => {
            toast.success(t("create_epic_dialog.toast.success"));
            queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
            queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
            handleOpenChange(false);
        },
        onError: (error: unknown) => {
            const message = getCreateEpicErrorMessage(error, t("create_epic_dialog.toast.error"));
            toast.error(message);
        }
    });

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setTitle("");
            setDescription("");
            setPriority("MEDIUM");
            setDocumentationPageId("");
        }
        onOpenChange(nextOpen);
    };

    const documentationOptions = useMemo(
        () => documentationPages.map((page) => ({
            ...page,
            displayLabel: `${page.spaceName} / ${page.label}`
        })),
        [documentationPages]
    );

    const isSubmitDisabled = !title.trim() || !selectedDocumentationPageId || createEpicMutation.isPending || !hasDocumentationPages;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent data-testid="create-epic-dialog" className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t("create_epic_dialog.title")}</DialogTitle>
                    <DialogDescription>{t("create_epic_dialog.description")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="epic-title">{t("create_epic_dialog.fields.title")}</Label>
                        <Input
                            id="epic-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={t("create_epic_dialog.placeholders.title")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="epic-description">{t("create_epic_dialog.fields.description")}</Label>
                        <Textarea
                            id="epic-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={4}
                            placeholder={t("create_epic_dialog.placeholders.description")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t("create_epic_dialog.fields.priority")}</Label>
                        <Select value={priority} onValueChange={(value) => setPriority(value as EpicPriority)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">{t("create_epic_dialog.priorities.LOW")}</SelectItem>
                                <SelectItem value="MEDIUM">{t("create_epic_dialog.priorities.MEDIUM")}</SelectItem>
                                <SelectItem value="HIGH">{t("create_epic_dialog.priorities.HIGH")}</SelectItem>
                                <SelectItem value="CRITICAL">{t("create_epic_dialog.priorities.CRITICAL")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t("create_epic_dialog.fields.documentation")}</Label>
                        {isLoadingDocumentation ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoadingSpinner size="sm" />
                                {t("create_epic_dialog.loading_docs")}
                            </div>
                        ) : hasDocumentationPages ? (
                            <Select value={selectedDocumentationPageId} onValueChange={setDocumentationPageId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {documentationOptions.map((page) => (
                                        <SelectItem key={page.id} value={page.id}>
                                            {page.displayLabel}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-sm text-amber-600">{t("create_epic_dialog.no_docs")}</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        {t("common.cancel")}
                    </Button>
                    <Button onClick={() => createEpicMutation.mutate()} disabled={isSubmitDisabled}>
                        {createEpicMutation.isPending ? (
                            <>
                                <LoadingSpinner size="sm" className="mr-2" />
                                {t("create_epic_dialog.submitting")}
                            </>
                        ) : (
                            t("create_epic_dialog.submit")
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
