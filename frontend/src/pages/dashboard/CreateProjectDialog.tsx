import { z } from "zod"
import { FolderPlus, Plus } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FormDialog } from "@/components/ui/form-dialog"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { projectService } from "@/services/project.service"

interface CreateProjectDialogProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    showTrigger?: boolean
}

export function CreateProjectDialog({ open, onOpenChange, showTrigger = true }: CreateProjectDialogProps = {}) {
    const queryClient = useQueryClient()
    const { t } = useTranslation()

    const createProjectSchema = z.object({
        name: z
            .string()
            .trim()
            .min(1, t('create_project_dialog.validation.name_required')),
        description: z.string().optional(),
        scope: z.string().optional(),
        architecture: z.string().optional(),
    })

    type CreateProjectFormValues = z.infer<typeof createProjectSchema>

    async function onSubmit(data: CreateProjectFormValues) {
        try {
            await projectService.create(data)
            toast.success(t('create_project_dialog.success'))
            queryClient.invalidateQueries({ queryKey: ["projects"] })
        } catch (error) {
            logger.error(error)
            toast.error(t('create_project_dialog.error'))
            throw error // Re-throw to let FormDialog handle loading state ending if needed, though FormDialog handles loading via await. 
            // Actually generic FormDialog catches error and logs it. We handled toast here.
        }
    }

    const triggerButton = showTrigger ? (
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('create_project_dialog.submit')}
        </Button>
    ) : null

    return (
        <FormDialog<CreateProjectFormValues>
            open={open}
            onOpenChange={onOpenChange}
            trigger={triggerButton}
            title={t('create_project_dialog.title')}
            description={t('create_project_dialog.description')}
            icon={FolderPlus}
            schema={createProjectSchema}
            defaultValues={{
                name: "",
                description: "",
                scope: "",
                architecture: "",
            }}
            onSubmit={onSubmit}
            submitText={t('create_project_dialog.submit')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_project_dialog.name_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('create_project_dialog.name_placeholder')} {...field} className="border-primary/10 focus:border-primary/30 transition-all" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_project_dialog.description_label')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('create_project_dialog.description_placeholder')}
                                        {...field}
                                        className="border-primary/10 focus:border-primary/30 transition-all resize-none min-h-[100px]"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="scope"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_project_dialog.scope_label')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('create_project_dialog.scope_placeholder')}
                                        {...field}
                                        className="border-primary/10 focus:border-primary/30 transition-all resize-none min-h-[90px]"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="architecture"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_project_dialog.architecture_label')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('create_project_dialog.architecture_placeholder')}
                                        {...field}
                                        className="border-primary/10 focus:border-primary/30 transition-all resize-none min-h-[90px]"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </>
            )}
        />
    )
}
import { logger } from "@/utils/logger";
