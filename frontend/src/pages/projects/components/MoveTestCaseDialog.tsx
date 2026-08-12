import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FolderInput, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { testSuiteService } from "@/services/testSuite.service"
import { testCaseService } from "@/services/testCase.service"
import type { TestSuite } from "@/types/testSuite"
import { logger } from "@/utils/logger";

interface MoveTestCaseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    testCaseId: string
    currentSuiteId: string
    projectId: string
    onSuccess?: () => void
}

export function MoveTestCaseDialog({
    open,
    onOpenChange,
    testCaseId,
    currentSuiteId,
    projectId,
    onSuccess
}: MoveTestCaseDialogProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [targetSuiteId, setTargetSuiteId] = useState<string>("")

    const { data: suites, isLoading: isLoadingSuites } = useQuery({
        queryKey: ["suites", projectId],
        queryFn: () => testSuiteService.getAll(projectId),
        enabled: open && !!projectId,
    })

    const moveMutation = useMutation({
        mutationFn: () => testCaseService.move(testCaseId, targetSuiteId),
        onSuccess: async () => {
            toast.success(t('test_case_list.move_success'))
            await queryClient.invalidateQueries({ queryKey: ["test-cases", currentSuiteId] })
            await queryClient.invalidateQueries({ queryKey: ["test-cases", targetSuiteId] })
            onOpenChange(false)
            if (onSuccess) onSuccess()
        },
        onError: (error) => {
            logger.error(error)
            toast.error(t('test_case_list.move_error'))
        }
    })

    const handleMove = () => {
        if (!targetSuiteId) return
        moveMutation.mutate()
    }

    // Filter out current suite from options and flatten hierarchy if needed
    // For now, assuming pure list or handle hierarchy visually in SelectItem if needed.
    // The service returns { items: TestSuite[], pagination } based on my reading of testSuite.service.ts
    const suiteOptions = suites?.items?.filter((s: TestSuite) => s.id !== currentSuiteId) || []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('test_case_list.move_case_title')}</DialogTitle>
                    <DialogDescription>
                        {t('test_case_list.move_case_description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="target-suite" className="text-right">
                            {t('test_case_list.target_suite')}
                        </Label>
                        <div className="col-span-3">
                            <Select
                                value={targetSuiteId}
                                onValueChange={setTargetSuiteId}
                                disabled={isLoadingSuites}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingSuites ? t('common.loading') : t('test_case_list.select_suite')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {suiteOptions.map((suite: TestSuite) => (
                                        <SelectItem key={suite.id} value={suite.id}>
                                            {suite.name}
                                        </SelectItem>
                                    ))}
                                    {suiteOptions.length === 0 && !isLoadingSuites && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            {t('test_case_list.no_other_suites')}
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleMove}
                        disabled={!targetSuiteId || moveMutation.isPending}
                    >
                        {moveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <FolderInput className="mr-2 h-4 w-4" />
                        {t('common.move')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
