import { useMemo } from "react"
import { z } from "zod"
import { FolderOpen, Plus } from "lucide-react"
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
import { testSuiteService } from "@/services/testSuite.service"
import type { TestSuite } from "@/types/testSuite"
import { logger } from "@/utils/logger";

interface CreateSuiteDialogProps {
    projectId: string
    parentId?: string
    trigger?: React.ReactNode
    suiteToEdit?: TestSuite
}

export function CreateSuiteDialog({ projectId, parentId, trigger, suiteToEdit }: CreateSuiteDialogProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()

    const createSuiteSchema = z.object({
        name: z.string().min(1, t('create_suite_dialog.name_required')),
        description: z.string().optional(),
    })

    type CreateSuiteFormValues = z.infer<typeof createSuiteSchema>

    const defaultValues = useMemo(() => ({
        name: suiteToEdit?.name || "",
        description: suiteToEdit?.description || "",
    }), [suiteToEdit])

    async function onSubmit(data: CreateSuiteFormValues) {
        try {
            if (suiteToEdit) {
                await testSuiteService.update(suiteToEdit.id, data)
                toast.success(t('create_suite_dialog.update_success'))
            } else {
                await testSuiteService.create({
                    ...data,
                    projectId,
                    parentId,
                })
                toast.success(t('create_suite_dialog.create_success'))
            }
            await queryClient.invalidateQueries({ queryKey: ["test-suites", projectId] })
        } catch (error) {
            logger.error(error)
            toast.error(suiteToEdit ? t('create_suite_dialog.update_error') : t('create_suite_dialog.create_error'))
            throw error
        }
    }

    const defaultTrigger = (
        <Button id="create-suite-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('create_suite_dialog.create_title')}
        </Button>
    )

    // Dynamic title and description
    const title = suiteToEdit
        ? t('create_suite_dialog.edit_title')
        : parentId
            ? t('create_suite_dialog.create_sub_suite_title')
            : t('create_suite_dialog.create_title')

    const description = suiteToEdit
        ? t('create_suite_dialog.edit_description')
        : t('create_suite_dialog.create_description')

    return (
        <FormDialog<CreateSuiteFormValues>
            trigger={trigger || defaultTrigger}
            title={title}
            description={description}
            icon={FolderOpen}
            schema={createSuiteSchema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitText={suiteToEdit ? t('create_suite_dialog.save_button') : t('create_suite_dialog.create_button')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_suite_dialog.name_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('create_suite_dialog.name_placeholder')} {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
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
                                <FormLabel className="text-foreground/80">{t('create_suite_dialog.description_label')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('create_suite_dialog.description_placeholder')}
                                        {...field}
                                        className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all resize-none min-h-[100px]"
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
