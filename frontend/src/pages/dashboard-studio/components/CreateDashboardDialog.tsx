import { Copy, LayoutDashboard, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateDashboardInput, DashboardDefinition, DashboardScope } from '@/types/dashboard-studio';

interface CreateDashboardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dashboards: DashboardDefinition[];
    projects: Array<{ id: string; key: string; name: string }>;
    canCreateProject: boolean;
    canCreateOrganization: boolean;
    isPending: boolean;
    projectsLoading?: boolean;
    initialCloneId?: string;
    onSubmit: (input: CreateDashboardInput) => void;
}

const NONE = '__none__';

export function CreateDashboardDialog({
    open,
    onOpenChange,
    dashboards,
    projects,
    canCreateProject,
    canCreateOrganization,
    isPending,
    projectsLoading = false,
    initialCloneId,
    onSubmit,
}: CreateDashboardDialogProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [scope, setScope] = useState<DashboardScope>('PERSONAL');
    const [projectId, setProjectId] = useState('');
    const [cloneFromId, setCloneFromId] = useState(initialCloneId || '');

    const valid = name.trim().length > 0 && (scope !== 'PROJECT' || Boolean(projectId));
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!valid || isPending) return;
        onSubmit({
            name: name.trim(),
            description: description.trim() || undefined,
            scope,
            projectId: scope === 'PROJECT' ? projectId : undefined,
            cloneFromId: cloneFromId || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || !isPending) onOpenChange(nextOpen); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-primary" />{t('dashboard_studio.create.title')}</DialogTitle>
                    <DialogDescription>{t('dashboard_studio.create.description')}</DialogDescription>
                </DialogHeader>
                <form className="space-y-5" onSubmit={submit}>
                    <div className="space-y-2">
                        <Label htmlFor="dashboard-name">{t('dashboard_studio.create.name')}</Label>
                        <Input id="dashboard-name" data-testid="create-dashboard-name-input" autoFocus value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={t('dashboard_studio.create.name_placeholder')} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dashboard-description">{t('dashboard_studio.create.details')}</Label>
                        <Textarea id="dashboard-description" data-testid="create-dashboard-desc-input" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder={t('dashboard_studio.create.details_placeholder')} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{t('dashboard_studio.create.visibility')}</Label>
                            <Select value={scope} onValueChange={(value) => setScope(value as DashboardScope)}>
                                <SelectTrigger data-testid="create-dashboard-visibility-select" aria-label={t('dashboard_studio.create.visibility')}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PERSONAL">{t('dashboard_studio.scope.PERSONAL')}</SelectItem>
                                    {canCreateProject && <SelectItem value="PROJECT">{t('dashboard_studio.scope.PROJECT')}</SelectItem>}
                                    {canCreateOrganization && <SelectItem value="ORGANIZATION">{t('dashboard_studio.scope.ORGANIZATION')}</SelectItem>}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{t(`dashboard_studio.scope_description.${scope}`)}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('dashboard_studio.create.clone_from')}</Label>
                            <Select value={cloneFromId || NONE} onValueChange={(value) => setCloneFromId(value === NONE ? '' : value)}>
                                <SelectTrigger data-testid="create-dashboard-clone-select" aria-label={t('dashboard_studio.create.clone_from')}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>{t('dashboard_studio.create.blank')}</SelectItem>
                                    {dashboards.map((dashboard) => <SelectItem key={dashboard.id} value={dashboard.id}>{dashboard.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Copy className="h-3 w-3" />{t('dashboard_studio.create.clone_hint')}</p>
                        </div>
                    </div>
                    {scope === 'PROJECT' && (
                        <div className="space-y-2">
                            <Label>{t('dashboard_studio.create.project')}</Label>
                            <Select value={projectId} onValueChange={setProjectId} disabled={projectsLoading}>
                                <SelectTrigger data-testid="create-dashboard-project-select" aria-label={t('dashboard_studio.create.project')}><SelectValue placeholder={t('dashboard_studio.create.project_placeholder')} /></SelectTrigger>
                                <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" data-testid="create-dashboard-cancel-btn" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{t('common.cancel')}</Button>
                        <Button type="submit" data-testid="create-dashboard-submit-btn" disabled={!valid || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('dashboard_studio.create.submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
