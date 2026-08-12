import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, MousePointer2, Keyboard, Eye, Clock, Globe, List, Cookie, Database, Network, AlertTriangle, Copy, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { automationService, ActionType, type AutomationStep } from "@/services/automation.service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTranslation, Trans } from "react-i18next"
import { logger } from "@/utils/logger";

interface UpdateStepDialogProps {
    step: AutomationStep
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onStepUpdated: (updatedStep: AutomationStep) => void
}

export function UpdateStepDialog({ step, projectId, open, onOpenChange, onStepUpdated }: UpdateStepDialogProps) {
    const { t } = useTranslation()

    // Initialize state from step prop
    const [name, setName] = useState(step.name)
    const [actionType, setActionType] = useState<string>(step.actionType)
    const [locator, setLocator] = useState(step.locator)
    const [data, setData] = useState(step.data || "")
    const [description, setDescription] = useState(step.description || "")
    const [pageObject, setPageObject] = useState(step.pageObject || "")

    // API Request State - Parse from step.data if it's an API request
    const parseApiConfig = (stepData: string | undefined) => {
        if (!stepData) return {
            method: "POST", body: "", outputVar: "", responsePath: "",
            targetType: "NONE" as const, targetKey: "", targetDomain: ""
        }
        try {
            const config = JSON.parse(stepData)
            return {
                method: config.method || "POST",
                body: config.body ? JSON.stringify(config.body, null, 2) : "",
                outputVar: config.outputVar || "",
                responsePath: config.responsePath || "",
                targetType: (config.targetType as "COOKIE" | "LOCAL_STORAGE" | "NONE") || "NONE",
                targetKey: config.targetKey || "",
                targetDomain: config.targetDomain || ""
            }
        } catch (e) {
            logger.error("Failed to parse API config", e)
            return {
                method: "POST", body: "", outputVar: "", responsePath: "",
                targetType: "NONE" as const, targetKey: "", targetDomain: ""
            }
        }
    }

    const initialApiConfig = step.actionType === ActionType.API_REQUEST ? parseApiConfig(step.data) : parseApiConfig(undefined)

    const [apiMethod, setApiMethod] = useState(initialApiConfig.method)
    const [apiBody, setApiBody] = useState(initialApiConfig.body)
    const [apiOutputVar, setApiOutputVar] = useState(initialApiConfig.outputVar)
    const [apiResponsePath, setApiResponsePath] = useState(initialApiConfig.responsePath)
    const [apiTargetType, setApiTargetType] = useState<"COOKIE" | "LOCAL_STORAGE" | "NONE">(initialApiConfig.targetType)
    const [apiTargetKey, setApiTargetKey] = useState(initialApiConfig.targetKey)
    const [apiTargetDomain, setApiTargetDomain] = useState(initialApiConfig.targetDomain)

    const [showSharedWarning, setShowSharedWarning] = useState(false)

    const queryClient = useQueryClient()

    const updateStepMutation = useMutation({
        mutationFn: (formData: any) => automationService.updateStep(step.id, formData),
        onSuccess: (updatedStep: AutomationStep) => {
            toast.success(t('update_step_dialog.update_success'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
            onStepUpdated(updatedStep)
        },
        onError: () => toast.error(t('update_step_dialog.update_error')),
    })

    const createStepMutation = useMutation({
        mutationFn: automationService.createStep,
        onSuccess: (newStep: AutomationStep) => {
            toast.success(t('update_step_dialog.create_version_success'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
            onStepUpdated(newStep)
        },
        onError: () => toast.error(t('update_step_dialog.create_version_error')),
    })

    const getFormData = () => {
        let finalData = data;
        const finalLocator = locator;

        if (actionType === ActionType.API_REQUEST) {
            let parsedBody = {};
            try {
                if (apiBody) parsedBody = JSON.parse(apiBody);
            } catch {
                toast.error(t('update_step_dialog.invalid_json_error'));
                return null;
            }

            finalData = JSON.stringify({
                method: apiMethod,
                body: parsedBody,
                outputVar: apiOutputVar,
                responsePath: apiResponsePath,
                targetType: apiTargetType === "NONE" ? undefined : apiTargetType,
                targetKey: apiTargetKey,
                targetDomain: apiTargetDomain
            });
        }

        return {
            name,
            actionType: actionType as ActionType,
            locator: finalLocator || '',
            data: finalData,
            description,
            pageObject: pageObject.trim() || undefined,
            projectId
        };
    }

    const handleInitialSubmit = () => {
        if (!name || !actionType) {
            toast.error(t('update_step_dialog.validation_error'))
            return
        }

        // Check if shared
        const usageCount = step._count?.scenarioSteps || 0;
        if (usageCount > 1) {
            setShowSharedWarning(true);
        } else {
            handleUpdateGlobal();
        }
    }

    const handleUpdateGlobal = () => {
        const formData = getFormData();
        if (!formData) return;
        updateStepMutation.mutate(formData);
    }

    const handleCreateNew = () => {
        const formData = getFormData();
        if (!formData) return;
        // Append (Copy) to name to indicate it's a new version
        createStepMutation.mutate({
            ...formData,
            name: `${name} ${t('update_step_dialog.copy_suffix')}`
        });
    }

    const getActionIcon = (type: string) => {
        switch (type) {
            case ActionType.CLICK: return <MousePointer2 className="h-4 w-4" />
            case ActionType.FILL: return <Keyboard className="h-4 w-4" />
            case ActionType.NAVIGATE: return <Globe className="h-4 w-4" />
            case ActionType.ASSERT_TEXT:
            case ActionType.ASSERT_VISIBLE: return <Eye className="h-4 w-4" />
            case ActionType.WAIT: return <Clock className="h-4 w-4" />
            case ActionType.SELECT: return <List className="h-4 w-4" />
            case ActionType.SET_COOKIE: return <Cookie className="h-4 w-4" />
            case ActionType.SET_LOCAL_STORAGE: return <Database className="h-4 w-4" />
            case ActionType.API_REQUEST: return <Network className="h-4 w-4" />
            default: return <MousePointer2 className="h-4 w-4" />
        }
    }

    const getActionTypeLabel = (type: string) => {
        const key = `create_step_dialog.action_types.${type}`
        const translated = t(key)
        return translated === key ? type : translated
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-background border-primary/10 shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold tracking-tight">
                        {t('update_step_dialog.title', { name: step.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t('update_step_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                {showSharedWarning ? (
                    <div className="py-4 space-y-4">
                        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{t('update_step_dialog.shared_warning_title')}</AlertTitle>
                            <AlertDescription>
                                <Trans
                                    i18nKey="update_step_dialog.shared_warning_description"
                                    count={step._count?.scenarioSteps}
                                    values={{ count: step._count?.scenarioSteps }}
                                    components={{ strong: <strong /> }}
                                />
                            </AlertDescription>
                        </Alert>

                        <div className="grid gap-4">
                            <Button
                                onClick={handleUpdateGlobal}
                                className="w-full"
                                variant="warning"
                                disabled={updateStepMutation.isPending}
                            >
                                {updateStepMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {t('update_step_dialog.update_global_button')}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                {t('update_step_dialog.update_global_help')}
                            </p>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">{t('update_step_dialog.or_label')}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleCreateNew}
                                className="w-full"
                                variant="default"
                                disabled={createStepMutation.isPending}
                            >
                                {createStepMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                {t('update_step_dialog.save_as_new_button')}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                {t('update_step_dialog.save_as_new_help')}
                            </p>
                        </div>

                        <Button variant="ghost" onClick={() => setShowSharedWarning(false)} className="w-full mt-2">
                            {t('update_step_dialog.back_to_edit_button')}
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                {actionType === ActionType.SET_COOKIE ? t('create_step_dialog.cookie_name_label') :
                                    actionType === ActionType.SET_LOCAL_STORAGE ? t('create_step_dialog.storage_key_label') : t('create_step_dialog.step_name_label')}
                            </Label>
                            <Input
                                id="name"
                                placeholder={actionType === ActionType.SET_COOKIE ? t('create_step_dialog.cookie_name_placeholder') :
                                    actionType === ActionType.SET_LOCAL_STORAGE ? t('create_step_dialog.storage_key_placeholder') : t('create_step_dialog.step_name_placeholder')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="page-object">{t('scenario_builder.page_object_label')}</Label>
                            <Input
                                id="page-object"
                                placeholder={t('scenario_builder.page_object_placeholder')}
                                value={pageObject}
                                onChange={(e) => setPageObject(e.target.value)}
                            />
                            <p className="text-[11px] leading-4 text-muted-foreground">{t('scenario_builder.page_object_help')}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>{t('create_step_dialog.action_type_label')}</Label>
                                <Select value={actionType} onValueChange={setActionType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(ActionType).map((type) => (
                                            <SelectItem key={type} value={type}>
                                                <div className="flex items-center gap-2">
                                                    {getActionIcon(type)}
                                                    <span>{getActionTypeLabel(type)}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {actionType !== ActionType.NAVIGATE && actionType !== ActionType.WAIT && actionType !== ActionType.SET_COOKIE && actionType !== ActionType.SET_LOCAL_STORAGE && actionType !== ActionType.API_REQUEST && (
                                <div className="grid gap-2">
                                    <Label htmlFor="locator">{t('create_step_dialog.locator_label')}</Label>
                                    <Input
                                        id="locator"
                                        placeholder={t('create_step_dialog.locator_placeholder')}
                                        value={locator}
                                        onChange={(e) => setLocator(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dynamic fields based on action type */}
                        {actionType === ActionType.SET_COOKIE && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="data">{t('create_step_dialog.cookie_value_label')}</Label>
                                    <Input
                                        id="data"
                                        placeholder={t('create_step_dialog.cookie_value_placeholder')}
                                        value={data}
                                        onChange={(e) => setData(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="locator">{t('create_step_dialog.domain_label')}</Label>
                                    <Input
                                        id="locator"
                                        placeholder={t('create_step_dialog.domain_placeholder')}
                                        value={locator}
                                        onChange={(e) => setLocator(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {actionType === ActionType.SET_LOCAL_STORAGE && (
                            <div className="grid gap-2">
                                <Label htmlFor="data">{t('create_step_dialog.storage_value_label')}</Label>
                                <Input
                                    id="data"
                                    placeholder={t('create_step_dialog.storage_value_placeholder')}
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                        )}

                        {actionType === ActionType.API_REQUEST && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="locator">{t('create_step_dialog.endpoint_url_label')}</Label>
                                    <Input
                                        id="locator"
                                        placeholder={t('create_step_dialog.endpoint_url_placeholder')}
                                        value={locator}
                                        onChange={(e) => setLocator(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>{t('create_step_dialog.method_label')}</Label>
                                        <Select value={apiMethod} onValueChange={setApiMethod}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GET">GET</SelectItem>
                                                <SelectItem value="POST">POST</SelectItem>
                                                <SelectItem value="PUT">PUT</SelectItem>
                                                <SelectItem value="DELETE">DELETE</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="outputVar">{t('create_step_dialog.output_var_label')}</Label>
                                        <Input
                                            id="outputVar"
                                            placeholder={t('create_step_dialog.output_var_placeholder')}
                                            value={apiOutputVar}
                                            onChange={(e) => setApiOutputVar(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="responsePath">{t('create_step_dialog.response_path_label')}</Label>
                                    <Input
                                        id="responsePath"
                                        placeholder={t('create_step_dialog.response_path_placeholder')}
                                        value={apiResponsePath}
                                        onChange={(e) => setApiResponsePath(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2 border p-3 rounded-md bg-muted/20">
                                    <Label className="mb-2 block font-semibold">{t('create_step_dialog.auto_save_label')}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>{t('create_step_dialog.target_storage_label')}</Label>
                                            <Select value={apiTargetType} onValueChange={(v) => setApiTargetType(v as any)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">{t('create_step_dialog.target_storage_none')}</SelectItem>
                                                    <SelectItem value="COOKIE">{t('create_step_dialog.target_storage_cookie')}</SelectItem>
                                                    <SelectItem value="LOCAL_STORAGE">{t('create_step_dialog.target_storage_local_storage')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {apiTargetType !== "NONE" && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="targetKey">{t('create_step_dialog.key_name_label')}</Label>
                                                <Input
                                                    id="targetKey"
                                                    placeholder={t('create_step_dialog.key_name_placeholder')}
                                                    value={apiTargetKey}
                                                    onChange={(e) => setApiTargetKey(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {apiTargetType === 'COOKIE' && (
                                        <div className="grid gap-2 mt-2">
                                            <Label htmlFor="targetDomain">{t('create_step_dialog.domain_label')}</Label>
                                            <Input
                                                id="targetDomain"
                                                placeholder={t('create_step_dialog.domain_placeholder')}
                                                value={apiTargetDomain}
                                                onChange={(e) => setApiTargetDomain(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="body">{t('create_step_dialog.request_body_label')}</Label>
                                    <Textarea
                                        id="body"
                                        placeholder={t('create_step_dialog.request_body_placeholder')}
                                        value={apiBody}
                                        onChange={(e) => setApiBody(e.target.value)}
                                        className="font-mono text-xs h-24"
                                    />
                                </div>
                            </>
                        )}

                        {actionType === ActionType.NAVIGATE && (
                            <div className="grid gap-2">
                                <Label htmlFor="url">{t('create_step_dialog.url_label')}</Label>
                                <Input
                                    id="url"
                                    placeholder={t('create_step_dialog.url_placeholder')}
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                        )}

                        {actionType === ActionType.FILL && (
                            <div className="grid gap-2">
                                <Label htmlFor="data">{t('create_step_dialog.input_data_label')}</Label>
                                <Input
                                    id="data"
                                    placeholder={t('create_step_dialog.input_data_placeholder')}
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                        )}

                        {actionType === ActionType.WAIT && (
                            <div className="grid gap-2">
                                <Label htmlFor="data">{t('create_step_dialog.duration_label')}</Label>
                                <Input
                                    id="data"
                                    placeholder={t('create_step_dialog.duration_placeholder')}
                                    type="number"
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                        )}

                        {actionType === ActionType.SELECT && (
                            <div className="grid gap-2">
                                <Label htmlFor="data">{t('create_step_dialog.option_value_label')}</Label>
                                <Input
                                    id="data"
                                    placeholder={t('create_step_dialog.option_value_placeholder')}
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="description">{t('create_step_dialog.description_label')}</Label>
                            <Textarea
                                id="description"
                                placeholder={t('create_step_dialog.description_placeholder')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="resize-none h-20"
                            />
                        </div>
                    </div>
                )}

                {!showSharedWarning && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>{t('update_step_dialog.cancel_button')}</Button>
                        <Button onClick={handleInitialSubmit}>
                            {t('update_step_dialog.save_changes_button')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
