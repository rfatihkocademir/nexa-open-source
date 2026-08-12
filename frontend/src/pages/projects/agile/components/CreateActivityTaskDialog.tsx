import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { storyService } from '@/services/story.service';
import { useAuthStore } from '@/store/authStore';
import { readAutoDraft, useAutoDraft } from '@/hooks/useAutoDraft';
import { AutoDraftStatus } from '@/components/forms/AutoDraftStatus';
import { DynamicWorkFields } from '@/components/forms/DynamicWorkFields';

const ACTIVITY_TYPES = ['OPERATIONAL', 'MEETING', 'PRESENTATION', 'SUPPORT', 'ADMINISTRATIVE'] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];

export function CreateActivityTaskDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { t } = useTranslation();
    const userId = useAuthStore((state) => state.user?.id || 'anonymous');
    const queryClient = useQueryClient();
    const draftKey = `nexa-draft:${userId}:activity:${projectId}`;
    const initialDraft = readAutoDraft<{ type: ActivityType; title: string; description: string; targetEnvironment: string; rollbackPlan: string }>(draftKey)?.data;
    const [type, setType] = useState<ActivityType>(initialDraft?.type || 'OPERATIONAL');
    const [title, setTitle] = useState(initialDraft?.title || '');
    const [description, setDescription] = useState(initialDraft?.description || '');
    const [targetEnvironment, setTargetEnvironment] = useState(initialDraft?.targetEnvironment || '');
    const [rollbackPlan, setRollbackPlan] = useState(initialDraft?.rollbackPlan || '');
    const [workTypeId, setWorkTypeId] = useState('');
    const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
    const [customFieldsValid, setCustomFieldsValid] = useState(true);
    const draftValue = useMemo(() => ({ type, title, description, targetEnvironment, rollbackPlan }), [description, rollbackPlan, targetEnvironment, title, type]);
    const autoDraft = useAutoDraft({
        key: draftKey,
        value: draftValue,
        enabled: open && Boolean(title.trim() || description.trim() || targetEnvironment.trim() || rollbackPlan.trim()),
    });

    const mutation = useMutation({
        mutationFn: () => storyService.create({
            projectId,
            itemType: type,
            title: title.trim(),
            description: description.trim() || undefined,
            status: 'TODO',
            customFields: type === 'OPERATIONAL' ? { targetEnvironment, rollbackPlan } : {},
            workTypeId: workTypeId || undefined,
            ...(Object.keys(customFields).length ? { customFields: { ...(type === 'OPERATIONAL' ? { targetEnvironment, rollbackPlan } : {}), ...customFields } } : {}),
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['stories', projectId] });
            toast.success(t('activity_task.created'));
            autoDraft.clear();
            setTitle(''); setDescription(''); setTargetEnvironment(''); setRollbackPlan(''); onOpenChange(false);
        },
        onError: () => toast.error(t('activity_task.create_error')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="create-activity-task-dialog" className="sm:max-w-[560px]">
                <DialogHeader><DialogTitle>{t('activity_task.title')}</DialogTitle><DialogDescription>{t('activity_task.description')}</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5"><Label>{t('activity_task.type')}</Label><Select value={type} onValueChange={(value) => setType(value as ActivityType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIVITY_TYPES.map((itemType) => <SelectItem key={itemType} value={itemType}>{t(`work_item_types.${itemType}`)}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>{t('common.title')}</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                    <div className="space-y-1.5"><Label>{t('common.description')}</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
                    {type === 'OPERATIONAL' && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{t('activity_task.target_environment')}</Label><Input value={targetEnvironment} onChange={(event) => setTargetEnvironment(event.target.value)} /></div><div className="space-y-1.5"><Label>{t('activity_task.rollback_plan')}</Label><Input value={rollbackPlan} onChange={(event) => setRollbackPlan(event.target.value)} /></div></div>}
                    <DynamicWorkFields projectId={projectId} baseType={type} workTypeId={workTypeId} values={customFields} onWorkTypeChange={setWorkTypeId} onValuesChange={setCustomFields} onValidityChange={setCustomFieldsValid} />
                </div>
                <DialogFooter className="items-center sm:justify-between"><AutoDraftStatus savedAt={autoDraft.savedAt} isSaving={autoDraft.isSaving} /><div className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button disabled={!title.trim() || !customFieldsValid || mutation.isPending} onClick={() => mutation.mutate()}>{t('common.create')}</Button></div></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
