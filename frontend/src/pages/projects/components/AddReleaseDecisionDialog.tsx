import { useMemo } from 'react';
import { z } from 'zod';
import { CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { releaseService } from '@/services/release.service';
import { logger } from '@/utils/logger';

type ReleaseDecisionType = 'SCOPE' | 'DELIVERY' | 'QUALITY';

interface AddReleaseDecisionDialogProps {
    projectId: string;
    releaseId: string;
    decisionType: ReleaseDecisionType;
}

export function AddReleaseDecisionDialog({ projectId, releaseId, decisionType }: AddReleaseDecisionDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const typeConfig: Record<ReleaseDecisionType, { title: string; icon: typeof ClipboardCheck; trigger: string }> = {
        SCOPE: {
            title: t('release.common.decision_types.SCOPE'),
            icon: ClipboardCheck,
            trigger: t('release.common.decision_types.SCOPE'),
        },
        DELIVERY: {
            title: t('release.common.decision_types.DELIVERY'),
            icon: CheckCircle2,
            trigger: t('release.common.decision_types.DELIVERY'),
        },
        QUALITY: {
            title: t('release.common.decision_types.QUALITY'),
            icon: ShieldCheck,
            trigger: t('release.common.decision_types.QUALITY'),
        },
    };
    const config = typeConfig[decisionType];

    const schema = z.object({
        outcome: z.enum(['APPROVED', 'REJECTED', 'CONDITIONAL', 'NEEDS_MORE_INFO']),
        rationale: z.string().min(3, t('release.decision_dialog.validation_rationale_min')),
        confidence: z.string().optional(),
    });

    type FormValues = z.infer<typeof schema>;

    const defaultValues = useMemo<FormValues>(() => ({
        outcome: 'APPROVED',
        rationale: '',
        confidence: '',
    }), []);

    async function onSubmit(values: FormValues) {
        try {
            await releaseService.addDecision(projectId, releaseId, {
                type: decisionType,
                outcome: values.outcome,
                rationale: values.rationale,
                confidence: values.confidence ? Number(values.confidence) : undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ['release-candidates', projectId] });
            await queryClient.invalidateQueries({ queryKey: ['release-candidate', projectId, releaseId] });
            await queryClient.invalidateQueries({ queryKey: ['release-candidate-ai-summary', projectId, releaseId] });
            toast.success(t('release.decision_dialog.toast.recorded', { title: config.title }));
        } catch (error) {
            logger.error(error);
            toast.error(t('release.decision_dialog.toast.error', { title: config.title }));
            throw error;
        }
    }

    return (
        <FormDialog<FormValues>
            trigger={<Button variant="outline" size="sm">{config.trigger}</Button>}
            title={config.title}
            description={t('release.decision_dialog.description')}
            icon={config.icon}
            schema={schema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitText={t('release.decision_dialog.submit')}
            renderFields={(form) => (
                <>
                    <FormField
                        control={form.control}
                        name="outcome"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.decision_dialog.fields.outcome')}</FormLabel>
                                <FormControl>
                                    <select
                                        aria-label={t('release.decision_dialog.fields.outcome')}
                                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                                        value={field.value}
                                        onChange={field.onChange}
                                    >
                                        <option value="APPROVED">{t('release.common.outcomes.APPROVED')}</option>
                                        <option value="CONDITIONAL">{t('release.common.outcomes.CONDITIONAL')}</option>
                                        <option value="REJECTED">{t('release.common.outcomes.REJECTED')}</option>
                                        <option value="NEEDS_MORE_INFO">{t('release.common.outcomes.NEEDS_MORE_INFO')}</option>
                                    </select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confidence"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.decision_dialog.fields.confidence')}</FormLabel>
                                <FormControl>
                                    <input
                                        aria-label={t('release.decision_dialog.fields.confidence')}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                                        placeholder={t('release.decision_dialog.placeholders.confidence')}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="rationale"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('release.decision_dialog.fields.rationale')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        aria-label={t('release.decision_dialog.fields.rationale')}
                                        placeholder={t('release.decision_dialog.placeholders.rationale')}
                                        className="min-h-[120px]"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </>
            )}
        />
    );
}

export default AddReleaseDecisionDialog;
