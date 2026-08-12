import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, MoreVertical, Edit, Trash2, Code } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { automationService } from "@/services/automation.service"
import { CreateStepDialog } from "./CreateStepDialog"
import { UpdateStepDialog } from "./UpdateStepDialog"
import type { AutomationStep } from "@/services/automation.service"
import { useTranslation } from "react-i18next"
import { useAppDialog } from "@/components/ui/app-dialog-context"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

interface AutomationStepsListProps {
    projectId: string
}

export function AutomationStepsList({ projectId }: AutomationStepsListProps) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const queryClient = useQueryClient()
    const [selectedStep, setSelectedStep] = useState<AutomationStep | undefined>(undefined)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [sortBy, setSortBy] = useState("name")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

    const { data: steps, isLoading } = useQuery({
        queryKey: ["automation-steps", projectId],
        queryFn: () => automationService.getSteps(projectId),
    })

    const handleDelete = async (id: string) => {
        if (!await confirm({ description: t('automation_steps_list.delete_confirm'), confirmLabel: t('common.delete'), destructive: true })) return
        try {
            await automationService.deleteStep(id)
            toast.success(t('automation_steps_list.delete_success'))
            queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(t('automation_steps_list.delete_error'))
        }
    }

    const handleEdit = (step: AutomationStep) => {
        setSelectedStep(step)
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setSelectedStep(undefined)
        setIsDialogOpen(true)
    }

    const sortedSteps = [...(steps ?? [])].sort((left, right) => {
        const leftValue = String(left[sortBy as keyof typeof left] ?? "")
        const rightValue = String(right[sortBy as keyof typeof right] ?? "")
        const result = leftValue.localeCompare(rightValue)
        return sortOrder === "asc" ? result : -result
    })

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setSortBy(field)
        setSortOrder("asc")
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{t('automation_steps_list.title')}</h3>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('automation_steps_list.add_step_button')}
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead sortKey="name" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('automation_steps_list.name_column')}</SortableTableHead>
                            <SortableTableHead sortKey="actionType" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('automation_steps_list.action_column')}</SortableTableHead>
                            <SortableTableHead sortKey="locator" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('automation_steps_list.locator_column')}</SortableTableHead>
                            <SortableTableHead sortKey="data" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t('automation_steps_list.data_column')}</SortableTableHead>
                            <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="w-[50px]">{null}</SortableTableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedSteps.map((step) => (
                            <TableRow key={step.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4 text-muted-foreground" />
                                        {step.name}
                                    </div>
                                    {step.description && (
                                        <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{step.actionType}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{step.locator}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {step.data || "-"}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                                <span className="sr-only">{t('common.actions')}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(step)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                {t('automation_steps_list.edit_action')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600"
                                                onClick={() => handleDelete(step.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                {t('automation_steps_list.delete_action')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {steps?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    {t('automation_steps_list.no_steps_found')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {
                selectedStep ? (
                    <UpdateStepDialog
                        step={selectedStep}
                        projectId={projectId}
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                        onStepUpdated={() => {
                            // Query invalidation is handled inside the component
                        }}
                    />
                ) : (
                    <CreateStepDialog
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                        projectId={projectId}
                        trigger={<></>} // Hide default trigger since we control it
                    />
                )
            }
        </div >
    )
}
import { logger } from "@/utils/logger";
