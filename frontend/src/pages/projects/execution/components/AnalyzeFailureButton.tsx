import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { aiService } from "@/services/ai.service";
import type { FailureAnalysisResult } from "@/services/ai.service";
import { toast } from "sonner";
import { CreateBugDialog } from "../../agile/components/CreateBugDialog";
import { useTranslation } from "react-i18next";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AnalyzeFailureButtonProps {
    testResultId: string;
    projectId: string;
    className?: string;
    onComplete?: () => void;
}

export function AnalyzeFailureButton({ testResultId, projectId, className, onComplete }: AnalyzeFailureButtonProps) {
    const { t } = useTranslation()
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [bugDialogId, setBugDialogId] = useState(false);
    const [initialData, setInitialData] = useState<(FailureAnalysisResult & { testResultId: string }) | null>(null);

    const handleAnalyze = async (language: 'en' | 'tr') => {
        setIsAnalyzing(true);
        try {
            const result = await aiService.analyzeFailure(testResultId, language);
            setInitialData({
                ...result,
                testResultId
            });
            setBugDialogId(true);
            toast.success(t('analyze_failure_button.toast.success'));
        } catch {
            toast.error(t('analyze_failure_button.toast.error'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`text-primary border-primary/20 hover:bg-primary/5 ${className}`}
                        disabled={isAnalyzing}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isAnalyzing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {t('analyze_failure_button.label')}
                        <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAnalyze('tr'); }}>
                        🇹🇷 Türkçe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAnalyze('en'); }}>
                        🇺🇸 English
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <CreateBugDialog
                open={bugDialogId}
                onOpenChange={(open) => {
                    setBugDialogId(open);
                    if (!open) onComplete?.();
                }}
                projectId={projectId}
                initialData={initialData ?? undefined}
            />
        </>
    );
}
