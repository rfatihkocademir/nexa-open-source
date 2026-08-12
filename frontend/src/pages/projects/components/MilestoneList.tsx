import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, MoreVertical, Edit, Trash2, Flag, Eye, EyeOff, RotateCcw } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { milestoneService } from "@/services/milestone.service"
import { CreateMilestoneDialog } from "./CreateMilestoneDialog"
import { useTranslation, Trans } from "react-i18next"
import { useDateLocale } from "@/hooks/useDateLocale"
import { cn } from "@/lib/utils"
import { appRoutes } from "@/lib/routes"
import { logger } from "@/utils/logger";
import { useAppDialog } from "@/components/ui/app-dialog-context"

interface MilestoneListProps {
    projectId: string
}

export function MilestoneList({ projectId }: MilestoneListProps) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const dateLocale = useDateLocale()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const location = useLocation()
    const [showDeleted, setShowDeleted] = useState(false)

    const { data: response, isLoading } = useQuery({
        queryKey: ["milestones", projectId, showDeleted],
        queryFn: () => milestoneService.getAll(projectId, 1, 50, 'dueDate', 'asc', showDeleted),
    })

    const milestones = response?.data || []

    const handleDelete = async (id: string, hardDelete = false) => {
        if (!await confirm({ description: hardDelete ? 'Bu kayıt kalıcı olarak silinecek ve geri alınamayacak.' : t('milestone_list.delete_confirm'), confirmLabel: hardDelete ? 'Kalıcı sil' : 'Çöpe taşı', destructive: true })) return
        try {
            await milestoneService.delete(id, hardDelete)
            toast.success(t('milestone_list.delete_success'))
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(t('milestone_list.delete_error'))
        }
    }

    const handleRestore = async (id: string) => {
        try {
            await milestoneService.restore(id)
            toast.success(t('milestone_list.restore_success'))
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(t('milestone_list.restore_error'))
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )
    }

    if (!milestones || milestones.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-lg border-dashed">
                <Flag className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">{t('milestone_list.no_milestones_title')}</h3>
                <p className="mb-4 max-w-md mx-auto">
                    <Trans i18nKey="milestone_list.no_milestones_description">
                        Milestones help you organize your Test Runs into specific goals like
                        <span className="font-medium text-foreground"> "Sprint 1"</span>,
                        <span className="font-medium text-foreground"> "Beta Release"</span>, or
                        <span className="font-medium text-foreground"> "v1.0"</span>.
                    </Trans>
                </p>
                <CreateMilestoneDialog projectId={projectId} />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <PermissionGate permission="milestones:delete">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={cn("h-8 gap-2 text-xs", showDeleted ? "text-red-500" : "text-muted-foreground")}
                    >
                        {showDeleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {showDeleted ? t('common.hide_deleted') : t('common.show_deleted')}
                    </Button>
                </PermissionGate>
                <CreateMilestoneDialog projectId={projectId} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {milestones.map((milestone) => {
                    const isDeleted = !!(milestone as any).deletedAt
                    return (
                        <div
                            key={milestone.id}
                            className={cn(
                                "rounded-lg border bg-card text-card-foreground shadow-sm p-6 transition-colors",
                                isDeleted
                                    ? "opacity-50 border-red-500/20 bg-red-500/5"
                                    : "cursor-pointer hover:border-primary/50"
                            )}
                            onClick={() => {
                                if (!isDeleted) {
                                    navigate(appRoutes.resource(milestone.key), {
                                        state: { from: `${location.pathname}${location.search}` },
                                    })
                                }
                            }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <h4 className={cn("font-semibold leading-none tracking-tight flex items-center gap-2", isDeleted && "line-through")}>
                                        <Flag className={cn("h-4 w-4", isDeleted ? "text-red-400" : "text-primary")} />
                                        {milestone.name}
                                    </h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {milestone.description || t('milestone_list.no_description')}
                                    </p>
                                </div>
                                {isDeleted ? (
                                    <PermissionGate permission="milestones:update">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-green-600 hover:bg-green-500/10 hover:text-green-700"
                                            onClick={(e) => { e.stopPropagation(); handleRestore(milestone.id); }}
                                            title={t('common.restore')}
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    </PermissionGate>
                                ) : (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                <MoreVertical className="h-4 w-4" />
                                                <span className="sr-only">{t('common.actions')}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <CreateMilestoneDialog
                                                projectId={projectId}
                                                milestoneToEdit={milestone}
                                                trigger={
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        {t('milestone_list.edit_action')}
                                                    </DropdownMenuItem>
                                                }
                                            />
                                            <PermissionGate permission="milestones:delete">
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(milestone.id, false)
                                                    }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    {t('milestone_list.delete_action')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-700" onClick={() => handleDelete(milestone.id, true)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Kalıcı sil
                                                </DropdownMenuItem>
                                            </PermissionGate>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                            <div className="mt-4 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{milestone.dueDate ? format(new Date(milestone.dueDate), "d MMM yyyy", { locale: dateLocale }) : t('milestone_list.no_due_date')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isDeleted && (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                            {t('common.deleted')}
                                        </Badge>
                                    )}
                                    <Badge variant={milestone.status === 'OPEN' ? 'default' : 'secondary'}>
                                        {t(`common.statuses.${milestone.status}`)}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
