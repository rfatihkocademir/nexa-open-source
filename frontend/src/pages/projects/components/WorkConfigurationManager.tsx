import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Braces, Loader2, Plus, Power, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { workConfigurationService, type CustomFieldType } from "@/services/work-configuration.service";

const BASE_TYPES = ["EPIC", "STORY", "TASK", "BUG", "DEFECT", "INCIDENT", "OPERATIONAL", "MEETING", "PRESENTATION", "SUPPORT", "ADMINISTRATIVE"];
const FIELD_TYPES: CustomFieldType[] = ["TEXT", "TEXTAREA", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "USER", "MULTI_USER", "URL"];

export function WorkConfigurationManager({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const queryKey = ["work-configuration", projectId];
    const [typeOpen, setTypeOpen] = useState(false);
    const [fieldOpen, setFieldOpen] = useState(false);
    const [typeForm, setTypeForm] = useState({ name: "", key: "", baseType: "TASK" });
    const [fieldForm, setFieldForm] = useState({ name: "", key: "", fieldType: "TEXT" as CustomFieldType, contexts: "", options: "", required: false });
    const { data, isLoading } = useQuery({ queryKey, queryFn: () => workConfigurationService.list(projectId) });
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    const createType = useMutation({
        mutationFn: () => workConfigurationService.createWorkType(projectId, typeForm),
        onSuccess: async () => { await refresh(); setTypeOpen(false); setTypeForm({ name: "", key: "", baseType: "TASK" }); toast.success(t("work_configuration.type_created")); },
        onError: () => toast.error(t("work_configuration.save_error")),
    });
    const createField = useMutation({
        mutationFn: () => workConfigurationService.createCustomField(projectId, {
            name: fieldForm.name, key: fieldForm.key, fieldType: fieldForm.fieldType, required: fieldForm.required,
            itemTypeKeys: fieldForm.contexts.split(",").map((v) => v.trim()).filter(Boolean),
            options: ["SELECT", "MULTI_SELECT"].includes(fieldForm.fieldType) ? fieldForm.options.split(",").map((v) => v.trim()).filter(Boolean) : undefined,
        }),
        onSuccess: async () => { await refresh(); setFieldOpen(false); setFieldForm({ name: "", key: "", fieldType: "TEXT", contexts: "", options: "", required: false }); toast.success(t("work_configuration.field_created")); },
        onError: () => toast.error(t("work_configuration.save_error")),
    });
    const toggleType = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => workConfigurationService.updateWorkType(projectId, id, { isActive }), onSuccess: refresh });
    const toggleField = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => workConfigurationService.updateCustomField(projectId, id, { isActive }), onSuccess: refresh });
    const deleteField = useMutation({ mutationFn: (id: string) => workConfigurationService.deleteCustomField(projectId, id), onSuccess: refresh });

    return <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />{t("work_configuration.title")}</CardTitle>
            <CardDescription>{t("work_configuration.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-7">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div><h3 className="font-semibold">{t("work_configuration.work_types")}</h3><p className="text-sm text-muted-foreground">{t("work_configuration.work_types_help")}</p></div>
                        <Dialog open={typeOpen} onOpenChange={setTypeOpen}><DialogTrigger asChild><Button data-testid="work-config-add-type-btn" size="sm"><Plus className="mr-2 h-4 w-4" />{t("work_configuration.add_type")}</Button></DialogTrigger>
                            <DialogContent><DialogHeader><DialogTitle>{t("work_configuration.add_type")}</DialogTitle><DialogDescription>{t("work_configuration.type_dialog_help")}</DialogDescription></DialogHeader>
                                <div className="grid gap-4 py-2"><div className="grid gap-2"><Label>{t("work_configuration.name")}</Label><Input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} /></div>
                                    <div className="grid gap-2"><Label>{t("work_configuration.key")}</Label><Input value={typeForm.key} onChange={(e) => setTypeForm({ ...typeForm, key: e.target.value })} placeholder="DATABASE_CHANGE" /></div>
                                    <div className="grid gap-2"><Label>{t("work_configuration.base_type")}</Label><Select value={typeForm.baseType} onValueChange={(baseType) => setTypeForm({ ...typeForm, baseType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BASE_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div></div>
                                <DialogFooter><Button onClick={() => createType.mutate()} disabled={!typeForm.name || !typeForm.key || createType.isPending}>{t("common.save")}</Button></DialogFooter>
                            </DialogContent></Dialog>
                    </div>
                    <div className="divide-y rounded-lg border">{data?.workTypes.length ? data.workTypes.map((type) => <div key={type.id} className="flex items-center justify-between gap-3 p-3"><div><div className="flex items-center gap-2 font-medium">{type.name}<Badge variant="outline">{type.key}</Badge></div><p className="text-xs text-muted-foreground">{t("work_configuration.maps_to", { type: type.baseType })}</p></div><Button size="icon" variant="ghost" title={t("work_configuration.toggle")} onClick={() => toggleType.mutate({ id: type.id, isActive: !type.isActive })}><Power className={`h-4 w-4 ${type.isActive ? "text-emerald-600" : "text-muted-foreground"}`} /></Button></div>) : <p className="p-4 text-sm text-muted-foreground">{t("work_configuration.no_custom_types")}</p>}</div>
                </section>
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div><h3 className="font-semibold">{t("work_configuration.custom_fields")}</h3><p className="text-sm text-muted-foreground">{t("work_configuration.custom_fields_help")}</p></div>
                        <Dialog open={fieldOpen} onOpenChange={setFieldOpen}><DialogTrigger asChild><Button data-testid="work-config-add-field-btn" size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />{t("work_configuration.add_field")}</Button></DialogTrigger>
                            <DialogContent><DialogHeader><DialogTitle>{t("work_configuration.add_field")}</DialogTitle><DialogDescription>{t("work_configuration.field_dialog_help")}</DialogDescription></DialogHeader>
                                <div className="grid gap-4 py-2"><div className="grid gap-2"><Label>{t("work_configuration.name")}</Label><Input value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} /></div><div className="grid gap-2"><Label>{t("work_configuration.key")}</Label><Input value={fieldForm.key} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })} placeholder="CUSTOMER_IMPACT" /></div>
                                    <div className="grid gap-2"><Label>{t("work_configuration.field_type")}</Label><Select value={fieldForm.fieldType} onValueChange={(fieldType: CustomFieldType) => setFieldForm({ ...fieldForm, fieldType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FIELD_TYPES.map((v) => <SelectItem key={v} value={v}>{t(`work_configuration.field_types.${v}`)}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="grid gap-2"><Label>{t("work_configuration.contexts")}</Label><Input value={fieldForm.contexts} onChange={(e) => setFieldForm({ ...fieldForm, contexts: e.target.value })} placeholder="BUG, DATABASE_CHANGE" /><p className="text-xs text-muted-foreground">{t("work_configuration.contexts_help")}</p></div>
                                    {["SELECT", "MULTI_SELECT"].includes(fieldForm.fieldType) && <div className="grid gap-2"><Label>{t("work_configuration.options")}</Label><Input value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} /></div>}
                                    <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t("work_configuration.required")}</Label><Switch checked={fieldForm.required} onCheckedChange={(required) => setFieldForm({ ...fieldForm, required })} /></div></div>
                                <DialogFooter><Button onClick={() => createField.mutate()} disabled={!fieldForm.name || !fieldForm.key || createField.isPending}>{t("common.save")}</Button></DialogFooter>
                            </DialogContent></Dialog>
                    </div>
                    <div className="divide-y rounded-lg border">{data?.customFields.length ? data.customFields.map((field) => <div key={field.id} className="flex items-center justify-between gap-3 p-3"><div><div className="flex items-center gap-2 font-medium"><Braces className="h-4 w-4 text-primary" />{field.name}<Badge variant="secondary">{t(`work_configuration.field_types.${field.fieldType}`)}</Badge>{field.required && <Badge>{t("work_configuration.required")}</Badge>}</div><p className="text-xs text-muted-foreground">{field.itemTypeKeys.length ? field.itemTypeKeys.join(", ") : t("work_configuration.all_types")}</p></div><div className="flex"><Button size="icon" variant="ghost" aria-label={`${field.name} durumunu değiştir`} title={`${field.name} durumunu değiştir`} onClick={() => toggleField.mutate({ id: field.id, isActive: !field.isActive })}><Power className={`h-4 w-4 ${field.isActive ? "text-emerald-600" : "text-muted-foreground"}`} /></Button><Button size="icon" variant="ghost" aria-label={`${field.name} sil`} title={`${field.name} sil`} onClick={() => deleteField.mutate(field.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>) : <p className="p-4 text-sm text-muted-foreground">{t("work_configuration.no_fields")}</p>}</div>
                </section>
            </>}
        </CardContent>
    </Card>;
}
