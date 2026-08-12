import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import type { CaseStatus } from "@/types/testCase"

interface BulkActionsBarProps {
    selectedCount: number
    onDelete: (hardDelete: boolean) => void
    onStatusChange: (status: CaseStatus) => void
    isDeleting: boolean
    isUpdating: boolean
    canApprove?: boolean
    onClearSelection: () => void
}

export function BulkActionsBar({
    selectedCount,
    onDelete,
    onStatusChange,
    isDeleting,
    isUpdating,
    onClearSelection,
    canApprove = false,
}: BulkActionsBarProps) {
    const { t } = useTranslation()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isHardDelete, setIsHardDelete] = useState(false)

    if (selectedCount === 0) return null

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-2 flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 px-2 border-r">
                <span className="font-medium text-sm">
                    {t('test_case_list.items_selected', { count: selectedCount })}
                </span>
                <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-6 px-2 text-xs text-muted-foreground">
                    {t('common.cancel')}
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isUpdating}>
                            {t('test_case_list.update_status')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onStatusChange('DRAFT')}>
                            {t('common.statuses.DRAFT')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange('PENDING')}>
                            {t('common.statuses.PENDING')}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!canApprove} onClick={() => onStatusChange('APPROVED')}>
                            {t('common.statuses.APPROVED')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange('REVISE')}>
                            {t('common.statuses.REVISE')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-border mx-2" />

                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('test_case_list.delete_selected')}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('common.are_you_sure')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('common.delete_confirmation')}
                                <div className="mt-4 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="hardDelete"
                                        checked={isHardDelete}
                                        onChange={(e) => setIsHardDelete(e.target.checked)}
                                        className="h-4 w-4 rounded-lg border-gray-300"
                                    />
                                    <label htmlFor="hardDelete" className="text-sm cursor-pointer select-none">
                                        {t('common.hard_delete_warning')}
                                    </label>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    onDelete(isHardDelete)
                                    setShowDeleteDialog(false)
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {t('common.delete')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
