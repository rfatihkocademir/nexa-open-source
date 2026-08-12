import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { workConfigurationService } from "@/services/work-configuration.service";

type Props = {
    projectId: string;
    baseType: string;
    workTypeId: string;
    values: Record<string, unknown>;
    onWorkTypeChange: (value: string) => void;
    onValuesChange: (value: Record<string, unknown>) => void;
    onValidityChange?: (valid: boolean) => void;
};

export function DynamicWorkFields({ projectId, baseType, workTypeId, values, onWorkTypeChange, onValuesChange, onValidityChange }: Props) {
    const { t } = useTranslation();
    const { data } = useQuery({
        queryKey: ["work-configuration", projectId],
        queryFn: () => workConfigurationService.list(projectId),
        enabled: Boolean(projectId),
        staleTime: 60_000,
    });
    const workTypes = useMemo(() => data?.workTypes.filter((type) => type.isActive && type.baseType === baseType) ?? [], [baseType, data]);
    const selectedKey = workTypes.find((type) => type.id === workTypeId)?.key;
    const fields = useMemo(() => data?.customFields.filter((field) =>
        field.isActive && (!field.itemTypeKeys.length || field.itemTypeKeys.includes(baseType) || Boolean(selectedKey && field.itemTypeKeys.includes(selectedKey)))
    ) ?? [], [baseType, data, selectedKey]);
    const valid = fields.every((field) => !field.required || (values[field.key] !== undefined && values[field.key] !== null && values[field.key] !== ""));
    useEffect(() => onValidityChange?.(valid), [onValidityChange, valid]);
    useEffect(() => {
        if (workTypeId && data && !workTypes.some((type) => type.id === workTypeId)) onWorkTypeChange("");
    }, [data, onWorkTypeChange, workTypeId, workTypes]);
    if (!workTypes.length && !fields.length) return null;

    const setValue = (key: string, value: unknown) => onValuesChange({ ...values, [key]: value });
    return <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">{t("work_configuration.context_fields")}</p>
        {workTypes.length > 0 && <div className="space-y-1.5"><Label>{t("work_configuration.work_type")}</Label>
            <Select value={workTypeId || "__BASE__"} onValueChange={(value) => onWorkTypeChange(value === "__BASE__" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__BASE__">{t("work_configuration.standard_type", { type: baseType })}</SelectItem>{workTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
            </Select></div>}
        {fields.map((field) => <div className="space-y-1.5" key={field.id}>
            <Label htmlFor={`custom-${field.id}`}>{field.name}{field.required ? " *" : ""}</Label>
            {field.fieldType === "TEXTAREA" ? <Textarea id={`custom-${field.id}`} value={String(values[field.key] ?? "")} onChange={(e) => setValue(field.key, e.target.value)} /> :
                field.fieldType === "BOOLEAN" ? <Switch id={`custom-${field.id}`} checked={Boolean(values[field.key])} onCheckedChange={(value) => setValue(field.key, value)} /> :
                ["SELECT", "MULTI_SELECT"].includes(field.fieldType) ? <Select value={String(values[field.key] ?? "")} onValueChange={(value) => setValue(field.key, field.fieldType === "MULTI_SELECT" ? [value] : value)}><SelectTrigger id={`custom-${field.id}`}><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{field.options?.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> :
                <Input id={`custom-${field.id}`} type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : field.fieldType === "DATETIME" ? "datetime-local" : field.fieldType === "URL" ? "url" : "text"} value={String(values[field.key] ?? "")} onChange={(e) => setValue(field.key, field.fieldType === "NUMBER" ? Number(e.target.value) : e.target.value)} />}
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        </div>)}
    </div>;
}
