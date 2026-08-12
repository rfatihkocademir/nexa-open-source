import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { releaseService } from '@/services/release.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReleaseAISummary } from '@/types/release';

type FollowUpAction = ReleaseAISummary['nextActions'][number];

type CreateReleaseFollowUpDialogProps = {
    projectId: string;
    releaseId: string;
    releaseTitle: string;
    action: FollowUpAction;
};

function mapPriority(priority: FollowUpAction['priority']) {
    if (priority === 'HIGH') return 'HIGH';
    if (priority === 'LOW') return 'LOW';
    return 'MEDIUM';
}

export function CreateReleaseFollowUpDialog({ projectId, releaseId, releaseTitle, action }: CreateReleaseFollowUpDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const isBugAction = action.targetFocus === 'critical-bugs';

    const defaults = useMemo(() => ({
        title: isBugAction
            ? t('release.follow_up_dialog.default_title_bug', { action: action.title, release: releaseTitle })
            : t('release.follow_up_dialog.default_title_item', { action: action.title, release: releaseTitle }),
        description: t('release.follow_up_dialog.default_description', {
            description: action.description,
            release: releaseTitle,
            focus: action.targetFocus,
        }),
    }), [action.description, action.targetFocus, action.title, isBugAction, releaseTitle, t]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            setTitle(defaults.title);
            setDescription(defaults.description);
        }
    };

    const mutation = useMutation({
        mutationFn: async () => releaseService.createFollowUp(projectId, releaseId, {
            itemType: isBugAction ? 'BUG' : 'STORY',
            title,
            description,
            priority: isBugAction ? undefined : mapPriority(action.priority),
            severity: isBugAction ? 'CRITICAL' : undefined,
            sourceActionType: action.type,
            sourceActionFocus: action.targetFocus,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['release-candidate', projectId, releaseId] });
            queryClient.invalidateQueries({ queryKey: ['release-candidates', projectId] });
            toast.success(isBugAction
                ? t('release.follow_up_dialog.toast.created_bug')
                : t('release.follow_up_dialog.toast.created_item'));
            setOpen(false);
        },
        onError: () => {
            toast.error(t('release.follow_up_dialog.toast.error'));
        },
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    {t('release.follow_up_dialog.trigger')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{isBugAction ? t('release.follow_up_dialog.title_bug') : t('release.follow_up_dialog.title_item')}</DialogTitle>
                    <DialogDescription>
                        {t('release.follow_up_dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="follow-up-title">{t('release.follow_up_dialog.fields.title')}</Label>
                        <Input
                            id="follow-up-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={t('release.follow_up_dialog.placeholders.title')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="follow-up-description">{t('release.follow_up_dialog.fields.description')}</Label>
                        <Textarea
                            id="follow-up-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={6}
                            placeholder={t('release.follow_up_dialog.placeholders.description')}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        {t('release.follow_up_dialog.cancel')}
                    </Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title.trim()}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isBugAction ? t('release.follow_up_dialog.create_bug') : t('release.follow_up_dialog.create_item')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
