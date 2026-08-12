import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, MousePointer2, Keyboard, Eye, Clock, Globe, List, Cookie, Database, Network } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Textarea } from "@/components/ui/textarea"
import { automationService, ActionType, type ActionType as AutomationActionType, type AutomationStep } from "@/services/automation.service"
import { useTranslation } from "react-i18next"

interface CreateStepDialogProps {
    projectId: string
    onStepCreated?: (step?: AutomationStep) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
    className?: string
}

export function CreateStepDialog({ projectId, onStepCreated, open: controlledOpen, onOpenChange: setControlledOpen, trigger, className }: CreateStepDialogProps) {
    const { t } = useTranslation()
    const [internalOpen, setInternalOpen] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? (setControlledOpen || (() => { })) : setInternalOpen

    const [name, setName] = useState("")
    const [actionType, setActionType] = useState<AutomationActionType>(ActionType.CLICK)
    const [locator, setLocator] = useState("")
    const [data, setData] = useState("")
    const [description, setDescription] = useState("")
    const [pageObject, setPageObject] = useState("")
    const [apiMethod, setApiMethod] = useState("POST")
    const [apiBody, setApiBody] = useState("")
    const [apiOutputVar, setApiOutputVar] = useState("")
    const [apiResponsePath, setApiResponsePath] = useState("")
    const [apiTargetType, setApiTargetType] = useState<"COOKIE" | "LOCAL_STORAGE" | "NONE">("NONE")
    const [apiTargetKey, setApiTargetKey] = useState("")
    const [apiTargetDomain, setApiTargetDomain] = useState("")
    const queryClient = useQueryClient()

    const createStepMutation = useMutation({
        mutationFn: automationService.createStep,
        onSuccess: (createdStep) => {
            toast.success(t('create_step_dialog.create_success'))
            setOpen(false)
            resetForm()
            queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
            if (onStepCreated) onStepCreated(createdStep)
        },
        onError: () => toast.error(t('create_step_dialog.create_error')),
    })

    const resetForm = () => {
        setName("")
        setActionType(ActionType.CLICK)
        setLocator("")
        setData("")
        setDescription("")
        setPageObject("")
        setApiMethod("POST")
        setApiBody("")
        setApiOutputVar("")
        setApiResponsePath("")
        setApiTargetType("NONE")
        setApiTargetKey("")
        setApiTargetDomain("")
    }

    const handleSubmit = () => {
        if (!name || !actionType) {
            toast.error(t('create_step_dialog.validation_error'))
            return
        }

        let finalData = data;
        const finalLocator = locator;

        if (actionType === ActionType.API_REQUEST) {
            // Serialize API config into data
            let parsedBody = {};
            try {
                if (apiBody) parsedBody = JSON.parse(apiBody);
            } catch {
                toast.error(t('create_step_dialog.invalid_json_error'));
                return;
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
            // Locator is the URL
        }

        createStepMutation.mutate({
            name,
            actionType,
            locator: finalLocator || '',
            data: finalData,
            description,
            pageObject: pageObject.trim() || undefined,
            projectId
        })
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className={cn("gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors", className)}>
                        <Plus className="h-4 w-4" />
                        {t('create_step_dialog.trigger_button')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-background border-primary/10 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold tracking-tight">
                        {t('create_step_dialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('create_step_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

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
                            <Select value={actionType} onValueChange={(value) => setActionType(value as AutomationActionType)}>
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
                                        <Select value={apiTargetType} onValueChange={(value) => setApiTargetType(value as "COOKIE" | "LOCAL_STORAGE" | "NONE")}>
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

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>{t('create_step_dialog.cancel_button')}</Button>
                    <Button onClick={handleSubmit} disabled={createStepMutation.isPending}>
                        {createStepMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('create_step_dialog.create_button')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
