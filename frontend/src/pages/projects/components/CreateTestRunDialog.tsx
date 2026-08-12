import { z } from "zod"
import { PlayCircle, Plus } from "lucide-react"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FormDialog } from "@/components/ui/form-dialog"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { testRunService } from "@/services/testRun.service"
import { milestoneService } from "@/services/milestone.service"
import { logger } from "@/utils/logger";

interface CreateTestRunDialogProps {
    projectId?: string
    trigger?: React.ReactNode
}

export function CreateTestRunDialog({ projectId, trigger }: CreateTestRunDialogProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const isGlobal = !projectId

    const { data: response } = useQuery({
        queryKey: ["milestones", projectId],
        queryFn: () => milestoneService.getAll(projectId!),
        enabled: !!projectId,
    })

    const milestones = response?.data || []

    const createTestRunSchema = z.object({
        title: z.string().min(3, t('create_test_run_dialog.validation.title_min_length')),
        milestoneId: z.string().optional(),
        environment: z.enum(['DEV', 'QA', 'PREPROD', 'PROD']),
        startDate: z.string().optional(),
        dueDate: z.string().optional(),
        includeAllCases: z.boolean(),
    })

    type CreateTestRunFormValues = z.infer<typeof createTestRunSchema>

    async function onSubmit(data: CreateTestRunFormValues) {
        try {
            if (!isGlobal && !projectId) {
                toast.error(t('create_test_run_dialog.missing_project_id'))
                return
            }

            const payload = {
                ...data,
                projectId,
                milestoneId: isGlobal || data.milestoneId === "none" ? undefined : data.milestoneId,
                includeAllCases: isGlobal ? false : data.includeAllCases,
                startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
            }

            await testRunService.create(payload)
            toast.success(t('create_test_run_dialog.create_success'))

            if (isGlobal) {
                await queryClient.invalidateQueries({ queryKey: ["global-runs"] })
            } else {
                await queryClient.invalidateQueries({ queryKey: ["test-runs", projectId] })
            }
        } catch (error) {
            logger.error(error)
            toast.error(t('create_test_run_dialog.create_error'))
            throw error
        }
    }

    const triggerButton = trigger || (
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            {isGlobal ? t('create_test_run_dialog.create_global_button') : t('create_test_run_dialog.create_button')}
        </Button>
    )

    return (
        <FormDialog<CreateTestRunFormValues>
            trigger={triggerButton}
            title={isGlobal ? t('create_test_run_dialog.create_global_title') : t('create_test_run_dialog.create_title')}
            description={isGlobal
                ? t('create_test_run_dialog.create_global_description')
                : t('create_test_run_dialog.create_description')}
            icon={PlayCircle}
            schema={createTestRunSchema}
            defaultValues={{
                title: "",
                milestoneId: "none",
                environment: "QA",
                startDate: "",
                dueDate: "",
                includeAllCases: !isGlobal,
            }}
            onSubmit={onSubmit}
            submitText={t('create_test_run_dialog.create_button')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_test_run_dialog.title_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('create_test_run_dialog.title_placeholder')} {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {!isGlobal && (
                        <FormField
                            control={form.control}
                            name="milestoneId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground/80">{t('create_test_run_dialog.milestone_label')}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all">
                                                <SelectValue placeholder={t('create_test_run_dialog.milestone_placeholder')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">{t('create_test_run_dialog.no_milestone')}</SelectItem>
                                            {milestones?.map((milestone) => (
                                                <SelectItem key={milestone.id} value={milestone.id}>
                                                    {milestone.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription className="text-xs">
                                        {t('create_test_run_dialog.milestone_description')}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                    <FormField
                        control={form.control}
                        name="environment"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_test_run_dialog.environment_label')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all">
                                            <SelectValue placeholder={t('create_test_run_dialog.environment_placeholder')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="DEV">{t('create_test_run_dialog.environments.DEV')}</SelectItem>
                                        <SelectItem value="QA">{t('create_test_run_dialog.environments.QA')}</SelectItem>
                                        <SelectItem value="PREPROD">{t('create_test_run_dialog.environments.PREPROD')}</SelectItem>
                                        <SelectItem value="PROD">{t('create_test_run_dialog.environments.PROD')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground/80">{t('create_test_run_dialog.start_date_label')}</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
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
                                    <FormLabel className="text-foreground/80">{t('create_test_run_dialog.due_date_label')}</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    {!isGlobal && (
                        <FormField
                            control={form.control}
                            name="includeAllCases"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-primary/10 bg-muted/20 p-4 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base font-semibold">{t('create_test_run_dialog.include_all_cases_label')}</FormLabel>
                                        <FormDescription className="text-xs">
                                            {t('create_test_run_dialog.include_all_cases_description')}
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                </>
            )}
        />
    )
}
