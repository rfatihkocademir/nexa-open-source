import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, Trash2, History, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { testCaseService } from "@/services/testCase.service"
import { aiService } from "@/services/ai.service"
import type { TestCase } from "@/types/testCase"
import { VersionHistory } from "./VersionHistory"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useTranslation } from "react-i18next"
import { logger } from "@/utils/logger";
import { useAuthStore } from "@/store/authStore"
import { readAutoDraft, useAutoDraft } from "@/hooks/useAutoDraft"
import { AutoDraftStatus } from "@/components/forms/AutoDraftStatus"

type CreateTestCaseFormValues = {
    title: string
    description?: string
    preconditions?: string
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    steps: { action: string; expected: string }[]
}

interface TestCaseDialogProps {
    suiteId?: string
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    testCaseToEdit?: TestCase
}

export function TestCaseDialog({ suiteId, projectId, open, onOpenChange, testCaseToEdit }: TestCaseDialogProps) {
    const { t } = useTranslation()
    const userId = useAuthStore((state) => state.user?.id || "anonymous")
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()
    const draftKey = `nexa-draft:${userId}:test-case:${testCaseToEdit?.id || suiteId}`

    const stepSchema = z.object({
        action: z.string().min(1, t('create_test_case_sheet.validation.action_required')),
        expected: z.string().min(1, t('create_test_case_sheet.validation.expected_required')),
    })

    const createTestCaseSchema = z.object({
        title: z.string().min(3, t('create_test_case_sheet.validation.title_min')),
        description: z.string().optional(),
        preconditions: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        steps: z.array(stepSchema).min(1, t('create_test_case_sheet.validation.steps_min')),
    })

    const form = useForm<CreateTestCaseFormValues>({
        resolver: zodResolver(createTestCaseSchema),
        defaultValues: {
            title: "",
            description: "",
            preconditions: "",
            priority: "MEDIUM",
            steps: [{ action: "", expected: "" }],
        },
    })

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "steps",
    })
    const watchedValues = form.watch()
    const autoDraft = useAutoDraft({
        key: draftKey,
        value: watchedValues,
        enabled: open && form.formState.isDirty,
    })

    // Reset form when opening or changing testCaseToEdit
    useEffect(() => {
        if (open) {
            const savedDraft = readAutoDraft<CreateTestCaseFormValues>(draftKey)
            if (savedDraft) {
                form.reset(savedDraft.data)
                return
            }
            if (testCaseToEdit) {
                form.reset({
                    title: testCaseToEdit.title,
                    description: testCaseToEdit.description || "",
                    preconditions: testCaseToEdit.preconditions || "",
                    priority: testCaseToEdit.priority,
                    steps: (testCaseToEdit.steps && testCaseToEdit.steps.length > 0)
                        ? testCaseToEdit.steps.map((s: { action?: string; expected?: string; expectedResult?: string }) => ({
                            action: s.action || "",
                            expected: s.expected ?? s.expectedResult ?? ""
                        }))
                        : [{ action: "", expected: "" }],
                })
            } else {
                form.reset({
                    title: "",
                    description: "",
                    preconditions: "",
                    priority: "MEDIUM",
                    steps: [{ action: "", expected: "" }],
                })
            }
        }
    }, [draftKey, testCaseToEdit, form, open])

    async function onSubmit(data: CreateTestCaseFormValues) {
        setIsLoading(true)
        try {
            const normalizedData = {
                ...data,
                steps: data.steps.map((step) => ({
                    action: step.action.trim(),
                    expected: step.expected.trim(),
                })),
            }
            if (testCaseToEdit) {
                await testCaseService.update(testCaseToEdit.id, normalizedData)
                toast.success(t('create_test_case_sheet.update_success'))
            } else {
                await testCaseService.create({
                    ...normalizedData,
                    ...(suiteId ? { suiteId } : { projectId }),
                })
                toast.success(t('create_test_case_sheet.create_success'))
            }
            autoDraft.clear()
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: ["test-cases", suiteId] })
        } catch (error) {
            logger.error(error)
            toast.error(testCaseToEdit ? t('create_test_case_sheet.update_error') : t('create_test_case_sheet.create_error'))
        } finally {
            setIsLoading(false)
        }
    }

    const [aiLanguage, setAiLanguage] = useState(t('common.language_code') === 'tr' ? 'tr' : 'en')

    const generateStepsWithAI = async () => {
        const title = form.getValues("title")
        if (!title) {
            toast.error(t('create_test_case_sheet.title_required_for_ai'))
            return
        }

        setIsLoading(true)
        try {
            const steps = await aiService.generateSteps(projectId, title, undefined, aiLanguage)
            replace(steps.map((step) => ({
                action: step.action || "",
                expected: step.expected || (step as { expectedResult?: string }).expectedResult || "",
            })))
            toast.success(t('create_test_case_sheet.steps_generated_success'))
        } catch {
            toast.error(t('create_test_case_sheet.steps_generation_error'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between mr-8">
                        <div>
                            <DialogTitle>{testCaseToEdit ? t('create_test_case_sheet.edit_title') : t('create_test_case_sheet.create_title')}</DialogTitle>
                            <DialogDescription>
                                {testCaseToEdit ? t('create_test_case_sheet.edit_description') : t('create_test_case_sheet.create_description')}
                            </DialogDescription>
                        </div>
                        {testCaseToEdit && (
                            <VersionHistory
                                testCaseId={testCaseToEdit.id}
                                trigger={
                                    <Button variant="outline" size="sm">
                                        <History className="mr-2 h-4 w-4" />
                                        {t('create_test_case_sheet.history')}
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>{t('create_test_case_sheet.title_label')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('create_test_case_sheet.title_placeholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('create_test_case_sheet.priority_label')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('create_test_case_sheet.priority_placeholder')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="LOW">{t('create_test_case_sheet.priorities.LOW')}</SelectItem>
                                                <SelectItem value="MEDIUM">{t('create_test_case_sheet.priorities.MEDIUM')}</SelectItem>
                                                <SelectItem value="HIGH">{t('create_test_case_sheet.priorities.HIGH')}</SelectItem>
                                                <SelectItem value="CRITICAL">{t('create_test_case_sheet.priorities.CRITICAL')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('create_test_case_sheet.description_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('create_test_case_sheet.description_placeholder')}
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="preconditions"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('create_test_case_sheet.preconditions_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('create_test_case_sheet.preconditions_placeholder')}
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>{t('create_test_case_sheet.steps_label')}</Label>
                                <div className="flex gap-2 items-center">
                                    <Tabs value={aiLanguage} onValueChange={(v) => setAiLanguage(v)}>
                                        <TabsList className="h-8">
                                            <TabsTrigger value="tr" className="text-[10px] px-2 h-6">TR</TabsTrigger>
                                            <TabsTrigger value="en" className="text-[10px] px-2 h-6">EN</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={generateStepsWithAI}
                                        disabled={isLoading}
                                        className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Wand2 className="mr-2 h-4 w-4" />
                                        )}
                                        {t('create_test_case_sheet.generate_ai')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => append({ action: "", expected: "" })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {t('create_test_case_sheet.add_step')}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground px-4">
                                    <div className="col-span-1">#</div>
                                    <div className="col-span-5">{t('create_test_case_sheet.action_placeholder')}</div>
                                    <div className="col-span-5">{t('create_test_case_sheet.expected_placeholder')}</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-4 items-start p-2 rounded-md hover:bg-muted/30">
                                        <div className="col-span-1 pt-3 text-sm text-center text-muted-foreground">
                                            {index + 1}
                                        </div>
                                        <div className="col-span-5">
                                            <FormField
                                                control={form.control}
                                                name={`steps.${index}.action`}
                                                render={({ field }) => (
                                                    <FormItem className="space-y-0">
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder={t('create_test_case_sheet.action_placeholder')}
                                                                className="min-h-[60px] resize-y"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="col-span-5">
                                            <FormField
                                                control={form.control}
                                                name={`steps.${index}.expected`}
                                                render={({ field }) => (
                                                    <FormItem className="space-y-0">
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder={t('create_test_case_sheet.expected_placeholder')}
                                                                className="min-h-[60px] resize-y"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="col-span-1 pt-2 flex justify-center">
                                            {fields.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(index)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">{t('common.delete')}</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {form.formState.errors.steps?.root?.message && (
                                <p className="text-[0.8rem] font-medium text-destructive">
                                    {form.formState.errors.steps.root.message}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="items-center sm:justify-between">
                            <AutoDraftStatus savedAt={autoDraft.savedAt} isSaving={autoDraft.isSaving} />
                            <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {testCaseToEdit ? t('create_test_case_sheet.update_button') : t('create_test_case_sheet.create_button')}
                            </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
