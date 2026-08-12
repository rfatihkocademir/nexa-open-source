import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Code, Save, Cpu } from "lucide-react";
import { aiPomService } from "@/services/aiPom.service";
import type { ProjectElement } from "@/services/aiPom.service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface POMGeneratorProps {
    projectId: string;
    onElementsUpdated?: () => void;
}

export function POMGenerator({ projectId, onElementsUpdated }: POMGeneratorProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // HTML Extraction State
    const [htmlSnippet, setHtmlSnippet] = useState("");
    const [extractedElements, setExtractedElements] = useState<Partial<ProjectElement>[]>([]);

    const extractMutation = useMutation({
        mutationFn: () => aiPomService.extractFromHtml(projectId, htmlSnippet),
        onSuccess: (data) => {
            setExtractedElements(data);
            toast.success(t("pom_generator.extract_success"));
        },
        onError: () => toast.error(t("pom_generator.extract_failed"))
    });

    const saveMutation = useMutation({
        mutationFn: (element: Partial<ProjectElement>) => aiPomService.saveElement(projectId, element),
        onSuccess: () => {
            toast.success(t("pom_generator.save_success"));
            queryClient.invalidateQueries({ queryKey: ["pomElements", projectId] });
            if (onElementsUpdated) onElementsUpdated();
        },
        onError: () => toast.error(t("pom_generator.save_failed"))
    });

    const handleExtract = () => {
        if (!htmlSnippet.trim()) {
            toast.error(t("pom_generator.empty_html"));
            return;
        }
        extractMutation.mutate();
    };

    const handleSaveElement = (el: Partial<ProjectElement>, index: number) => {
        // Optimistically remove from list
        setExtractedElements(prev => prev.filter((_, i) => i !== index));
        saveMutation.mutate(el);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col space-y-2">
                <Textarea
                    placeholder={t('pom_generator.html_placeholder')}
                    className="min-h-[200px] font-mono text-xs dark:bg-muted/30"
                    value={htmlSnippet}
                    onChange={(e) => setHtmlSnippet(e.target.value)}
                />
                <Button
                    onClick={handleExtract}
                    disabled={extractMutation.isPending || !htmlSnippet.trim()}
                    className="self-end"
                >
                    {extractMutation.isPending ? (
                        <><Cpu className="w-4 h-4 mr-2 animate-pulse" /> {t('pom_generator.analyzing')}</>
                    ) : (
                        <><Code className="w-4 h-4 mr-2" /> {t('pom_generator.extract_button')}</>
                    )}
                </Button>
            </div>

            {extractMutation.isPending && (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            )}

            {extractedElements.length > 0 && (
                <div className="border rounded-md overflow-hidden text-sm">
                    <div className="bg-muted px-4 py-2 font-medium flex justify-between items-center text-xs">
                        <span>{t('pom_generator.found_elements', { count: extractedElements.length })}</span>
                        <span className="text-muted-foreground">{t('pom_generator.save_hint')}</span>
                    </div>
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                        {extractedElements.map((el, idx) => (
                            <div key={idx} className="p-3 hover:bg-muted/50 transition-colors flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-primary">{el.name}</span>
                                            <Badge variant="outline" className="text-[10px] h-5">{el.type}</Badge>
                                        </div>
                                        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                                            {el.locator}
                                        </code>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleSaveElement(el, idx)}>
                                        <Save className="w-4 h-4 text-green-500" />
                                    </Button>
                                </div>
                                {el.description && (
                                    <p className="text-[11px] text-muted-foreground italic">{el.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
