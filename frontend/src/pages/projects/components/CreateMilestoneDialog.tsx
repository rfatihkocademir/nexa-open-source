import { useMemo } from "react"
import { z } from "zod"
import { Flag, Plus } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
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
import { milestoneService } from "@/services/milestone.service"
import type { Milestone } from "@/types/milestone"
import { logger } from "@/utils/logger";

interface CreateMilestoneDialogProps {
    projectId: string
    trigger?: React.ReactNode
    milestoneToEdit?: Milestone
}

export function CreateMilestoneDialog({ projectId, trigger, milestoneToEdit }: CreateMilestoneDialogProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()

    const createMilestoneSchema = z.object({
        name: z.string().min(1, t('create_milestone_dialog.name_required')),
        description: z.string().optional(),
        dueDate: z.string().optional(),
    })

    type CreateMilestoneFormValues = z.infer<typeof createMilestoneSchema>

    const defaultValues = useMemo(() => ({
        name: milestoneToEdit?.name || "",
        description: milestoneToEdit?.description || "",
        dueDate: milestoneToEdit?.dueDate ? format(new Date(milestoneToEdit.dueDate), "yyyy-MM-dd") : "",
    }), [milestoneToEdit])

    async function onSubmit(data: CreateMilestoneFormValues) {
        try {
            const payload = {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
            }

            if (milestoneToEdit) {
                await milestoneService.update(milestoneToEdit.id, payload)
                toast.success(t('create_milestone_dialog.update_success'))
            } else {
                await milestoneService.create({
                    ...payload,
                    projectId,
                })
                toast.success(t('create_milestone_dialog.create_success'))
            }
            await queryClient.invalidateQueries({ queryKey: ["milestones", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(milestoneToEdit ? t('create_milestone_dialog.update_error') : t('create_milestone_dialog.create_error'))
            throw error
        }
    }

    const defaultTrigger = (
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('create_milestone_dialog.create_title')}
        </Button>
    )

    return (
        <FormDialog<CreateMilestoneFormValues>
            trigger={trigger || defaultTrigger}
            title={milestoneToEdit ? t('create_milestone_dialog.edit_title') : t('create_milestone_dialog.create_title')}
            description={milestoneToEdit
                ? t('create_milestone_dialog.edit_description')
                : t('create_milestone_dialog.create_description')}
            icon={Flag}
            schema={createMilestoneSchema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitText={milestoneToEdit ? t('create_milestone_dialog.save_button') : t('create_milestone_dialog.create_button')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_milestone_dialog.name_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('create_milestone_dialog.name_placeholder')} {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
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
                                <FormLabel className="text-foreground/80">{t('create_milestone_dialog.description_label')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('create_milestone_dialog.description_placeholder')}
                                        {...field}
                                        className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all resize-none min-h-[100px]"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_milestone_dialog.due_date_label')}</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
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
