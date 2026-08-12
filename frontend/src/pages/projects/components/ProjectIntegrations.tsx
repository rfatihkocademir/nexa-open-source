import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Webhook, Trash2, Plug } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { integrationService } from "@/services/integration.service"
import type { IntegrationType, CreateIntegrationDto } from "@/types/integration"
import { useAppDialog } from "@/components/ui/app-dialog-context"
import { JiraImportModal } from "@/components/jira/JiraImportModal"
import { Download } from "lucide-react"

interface ProjectIntegrationsProps {
    projectId: string
}

export function ProjectIntegrations({ projectId }: ProjectIntegrationsProps) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const queryClient = useQueryClient()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isJiraModalOpen, setIsJiraModalOpen] = useState(false)

    // Form states
    const [name, setName] = useState("")
    const [type, setType] = useState<IntegrationType | "">("")
    const [webhookUrl, setWebhookUrl] = useState("")
    const [secretToken, setSecretToken] = useState("")
    const [email, setEmail] = useState("")
    const [projectKey, setProjectKey] = useState("")
    const [xrayClientId, setXrayClientId] = useState("")
    const [xrayClientSecret, setXrayClientSecret] = useState("")

    const { data: integrations = [], isLoading } = useQuery({
        queryKey: ["integrations", projectId],
        queryFn: () => integrationService.getAll(projectId),
    })

    const createMutation = useMutation({
        mutationFn: (data: CreateIntegrationDto) => integrationService.create(projectId, data),
        onSuccess: () => {
            toast.success(t("project_integrations.toast.create_success"))
            queryClient.invalidateQueries({ queryKey: ["integrations", projectId] })
            setIsAddOpen(false)
            resetForm()
        },
        onError: () => {
            toast.error(t("project_integrations.toast.create_error"))
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => integrationService.delete(projectId, id),
        onSuccess: () => {
            toast.success(t("project_integrations.toast.delete_success"))
            queryClient.invalidateQueries({ queryKey: ["integrations", projectId] })
        },
        onError: () => {
            toast.error(t("project_integrations.toast.delete_error"))
        }
    })

    const resetForm = () => {
        setName("")
        setType("")
        setWebhookUrl("")
        setSecretToken("")
        setEmail("")
        setProjectKey("")
        setXrayClientId("")
        setXrayClientSecret("")
    }

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!type || !name || !webhookUrl || (type === "JIRA" && (!email || !secretToken))) return

        const config: Record<string, string> = { url: webhookUrl }
        if (type === "JIRA") {
            Object.assign(config, { email, apiToken: secretToken, projectKey })
            if (xrayClientId || xrayClientSecret) Object.assign(config, { xrayClientId, xrayClientSecret })
        } else if (secretToken) {
            Object.assign(config, { secret: secretToken })
        }

        const data: CreateIntegrationDto = {
            type: type as IntegrationType,
            name,
            config,
            events: type === "JIRA" ? [] : ['WORKITEM_CREATED', 'TEST_RUN_FAILED']
        }

        createMutation.mutate(data)
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <Card className="mt-6 border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <Webhook className="h-5 w-5 text-primary" />
                        {t("project_integrations.title")}
                    </CardTitle>
                    <CardDescription>
                        {t("project_integrations.description")}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsJiraModalOpen(true)}
                        className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 font-medium"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Jira'dan İçe Aktar
                    </Button>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                {t("project_integrations.add_integration")}
                            </Button>
                        </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>{t("project_integrations.add_new_integration")}</DialogTitle>
                            <DialogDescription>
                                {t("project_integrations.add_new_description")}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">{t("project_integrations.integration_type")}</Label>
                                <Select value={type} onValueChange={(v) => setType(v as IntegrationType)} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("project_integrations.select_type")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GITHUB">{t("project_integrations.types.GITHUB")}</SelectItem>
                                        <SelectItem value="GITLAB">{t("project_integrations.types.GITLAB")}</SelectItem>
                                        <SelectItem value="SLACK">{t("project_integrations.types.SLACK")}</SelectItem>
                                        <SelectItem value="JIRA">{t("project_integrations.types.JIRA")}</SelectItem>
                                        <SelectItem value="CUSTOM_WEBHOOK">{t("project_integrations.types.CUSTOM_WEBHOOK")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">{t("project_integrations.display_name")}</Label>
                                <Input
                                    id="name"
                                    placeholder={t("project_integrations.display_name_placeholder")}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="webhookUrl">{type === "JIRA" ? t("project_integrations.jira_url") : t("project_integrations.webhook_target_url")}</Label>
                                <Input
                                    id="webhookUrl"
                                    type="url"
                                    placeholder={type === "JIRA" ? "https://kurumunuz.atlassian.net" : t("project_integrations.webhook_target_placeholder")}
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    required
                                />
                            </div>

                            {type === "JIRA" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="jiraEmail">{t("project_integrations.jira_email")}</Label>
                                        <Input id="jiraEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="jiraProjectKey">{t("project_integrations.jira_project_key")}</Label>
                                        <Input id="jiraProjectKey" value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase())} placeholder="PROJ" />
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-3">
                                        <p className="mb-3 text-sm font-medium">{t("project_integrations.xray_optional")}</p>
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="xrayClientId">{t("project_integrations.xray_client_id")}</Label>
                                                <Input id="xrayClientId" value={xrayClientId} onChange={(event) => setXrayClientId(event.target.value)} autoComplete="off" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="xrayClientSecret">{t("project_integrations.xray_client_secret")}</Label>
                                                <Input id="xrayClientSecret" type="password" value={xrayClientSecret} onChange={(event) => setXrayClientSecret(event.target.value)} autoComplete="new-password" />
                                            </div>
                                            <p className="text-xs text-muted-foreground">{t("project_integrations.xray_help")}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="secretToken">{type === "JIRA" ? t("project_integrations.jira_api_token") : t("project_integrations.secret_token_optional")}</Label>
                                <Input
                                    id="secretToken"
                                    type="password"
                                    placeholder={t("project_integrations.secret_token_placeholder")}
                                    value={secretToken}
                                    onChange={(e) => setSecretToken(e.target.value)}
                                    required={type === "JIRA"}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t("project_integrations.save_integration")}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {integrations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Plug className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium">{t("project_integrations.no_integrations_title")}</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            {t("project_integrations.no_integrations_description")}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {integrations.map((integration) => {
                            const integrationUrl = integration.config.url || t("project_integrations.no_url_configured");

                            return (
                            <div key={integration.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                                        <Webhook className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm">{integration.name}</h4>
                                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                            <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium">
                                                {integration.type}
                                            </span>
                                            <span className="truncate max-w-[200px] md:max-w-xs" title={integrationUrl}>
                                                {integrationUrl}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="hidden sm:flex flex-wrap gap-1 items-center justify-end max-w-[200px]">
                                        {integration.webhooks?.map((w) => (
                                            <span key={w.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                {w.event}
                                            </span>
                                        ))}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={async () => {
                                            if (await confirm({
                                                description: t("project_integrations.delete_confirm"),
                                                confirmLabel: t("common.delete"),
                                                destructive: true,
                                            })) {
                                                deleteMutation.mutate(integration.id)
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                    >
                                        <span className="sr-only">{t('common.delete')}</span>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
            <JiraImportModal
                isOpen={isJiraModalOpen}
                onClose={() => setIsJiraModalOpen(false)}
                projectId={projectId}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["workItems", projectId] });
                    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                }}
            />
        </Card>
    )
}
