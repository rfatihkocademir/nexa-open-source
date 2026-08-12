import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WORK_ITEM_TYPES, type ConfigurableWorkItemType } from '@/services/workItemPolicy.service';
import { workflowSchemeService, type WorkflowPolicy } from '@/services/workflow-scheme.service';

const EMPTY_POLICY = { requiresTestsForDone: false, requiresPassingTest: false, requiresWorklogForDone: false, minimumLoggedMinutes: 0, requiredFields: [] as string[] };

export function WorkflowPolicyManager({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [itemType, setItemType] = useState<ConfigurableWorkItemType>('TASK');
    const [drafts, setDrafts] = useState<Partial<Record<ConfigurableWorkItemType, typeof EMPTY_POLICY>>>({});
    const schemeQuery = useQuery({
        queryKey: ['workflow-scheme', projectId],
        queryFn: () => workflowSchemeService.get(projectId),
    });
    const policies = schemeQuery.data?.draftConfig.policies ?? [];
    const selected = policies.find((policy) => policy.itemType === itemType);
    const form = drafts[itemType] ?? (selected ? {
            requiresTestsForDone: selected.requiresTestsForDone,
            requiresPassingTest: selected.requiresPassingTest,
            requiresWorklogForDone: selected.requiresWorklogForDone,
            minimumLoggedMinutes: selected.minimumLoggedMinutes,
            requiredFields: selected.requiredFields,
        } : EMPTY_POLICY);
    const setForm = (updater: (current: typeof EMPTY_POLICY) => typeof EMPTY_POLICY) =>
        setDrafts((current) => ({ ...current, [itemType]: updater(form) }));

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!schemeQuery.data) throw new Error('Workflow draft is not loaded');
            const policy: WorkflowPolicy = { itemType, ...form };
            const nextPolicies = policies.some((entry) => entry.itemType === itemType)
                ? policies.map((entry) => entry.itemType === itemType ? policy : entry)
                : [...policies, policy];
            return workflowSchemeService.saveDraft(projectId, {
                ...schemeQuery.data.draftConfig,
                policies: nextPolicies,
            });
        },
        onSuccess: async () => {
            setDrafts((current) => {
                const next = { ...current };
                delete next[itemType];
                return next;
            });
            await queryClient.invalidateQueries({ queryKey: ['workflow-scheme', projectId] });
            toast.success(t('workflow_versioning.draft_saved'));
        },
        onError: () => toast.error(t('agile_board.policies.save_error')),
    });

    const toggle = (key: 'requiresTestsForDone' | 'requiresPassingTest' | 'requiresWorklogForDone', value: boolean) =>
        setForm((current) => ({ ...current, [key]: value }));

    return (
        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div><h3 className="text-sm font-semibold">{t('agile_board.policies.title')}</h3><p className="text-xs text-muted-foreground">{t('agile_board.policies.description')}</p></div>
            </div>
            <Select value={itemType} onValueChange={(value) => setItemType(value as ConfigurableWorkItemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WORK_ITEM_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`work_item_types.${type}`)}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-3">
                {(['requiresTestsForDone', 'requiresPassingTest', 'requiresWorklogForDone'] as const).map((key) => (
                    <label key={key} className="flex items-start gap-2 rounded-lg border p-3 text-xs">
                        <Checkbox checked={form[key]} onCheckedChange={(checked) => toggle(key, checked === true)} />
                        <span>{t(`agile_board.policies.${key}`)}</span>
                    </label>
                ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{t('agile_board.policies.minimum_minutes')}</Label><Input type="number" min={0} value={form.minimumLoggedMinutes} onChange={(event) => setForm((current) => ({ ...current, minimumLoggedMinutes: Math.max(0, Number(event.target.value)) }))} /></div>
                <div className="space-y-1.5"><Label>{t('agile_board.policies.required_fields')}</Label><Input value={form.requiredFields.join(', ')} onChange={(event) => setForm((current) => ({ ...current, requiredFields: event.target.value.split(',').map((field) => field.trim()).filter(Boolean) }))} placeholder="rollbackPlan, targetEnvironment" /></div>
            </div>
            <div className="flex justify-end"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !schemeQuery.data}>{t('common.save')}</Button></div>
        </div>
    );
}
