import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitPullRequestArrow, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDialog } from '@/components/ui/app-dialog-context';
import { WORK_ITEM_TYPES, type ConfigurableWorkItemType } from '@/services/workItemPolicy.service';
import { workflowSchemeService, type WorkflowTransition } from '@/services/workflow-scheme.service';

const ROLES = ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER', 'TESTER', 'ANALYST'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function WorkflowTransitionManager({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const queryClient = useQueryClient();
    const key = ['workflow-scheme', projectId];
    const scheme = useQuery({ queryKey: key, queryFn: () => workflowSchemeService.get(projectId) });
    const columns = scheme.data?.draftConfig.columns ?? [];
    const transitions = scheme.data?.draftConfig.transitions ?? [];
    const [editingId, setEditingId] = useState<string>();
    const [name, setName] = useState('');
    const [fromColumnId, setFromColumnId] = useState('');
    const [toColumnId, setToColumnId] = useState('');
    const [itemType, setItemType] = useState<'ALL' | ConfigurableWorkItemType>('ALL');
    const [roles, setRoles] = useState<string[]>([]);
    const [assigneeRequired, setAssigneeRequired] = useState(false);
    const [allowedPriorities, setAllowedPriorities] = useState<string[]>([]);
    const [requiredFields, setRequiredFields] = useState('');
    const [minimumMinutes, setMinimumMinutes] = useState(0);
    const [testRequired, setTestRequired] = useState(false);
    const [setPriority, setSetPriority] = useState('NONE');
    const [assignReporter, setAssignReporter] = useState(false);
    const [comment, setComment] = useState('');
    const selectedFromColumnId = fromColumnId || columns[0]?.id || '';
    const selectedToColumnId = toColumnId || columns[1]?.id || '';

    const reset = () => {
        setEditingId(undefined); setName(''); setFromColumnId(columns[0]?.id ?? ''); setToColumnId(columns[1]?.id ?? '');
        setItemType('ALL'); setRoles([]); setAssigneeRequired(false); setAllowedPriorities([]); setRequiredFields('');
        setMinimumMinutes(0); setTestRequired(false); setSetPriority('NONE'); setAssignReporter(false); setComment('');
    };
    const edit = (transition: WorkflowTransition) => {
        setEditingId(transition.id); setName(transition.name); setFromColumnId(transition.fromColumnId); setToColumnId(transition.toColumnId);
        setItemType(transition.itemTypes[0] ?? 'ALL');
        setRoles(transition.conditions.find((entry) => entry.type === 'ROLE_ALLOWED')?.values ?? []);
        setAssigneeRequired(transition.conditions.some((entry) => entry.type === 'ASSIGNEE_REQUIRED'));
        setAllowedPriorities(transition.conditions.find((entry) => entry.type === 'PRIORITY_ALLOWED')?.values ?? []);
        setRequiredFields(transition.validators.find((entry) => entry.type === 'REQUIRED_FIELDS')?.fields?.join(', ') ?? '');
        setMinimumMinutes(transition.validators.find((entry) => entry.type === 'MIN_WORKLOG')?.minimumMinutes ?? 0);
        setTestRequired(transition.validators.some((entry) => entry.type === 'TEST_CASE_REQUIRED'));
        setSetPriority(transition.postActions.find((entry) => entry.type === 'SET_PRIORITY')?.value ?? 'NONE');
        setAssignReporter(transition.postActions.some((entry) => entry.type === 'ASSIGN_REPORTER'));
        setComment(transition.postActions.find((entry) => entry.type === 'ADD_COMMENT')?.value ?? '');
    };
    const save = useMutation({
        mutationFn: async () => {
            if (!scheme.data || !name.trim() || !selectedFromColumnId || !selectedToColumnId || selectedFromColumnId === selectedToColumnId) throw new Error(t('workflow_transitions.form_error'));
            const fields = requiredFields.split(',').map((field) => field.trim()).filter(Boolean);
            const transition: WorkflowTransition = {
                id: editingId ?? crypto.randomUUID(), name: name.trim(), fromColumnId: selectedFromColumnId, toColumnId: selectedToColumnId,
                itemTypes: itemType === 'ALL' ? [] : [itemType],
                conditions: [
                    ...(roles.length ? [{ type: 'ROLE_ALLOWED' as const, values: roles }] : []),
                    ...(assigneeRequired ? [{ type: 'ASSIGNEE_REQUIRED' as const, values: [] }] : []),
                    ...(allowedPriorities.length ? [{ type: 'PRIORITY_ALLOWED' as const, values: allowedPriorities }] : []),
                ],
                validators: [
                    ...(fields.length ? [{ type: 'REQUIRED_FIELDS' as const, fields }] : []),
                    ...(minimumMinutes > 0 ? [{ type: 'MIN_WORKLOG' as const, minimumMinutes }] : []),
                    ...(testRequired ? [{ type: 'TEST_CASE_REQUIRED' as const }] : []),
                ],
                postActions: [
                    ...(setPriority !== 'NONE' ? [{ type: 'SET_PRIORITY' as const, value: setPriority }] : []),
                    ...(assignReporter ? [{ type: 'ASSIGN_REPORTER' as const }] : []),
                    ...(comment.trim() ? [{ type: 'ADD_COMMENT' as const, value: comment.trim() }] : []),
                ],
            };
            const next = editingId ? transitions.map((entry) => entry.id === editingId ? transition : entry) : [...transitions, transition];
            return workflowSchemeService.saveDraft(projectId, { ...scheme.data.draftConfig, transitions: next });
        },
        onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }); reset(); toast.success(t('workflow_versioning.draft_saved')); },
        onError: (error) => toast.error(error instanceof Error ? error.message : t('workflow_transitions.save_error')),
    });
    const remove = async (id: string) => {
        if (!scheme.data || !await confirm({ description: t('workflow_transitions.delete_confirm'), confirmLabel: t('common.delete'), destructive: true })) return;
        try {
            await workflowSchemeService.saveDraft(projectId, { ...scheme.data.draftConfig, transitions: transitions.filter((entry) => entry.id !== id) });
            await queryClient.invalidateQueries({ queryKey: key });
            if (editingId === id) reset();
            toast.success(t('workflow_versioning.draft_saved'));
        } catch { toast.error(t('workflow_transitions.save_error')); }
    };
    const toggle = (values: string[], value: string, checked: boolean) => checked ? [...values, value] : values.filter((entry) => entry !== value);

    return <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-start justify-between gap-3"><div className="flex gap-2"><GitPullRequestArrow className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="text-sm font-semibold">{t('workflow_transitions.title')}</h3><p className="text-xs text-muted-foreground">{t('workflow_transitions.description')}</p></div></div>{editingId && <Button variant="outline" size="sm" onClick={reset}><Plus className="mr-1 h-4 w-4" />{t('workflow_transitions.new')}</Button>}</div>
        <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5"><Label>{t('common.name')}</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('workflow_transitions.from')}</Label><Select value={selectedFromColumnId} onValueChange={setFromColumnId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t('workflow_transitions.to')}</Label><Select value={selectedToColumnId} onValueChange={setToColumnId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t('workflow_transitions.item_type')}</Label><Select value={itemType} onValueChange={(value) => setItemType(value as typeof itemType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t('common.all')}</SelectItem>{WORK_ITEM_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`work_item_types.${type}`)}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
            <RuleBox title={t('workflow_transitions.conditions')} icon={<ShieldCheck className="h-4 w-4" />}>
                <CheckGrid values={ROLES} selected={roles} onToggle={(value, checked) => setRoles(toggle(roles, value, checked))} />
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={assigneeRequired} onCheckedChange={(value) => setAssigneeRequired(value === true)} />{t('workflow_transitions.assignee_required')}</label>
                <Label className="text-xs">{t('workflow_transitions.allowed_priorities')}</Label><CheckGrid values={PRIORITIES} selected={allowedPriorities} onToggle={(value, checked) => setAllowedPriorities(toggle(allowedPriorities, value, checked))} />
            </RuleBox>
            <RuleBox title={t('workflow_transitions.validators')}><Input value={requiredFields} onChange={(event) => setRequiredFields(event.target.value)} placeholder={t('workflow_transitions.required_fields')} /><Input type="number" min={0} value={minimumMinutes} onChange={(event) => setMinimumMinutes(Math.max(0, Number(event.target.value)))} placeholder={t('workflow_transitions.minimum_worklog')} /><label className="flex items-center gap-2 text-xs"><Checkbox checked={testRequired} onCheckedChange={(value) => setTestRequired(value === true)} />{t('workflow_transitions.test_required')}</label></RuleBox>
            <RuleBox title={t('workflow_transitions.post_actions')}><Select value={setPriority} onValueChange={setSetPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">{t('workflow_transitions.keep_priority')}</SelectItem>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-xs"><Checkbox checked={assignReporter} onCheckedChange={(value) => setAssignReporter(value === true)} />{t('workflow_transitions.assign_reporter')}</label><Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t('workflow_transitions.comment')} /></RuleBox>
        </div>
        <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending || columns.length < 2}>{editingId ? t('common.update') : t('common.add')}</Button></div>
        <div className="space-y-2">{transitions.map((transition) => <div key={transition.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{transition.name}</div><div className="flex flex-wrap gap-1 pt-1 text-xs text-muted-foreground"><span>{columns.find((entry) => entry.id === transition.fromColumnId)?.name} → {columns.find((entry) => entry.id === transition.toColumnId)?.name}</span><Badge variant="outline">{transition.itemTypes[0] ? t(`work_item_types.${transition.itemTypes[0]}`) : t('common.all')}</Badge><Badge variant="secondary">{t('workflow_transitions.rule_count', { count: transition.conditions.length + transition.validators.length + transition.postActions.length })}</Badge></div></div><div className="flex shrink-0"><Button variant="ghost" size="icon" aria-label={`${transition.name} düzenle`} title={`${transition.name} düzenle`} onClick={() => edit(transition)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`${transition.name} sil`} title={`${transition.name} sil`} onClick={() => void remove(transition.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
    </div>;
}

function RuleBox({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
    return <div className="space-y-3 rounded-lg border bg-muted/15 p-3"><h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h4>{children}</div>;
}
function CheckGrid({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string, checked: boolean) => void }) {
    return <div className="flex flex-wrap gap-2">{values.map((value) => <label key={value} className="flex items-center gap-1.5 rounded border px-2 py-1 text-[11px]"><Checkbox checked={selected.includes(value)} onCheckedChange={(checked) => onToggle(value, checked === true)} />{value}</label>)}</div>;
}
