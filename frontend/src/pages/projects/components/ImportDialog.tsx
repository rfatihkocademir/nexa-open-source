import { useState, useRef } from "react"
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { importService } from "@/services/import.service"
import { useTranslation } from "react-i18next"

interface ImportDialogProps {
    projectId: string
    trigger?: React.ReactNode
}

export function ImportDialog({ projectId, trigger }: ImportDialogProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [importResult, setImportResult] = useState<{ importedCount: number; errors?: string[] } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const queryClient = useQueryClient()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setImportResult(null)
        }
    }

    const handleImport = async () => {
        if (!file) return

        setIsLoading(true)
        setImportResult(null)
        try {
            const result = await importService.importExcel(projectId, file)
            setImportResult({
                importedCount: result.importedCount,
                errors: result.errors,
            })
            if (result.success) {
                toast.success(t('import_dialog.success_toast', { count: result.importedCount }))
                queryClient.invalidateQueries({ queryKey: ["suites", projectId] })
            } else {
                toast.error(t('import_dialog.error_toast'))
            }
        } catch (error) {
            logger.error(error)
            toast.error(t('import_dialog.generic_error'))
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        setOpen(false)
        setFile(null)
        setImportResult(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
                        <Upload className="mr-2 h-4 w-4" />
                        {t('import_dialog.trigger_button')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-background border-primary/10 shadow-2xl">
                <DialogHeader className="flex flex-row items-center gap-4 pb-2 border-b border-border/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {t('import_dialog.title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground/80">
                            {t('import_dialog.description')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-32 border-dashed flex flex-col gap-3 transition-all ${file
                                ? "border-primary/50 bg-primary/5 text-primary"
                                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                                }`}
                        >
                            {file ? (
                                <>
                                    <FileSpreadsheet className="h-8 w-8" />
                                    <div className="flex flex-col items-center">
                                        <span className="font-semibold text-sm">{file.name}</span>
                                        <span className="text-xs opacity-70">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                                    <div className="flex flex-col items-center text-muted-foreground">
                                        <span className="font-medium text-sm">{t('import_dialog.click_to_select')}</span>
                                        <span className="text-xs opacity-70">{t('import_dialog.supported_formats')}</span>
                                    </div>
                                </>
                            )}
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                        />
                    </div>

                    {importResult && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Alert variant={importResult.errors && importResult.errors.length > 0 ? "destructive" : "default"} className={importResult.errors && importResult.errors.length > 0 ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5"}>
                                {importResult.errors && importResult.errors.length > 0 ? (
                                    <AlertCircle className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                                <AlertTitle className={importResult.errors && importResult.errors.length > 0 ? "" : "text-green-700"}>{t('import_dialog.import_result_title')}</AlertTitle>
                                <AlertDescription className={importResult.errors && importResult.errors.length > 0 ? "" : "text-green-600/90"}>
                                    {t('import_dialog.import_success_description', { count: importResult.importedCount })}
                                </AlertDescription>
                            </Alert>
                            {importResult.errors && importResult.errors.length > 0 && (
                                <div className="max-h-[150px] overflow-y-auto rounded-xl border border-destructive/20 p-3 text-sm text-destructive bg-destructive/5 shadow-inner">
                                    <ul className="list-disc pl-4 space-y-1 text-xs">
                                        {importResult.errors.map((error, i) => (
                                            <li key={i}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={handleClose} className="hover:bg-muted/50">
                        {t('import_dialog.close_button')}
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!file || isLoading}
                        className=""
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('import_dialog.import_button')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
import { logger } from "@/utils/logger";
