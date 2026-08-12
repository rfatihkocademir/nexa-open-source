import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"

interface CloseRunDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    isPending?: boolean
}

export function CloseRunDialog({ open, onOpenChange, onConfirm, isPending }: CloseRunDialogProps) {
    const { t } = useTranslation()

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        {t('test_run_details.close_run_title')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 pt-2">
                        <p>{t('test_run_details.close_run_desc')}</p>
                        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400 font-medium border border-green-500/20">
                            {t('test_run_details.close_run_warning')}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            onConfirm()
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={isPending}
                    >
                        {t('test_run_details.confirm_close')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
