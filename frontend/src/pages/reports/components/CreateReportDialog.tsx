import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    FileBarChart2,
    FileText,
    Layers,
    Plus,
    Loader2,
    Download,
    Check
} from "lucide-react";

import { testRunService } from "@/services/testRun.service";
import { exportService } from "@/services/export.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function CreateReportDialog() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [selectedRunId, setSelectedRunId] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("executive");
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch test runs
    const { data: runsResponse, isLoading: isLoadingRuns } = useQuery({
        queryKey: ["testRuns", "list-for-reports"],
        queryFn: () => testRunService.getAll(undefined, undefined, 1, 100),
        enabled: isOpen,
    });

    const runs = useMemo(() => runsResponse?.data ?? [], [runsResponse?.data]);

    // Handle template changes to auto-fill report name
    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplate(templateId);
        const selectedRun = runs.find(r => r.id === selectedRunId);
        const runTitle = selectedRun ? selectedRun.title : "";
        
        let prefix = "";
        if (templateId === "executive") {
            prefix = t("reports.create_report_dialog.templates.executive.title");
        } else if (templateId === "detailed") {
            prefix = t("reports.create_report_dialog.templates.detailed.title");
        } else if (templateId === "comparison") {
            prefix = t("reports.create_report_dialog.templates.comparison.title");
        }
        
        setReportName(runTitle ? `${prefix} - ${runTitle}` : prefix);
    };

    // Handle run change
    const handleRunSelect = (runId: string) => {
        setSelectedRunId(runId);
        const selectedRun = runs.find(r => r.id === runId);
        const runTitle = selectedRun ? selectedRun.title : "";
        
        let prefix = "";
        if (selectedTemplate === "executive") {
            prefix = t("reports.create_report_dialog.templates.executive.title");
        } else if (selectedTemplate === "detailed") {
            prefix = t("reports.create_report_dialog.templates.detailed.title");
        } else if (selectedTemplate === "comparison") {
            prefix = t("reports.create_report_dialog.templates.comparison.title");
        }
        
        setReportName(runTitle ? `${prefix} - ${runTitle}` : prefix);
    };

    const handleGenerate = async () => {
        if (!selectedRunId) {
            toast.error(t("reports.create_report_dialog.select_run_error", "Lütfen bir test koşusu seçin."));
            return;
        }

        setIsGenerating(true);
        try {
            if (selectedTemplate === "detailed") {
                await exportService.exportTestRunResults(selectedRunId);
                toast.success(t("reports.create_report_dialog.generate_success_detailed", "Detaylı Çalıştırma Raporu başarıyla indirildi."));
            } else if (selectedTemplate === "comparison") {
                await exportService.exportComparisonReport(selectedRunId);
                toast.success(t("reports.create_report_dialog.generate_success_comparison", "Karşılaştırma Raporu başarıyla indirildi."));
            } else {
                // Executive template maps to the PDF report too
                await exportService.exportComparisonReport(selectedRunId);
                toast.success(t("reports.create_report_dialog.generate_success_executive", "Yönetici Özeti Raporu başarıyla indirildi."));
            }
            setIsOpen(false);
            // Reset form
            setReportName("");
            setSelectedRunId("");
            setSelectedTemplate("executive");
        } catch (error) {
            console.error("Report generation error:", error);
            toast.error(t("reports.create_report_dialog.generate_error", "Rapor oluşturulurken hata oluştu."));
        } finally {
            setIsGenerating(false);
        }
    };

    const templates = [
        {
            id: "executive",
            title: t("reports.create_report_dialog.templates.executive.title", "Yönetici Özeti"),
            description: t("reports.create_report_dialog.templates.executive.description", "Metrikler, genel geçiş oranları ve grafiklerle üst düzey yönetim için özet rapor."),
            icon: FileBarChart2,
            badge: "PDF",
            preview: (
                <div className="w-full h-24 bg-muted/40 rounded-lg border border-border/60 p-3 flex flex-col gap-2 relative overflow-hidden select-none">
                    <div className="flex justify-between items-center border-b border-border/40 pb-1">
                        <div className="w-12 h-2.5 bg-primary/40 rounded" />
                        <div className="w-6 h-2 bg-muted-foreground/30 rounded" />
                    </div>
                    <div className="flex gap-3 items-center mt-1">
                        <div className="w-9 h-9 rounded-full border-4 border-emerald-500/80 border-t-rose-500/80 rotate-45 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="w-full h-2 bg-emerald-500/20 rounded" />
                            <div className="w-[80%] h-2 bg-rose-500/20 rounded" />
                            <div className="w-[45%] h-2 bg-muted-foreground/20 rounded" />
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: "detailed",
            title: t("reports.create_report_dialog.templates.detailed.title", "Detaylı Çalıştırma"),
            description: t("reports.create_report_dialog.templates.detailed.description", "Tüm test senaryolarının detaylı adımları, süreleri ve hata çıktılarını içeren teknik rapor."),
            icon: FileText,
            badge: "XLSX",
            preview: (
                <div className="w-full h-24 bg-muted/40 rounded-lg border border-border/60 p-3 flex flex-col gap-2 relative overflow-hidden select-none">
                    <div className="grid grid-cols-4 gap-1.5 border-b border-border/60 pb-1.5">
                        <div className="h-2 bg-muted-foreground/40 rounded col-span-2" />
                        <div className="h-2 bg-muted-foreground/40 rounded" />
                        <div className="h-2 bg-muted-foreground/40 rounded" />
                    </div>
                    <div className="space-y-1 mt-0.5">
                        <div className="grid grid-cols-4 gap-1.5">
                            <div className="h-1.5 bg-muted-foreground/25 rounded col-span-2" />
                            <div className="h-1.5 bg-emerald-500/30 rounded" />
                            <div className="h-1.5 bg-muted-foreground/15 rounded" />
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            <div className="h-1.5 bg-muted-foreground/25 rounded col-span-2" />
                            <div className="h-1.5 bg-rose-500/30 rounded" />
                            <div className="h-1.5 bg-muted-foreground/15 rounded" />
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            <div className="h-1.5 bg-muted-foreground/25 rounded col-span-2" />
                            <div className="h-1.5 bg-amber-500/30 rounded" />
                            <div className="h-1.5 bg-muted-foreground/15 rounded" />
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: "comparison",
            title: t("reports.create_report_dialog.templates.comparison.title", "Karşılaştırma Raporu"),
            description: t("reports.create_report_dialog.templates.comparison.description", "Manuel ve otomasyon sonuçlarını kıyaslayarak aradaki kapsama açıklarını gösteren rapor."),
            icon: Layers,
            badge: "PDF",
            preview: (
                <div className="w-full h-24 bg-muted/40 rounded-lg border border-border/60 p-3 flex flex-col gap-2 relative overflow-hidden select-none">
                    <div className="flex gap-3 h-full">
                        <div className="flex-1 bg-primary/5 rounded border border-primary/20 p-2 flex flex-col justify-between">
                            <div className="w-8 h-2 bg-primary/30 rounded" />
                            <div className="w-10 h-3 bg-emerald-500/25 rounded" />
                        </div>
                        <div className="flex-1 bg-sky-500/5 rounded border border-sky-500/20 p-2 flex flex-col justify-between">
                            <div className="w-8 h-2 bg-sky-500/30 rounded" />
                            <div className="w-10 h-3 bg-sky-500/25 rounded" />
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("reports.create_report", "Rapor Oluştur")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <FileBarChart2 className="h-5.5 w-5.5 text-primary" />
                        {t("reports.create_report_dialog.title", "Yeni Rapor Oluştur")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("reports.create_report_dialog.description", "Bir test koşusu seçin ve görsel bir şablon kullanarak özel raporunuzu hazırlayın.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Select Test Run */}
                    <div className="space-y-2">
                        <Label htmlFor="test-run-select" className="text-sm font-semibold text-foreground/90">
                            {t("reports.create_report_dialog.select_run", "Test Koşusu Seçin")}
                        </Label>
                        <Select value={selectedRunId} onValueChange={handleRunSelect}>
                            <SelectTrigger id="test-run-select" className="w-full bg-muted/20 border-border/80 focus:border-primary/45 transition-colors">
                                <SelectValue placeholder={t("reports.create_report_dialog.select_run_placeholder", "Bir test koşusu seçin...")} />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingRuns ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                        <span className="text-xs text-muted-foreground">{t("common.loading", "Yükleniyor...")}</span>
                                    </div>
                                ) : runs.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                        {t("reports.no_reports_desc", "Henüz oluşturulmuş bir test koşusu yok.")}
                                    </div>
                                ) : (
                                    runs.map((run) => (
                                        <SelectItem key={run.id} value={run.id}>
                                            {run.title} ({run.environment}) - {new Date(run.createdAt).toLocaleDateString()}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Report Name */}
                    <div className="space-y-2">
                        <Label htmlFor="report-name" className="text-sm font-semibold text-foreground/90">
                            {t("reports.create_report_dialog.report_name", "Rapor Adı")}
                        </Label>
                        <Input
                            id="report-name"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            placeholder={t("reports.create_report_dialog.report_name_placeholder", "örn. QA Sprint 5 Yürütme Raporu")}
                            className="bg-muted/20 border-border/80 focus:border-primary/45 transition-colors"
                        />
                    </div>

                    {/* Template Selection - Visual Grid */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-foreground/90 flex justify-between items-center">
                            <span>{t("reports.create_report_dialog.select_template", "Rapor Şablonu Seçin")}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
                                {t("reports.create_report_dialog.templates_title", "Mevcut Şablonlar")}
                            </span>
                        </Label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {templates.map((tpl) => {
                                const Icon = tpl.icon;
                                const isSelected = selectedTemplate === tpl.id;
                                return (
                                    <div
                                        key={tpl.id}
                                        onClick={() => handleTemplateSelect(tpl.id)}
                                        className={cn(
                                            "relative flex flex-col gap-3 rounded-xl border p-4 cursor-pointer transition-all duration-300 bg-card hover:shadow-md hover:border-primary/30 group",
                                            isSelected 
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/30" 
                                                : "border-border/80"
                                        )}
                                    >
                                        {/* Badge */}
                                        <span className={cn(
                                            "absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border transition-colors",
                                            isSelected 
                                                ? "bg-primary/10 text-primary border-primary/20" 
                                                : "bg-muted text-muted-foreground border-border/60"
                                        )}>
                                            {tpl.badge}
                                        </span>

                                        <div className="flex items-center gap-2.5">
                                            <div className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                                                isSelected 
                                                    ? "bg-primary text-primary-foreground border-primary" 
                                                    : "bg-muted/60 text-muted-foreground border-border/80 group-hover:text-primary group-hover:border-primary/20 group-hover:bg-primary/5"
                                            )}>
                                                <Icon className="h-4.5 w-4.5" />
                                            </div>
                                            <div className="min-w-0 pr-10">
                                                <h4 className="font-bold text-sm text-foreground/95 truncate">
                                                    {tpl.title}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Visual Preview */}
                                        <div className="relative mt-1">
                                            {tpl.preview}
                                            {isSelected && (
                                                <div className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-scale-in">
                                                    <Check className="h-3 w-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {tpl.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 bg-muted/10">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={isGenerating}
                        className="border-border/80 hover:bg-muted/50"
                    >
                        {t("common.cancel", "İptal")}
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={!selectedRunId || isGenerating}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("common.generating", "Oluşturuluyor...")}
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                {t("reports.create_report_dialog.submit", "Raporu Hazırla ve İndir")}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
