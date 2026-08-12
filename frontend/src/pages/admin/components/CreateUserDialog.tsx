import { useMemo, useState } from "react"
import { z } from "zod"
import { UserPlus, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { FormDialog } from "@/components/ui/form-dialog"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { userService } from "@/services/user.service"
import type { User } from "@/types/auth"

interface CreateUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userToEdit?: User
}

export function CreateUserDialog({ open, onOpenChange, userToEdit }: CreateUserDialogProps) {
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const [showPassword, setShowPassword] = useState(false)

    const createUserSchema = z.object({
        email: z.string().email(t('create_user_dialog.validation.email_invalid')),
        password: userToEdit
            ? z.union([z.string().min(6, t('create_user_dialog.validation.password_min')), z.literal("")]).optional()
            : z.string().min(6, t('create_user_dialog.validation.password_min')),
        firstName: z.string().min(1, t('create_user_dialog.validation.first_name_required')),
        lastName: z.string().min(1, t('create_user_dialog.validation.last_name_required')),
        role: z.enum(["TESTER", "TEAM_LEADER", "PRODUCT_OWNER", "SCRUM_MASTER", "DEVELOPER", "ANALYST", "ADMIN"]),
        isActive: z.boolean(),
    })

    type CreateUserFormValues = z.infer<typeof createUserSchema>

    const defaultValues: CreateUserFormValues = useMemo(() => ({
        email: userToEdit?.email || "",
        password: "",
        firstName: userToEdit?.firstName || "",
        lastName: userToEdit?.lastName || "",
        role: userToEdit?.role || "TESTER",
        isActive: userToEdit?.isActive ?? true,
    }), [userToEdit])

    async function onSubmit(data: CreateUserFormValues) {
        try {
            if (userToEdit) {
                // If password is empty string, don't send it? or backend handles it?
                // Usually for update we only send if changed.
                // But data.password is here. 
                // Let's assume service handles cleanup or we do it here.
                const payload = { ...data }
                if (payload.password === "") delete payload.password

                await userService.update(userToEdit.id, payload)
                toast.success(t('create_user_dialog.success_update'))
            } else {
                await userService.create(data)
                toast.success(t('create_user_dialog.success_create'))
            }
            queryClient.invalidateQueries({ queryKey: ["users"] })
        } catch (error) {
            console.error(error)
            toast.error(userToEdit ? t('create_user_dialog.error_update') : t('create_user_dialog.error_create'))
            throw error
        }
    }

    return (
        <FormDialog<CreateUserFormValues>
            open={open}
            onOpenChange={onOpenChange}
            title={userToEdit ? t('create_user_dialog.title_edit') : t('create_user_dialog.title_add')}
            description={userToEdit ? t('create_user_dialog.description_edit') : t('create_user_dialog.description_add')}
            icon={UserPlus}
            schema={createUserSchema}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitText={userToEdit ? t('create_user_dialog.submit_save') : t('create_user_dialog.submit_create')}
            renderFields={(form) => (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground/80">{t('create_user_dialog.first_name_label')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('create_user_dialog.first_name_placeholder')} {...field} className="border-primary/10 focus:border-primary/30 transition-all" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground/80">{t('create_user_dialog.last_name_label')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('create_user_dialog.last_name_placeholder')} {...field} className="border-primary/10 focus:border-primary/30 transition-all" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_user_dialog.email_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('create_user_dialog.email_placeholder')} type="email" {...field} className="border-primary/10 focus:border-primary/30 transition-all" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground/80">{t('create_user_dialog.password_label')}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                {...field}
                                                className="border-primary/10 focus:border-primary/30 transition-all pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="sr-only">
                                                    {showPassword ? t('create_user_dialog.hide_password_sr') : t('create_user_dialog.show_password_sr')}
                                                </span>
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                    />
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground/80">{t('create_user_dialog.role_label')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                    <FormControl>
                                        <SelectTrigger className="border-primary/10 focus:border-primary/30 transition-all">
                                            <SelectValue placeholder={t('create_user_dialog.role_placeholder')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="TESTER">{t('create_user_dialog.role_tester')}</SelectItem>
                                        <SelectItem value="TEAM_LEADER">{t('create_user_dialog.role_team_leader')}</SelectItem>
                                        <SelectItem value="PRODUCT_OWNER">{t('create_user_dialog.role_product_owner')}</SelectItem>
                                        <SelectItem value="SCRUM_MASTER">{t('create_user_dialog.role_scrum_master')}</SelectItem>
                                        <SelectItem value="DEVELOPER">{t('create_user_dialog.role_developer')}</SelectItem>
                                        <SelectItem value="ANALYST">{t('create_user_dialog.role_analyst')}</SelectItem>
                                        <SelectItem value="ADMIN">{t('create_user_dialog.role_admin')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {userToEdit && (
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-primary/10 bg-muted/20 p-4 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base font-medium">{t('create_user_dialog.active_account')}</FormLabel>
                                        <FormDescription className="text-xs">
                                            {t('create_user_dialog.active_desc')}
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                </>
            )}
        />
    )
}
