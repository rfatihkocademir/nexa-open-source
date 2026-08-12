import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { projectService } from "@/services/project.service"
import type { Project } from "@/types/project"
import { ProjectMembers } from "./ProjectMembers"
import { WorkConfigurationManager } from "./WorkConfigurationManager"
import { WorkAutomationManager } from "./WorkAutomationManager"
import { EnterpriseMigrationCenter } from "./EnterpriseMigrationCenter"

import { useTranslation } from "react-i18next"
import { logger } from "@/utils/logger";

type UpdateProjectFormValues = {
    name: string
    description?: string
    primaryTeamId?: string
}

interface ProjectSettingsProps {
    project: Project
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState("")
    const { data: teams = [] } = useQuery({ queryKey: ['project-available-teams'], queryFn: projectService.getAvailableTeams })

    const updateProjectSchema = z.object({
        name: z.string().min(1, t('project_settings.name_required')),
        description: z.string().optional(),
        primaryTeamId: z.string().uuid().optional(),
    })

    const form = useForm<UpdateProjectFormValues>({
        resolver: zodResolver(updateProjectSchema),
        defaultValues: {
            name: project.name,
            description: project.description || "",
            primaryTeamId: project.primaryTeamId || undefined,
        },
    })

    async function onUpdate(data: UpdateProjectFormValues) {
        setIsUpdating(true)
        try {
            await projectService.update(project.id, data)
            toast.success(t('project_settings.update_success'))
            await queryClient.invalidateQueries({ queryKey: ["project", project.id] })
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
            await queryClient.invalidateQueries({ queryKey: ["project-resource"] })
        } catch (error) {
            logger.error(error)
            toast.error(t('project_settings.update_error'))
        } finally {
            setIsUpdating(false)
        }
    }

    async function onArchive() {
        setIsUpdating(true)
        try {
            await projectService.archive(project.id)
            toast.success(t('project_settings.archive_success'))
            await queryClient.invalidateQueries({ queryKey: ["project", project.id] })
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
            navigate("/projects")
        } catch (error) {
            logger.error(error)
            toast.error(t('project_settings.archive_error'))
        } finally {
            setIsUpdating(false)
        }
    }

    async function onUnarchive() {
        setIsUpdating(true)
        try {
            await projectService.unarchive(project.id)
            toast.success(t('project_settings.unarchive_success'))
            await queryClient.invalidateQueries({ queryKey: ["project", project.id] })
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
        } catch (error) {
            logger.error(error)
            toast.error(t('project_settings.unarchive_error'))
        } finally {
            setIsUpdating(false)
        }
    }

    async function onDelete() {
        setIsDeleting(true)
        try {
            await projectService.delete(project.id)
            toast.success(t('project_settings.delete_success'))
            // Await invalidation to ensure next query fetches fresh data
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
            navigate("/")
        } catch (error) {
            logger.error(error)
            toast.error(t('project_settings.delete_error'))
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('project_settings.general_title')}</CardTitle>
                    <CardDescription>
                        {t('project_settings.general_description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('project_settings.name_label')}</FormLabel>
                                        <FormControl>
                                            <Input data-testid="project-settings-name-input" placeholder={t('project_settings.name_placeholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="primaryTeamId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Birincil ekip</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Birincil ekip"><SelectValue placeholder="Projeden sorumlu ekibi seçin" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name} · /{team.slug}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>Bu ekip URL’nin ilk segmentinde görünür ve bağlantının sahipliğini açıklar.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('project_settings.description_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('project_settings.description_placeholder')}
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            {t('project_settings.description_help')}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <Button data-testid="project-settings-save-btn" type="submit" disabled={isUpdating}>
                                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('project_settings.save_button')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <ProjectMembers project={project} />
            <WorkConfigurationManager projectId={project.id} />
            <WorkAutomationManager projectId={project.id} />
            <EnterpriseMigrationCenter projectId={project.id} />

            <Card className="border-amber-200">
                <CardHeader>
                    <CardTitle className="text-amber-600">{t('project_settings.archive_title')}</CardTitle>
                    <CardDescription>
                        {t('project_settings.archive_description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-medium">
                                {project.status === 'ARCHIVED' ? t('project_settings.unarchive_button') : t('project_settings.archive_button')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {project.status === 'ARCHIVED'
                                    ? t('project_settings.restore_help')
                                    : t('project_settings.archive_help')}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className={project.status === 'ARCHIVED'
                                ? "border-green-200 hover:bg-green-50 text-green-700"
                                : "border-amber-200 hover:bg-amber-50 text-amber-700"}
                            onClick={project.status === 'ARCHIVED' ? onUnarchive : onArchive}
                            disabled={isUpdating}
                            data-testid={project.status === 'ARCHIVED' ? "project-settings-unarchive-btn" : "project-settings-archive-btn"}
                        >
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {project.status === 'ARCHIVED' ? t('project_settings.unarchive_button') : t('project_settings.archive_button')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-red-200">
                <CardHeader>
                    <CardTitle className="text-red-600">{t('project_settings.danger_zone_title')}</CardTitle>
                    <CardDescription>
                        {t('project_settings.danger_zone_description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-medium">{t('project_settings.delete_title')}</h4>
                            <p className="text-sm text-muted-foreground">
                                {t('project_settings.delete_description')}
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button data-testid="project-settings-delete-trigger" variant="destructive" className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('project_settings.delete_button')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-background border-primary/10 shadow-2xl">
                                <AlertDialogHeader className="flex flex-row items-center gap-4 space-y-0">
                                    <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shadow-sm">
                                        <Trash2 className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <AlertDialogTitle className="text-lg font-bold">{t('project_settings.delete_confirm_title')}</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground/80">
                                            {t('project_settings.delete_confirm_description', { name: project.name })}
                                            <br /><br />
                                            {t('project_settings.type_to_confirm', { name: project.name })}
                                        </AlertDialogDescription>
                                    </div>
                                </AlertDialogHeader>
                                <div className="py-2">
                                    <Input
                                        data-testid="project-settings-delete-confirm-input"
                                        value={deleteConfirmation}
                                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                                        placeholder={t('project_settings.confirm_placeholder')}
                                        className="border-red-200 focus-visible:ring-red-500"
                                    />
                                </div>
                                <AlertDialogFooter className="pt-2">
                                    <AlertDialogCancel onClick={() => setDeleteConfirmation("")} className="hover:bg-muted/50">{t('project_settings.cancel_button')}</AlertDialogCancel>
                                    <AlertDialogAction
                                        data-testid="project-settings-delete-confirm-btn"
                                        onClick={onDelete}
                                        disabled={deleteConfirmation !== project.name || isDeleting}
                                        className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            t('project_settings.delete_button')
                                        )}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
