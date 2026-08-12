import { useMemo } from 'react';
import { z } from 'zod';
import { Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { releaseService } from '@/services/release.service';
import { testRunService } from '@/services/testRun.service';
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/utils/logger';

interface CreateReleaseCandidateDialogProps {
    projectId: string;
    trigger?: React.ReactNode;
    sourceRequestId?: string;
    initialTitle?: string;
    initialSummary?: string;
    onCreated?: (candidate: { id: string; key: string; title: string }) => void;
}

export function CreateReleaseCandidateDialog({
    projectId,
    trigger,
    sourceRequestId,
    initialTitle,
    initialSummary,
    onCreated,
}: CreateReleaseCandidateDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const schema = z.object({
        title: z.string().min(3, t('release.create_candidate_dialog.validation_title_min')),
        summary: z.string().optional(),
        label: z.string().optional(),
        testRunIds: z.array(z.string()).optional(),
    });

    type FormValues = z.infer<typeof schema>;

    const defaultValues = useMemo<FormValues>(() => ({
        title: initialTitle || '',
        summary: initialSummary || '',
        label: '',
        testRunIds: [],
    }), [initialSummary, initialTitle]);

    const { data: testRuns } = useQuery({
        queryKey: ['test-runs', projectId, 'release-candidate-dialog'],
        queryFn: () => testRunService.getAll(projectId),
        enabled: !!projectId,
    });

    async function onSubmit(values: FormValues) {
        try {
            const candidate = await releaseService.create(projectId, {
                title: values.title,
                summary: values.summary || undefined,
                label: values.label || undefined,
                sourceRequestId: sourceRequestId || undefined,
                testRunIds: values.testRunIds?.length ? values.testRunIds : undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ['release-candidates', projectId] });
            await queryClient.invalidateQueries({ queryKey: ['business-requests', projectId] });
            toast.success(t('release.create_candidate_dialog.toast.created'));
            onCreated?.({ id: candidate.id, key: candidate.key, title: candidate.title });
        } catch (error) {
            logger.error(error);
            toast.error(t('release.create_candidate_dialog.toast.create_error'));
            throw error;
        }
    }

    const defaultTrigger = (
        <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('release.create_candidate_dialog.trigger')}
        </Button>
    );

    return (
            <FormDialog<FormValues>
            trigger={trigger || defaultTrigger}
            title={t('release.create_candidate_dialog.title')}
            description={t('release.create_candidate_dialog.description')}
            icon={Rocket}
            schema={schema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitText={t('release.create_candidate_dialog.submit')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.create_candidate_dialog.fields.title')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('release.create_candidate_dialog.placeholders.title')} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="label"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.create_candidate_dialog.fields.label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('release.create_candidate_dialog.placeholders.label')} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="summary"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.create_candidate_dialog.fields.summary')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={t('release.create_candidate_dialog.placeholders.summary')}
                                        {...field}
                                        className="min-h-[120px]"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="testRunIds"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.create_candidate_dialog.fields.linked_runs')}</FormLabel>
                                <div className="max-h-44 space-y-2 overflow-auto rounded-md border border-input bg-secondary/30 p-3">
                                    {(testRuns?.data || []).length > 0 ? (
                                        testRuns!.data.map((run) => {
                                            const checked = field.value?.includes(run.id) || false;
                                            return (
                                                <label key={run.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border/60 hover:bg-background/70">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(nextChecked) => {
                                                            const current = field.value || [];
                                                            if (nextChecked) {
                                                                field.onChange([...current, run.id]);
                                                            } else {
                                                                field.onChange(current.filter((id: string) => id !== run.id));
                                                            }
                                                        }}
                                                    />
                                                    <div className="space-y-0.5">
                                                        <div className="text-sm font-medium">{run.title}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {t('release.create_candidate_dialog.run_meta', {
                                                                status: run.status,
                                                                environment: run.environment,
                                                                count: run.totalItems,
                                                            })}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('release.create_candidate_dialog.no_runs')}</p>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </>
            )}
        />
    );
}

export default CreateReleaseCandidateDialog;
