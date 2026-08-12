import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Trash2, UserPlus, Shield, User } from "lucide-react"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { userService } from "@/services/user.service"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { projectService } from "@/services/project.service"
import type { Project } from "@/types/project"
import { useAuthStore } from "@/store/authStore";

import { useTranslation } from "react-i18next"
import { logger } from "@/utils/logger";

type AddMemberFormValues = {
    userId: string
}

interface ProjectMembersProps {
    project: Project
}

export function ProjectMembers({ project }: ProjectMembersProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const currentUser = useAuthStore((state) => state.user)
    const [isAdding, setIsAdding] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)

    const addMemberSchema = z.object({
        userId: z.string().min(1, t('project_members.select_tester_error')),
    })

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: userService.getAll,
    })

    const availableTesters = users?.filter(u =>
        u.role === 'TESTER' &&
        !project.members?.some(m => m.user.id === u.id)
    ) || []

    const form = useForm<AddMemberFormValues>({
        resolver: zodResolver(addMemberSchema),
    })

    async function onAddMember(data: AddMemberFormValues) {
        setIsAdding(true)
        try {
            await projectService.addMember(project.id, data.userId)
            toast.success(t('project_members.add_success'))
            form.reset({ userId: "" })
            await queryClient.invalidateQueries({ queryKey: ["project", project.id] })
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
        } catch (error) {
            logger.error(error)
            toast.error(t('project_members.add_error'))
        } finally {
            setIsAdding(false)
        }
    }

    async function onRemoveMember(userId: string) {
        setRemovingId(userId)
        try {
            await projectService.removeMember(project.id, userId)
            toast.success(t('project_members.remove_success'))
            await queryClient.invalidateQueries({ queryKey: ["project", project.id] })
            await queryClient.invalidateQueries({ queryKey: ["projects"] })
        } catch (error) {
            logger.error(error)
            toast.error(t('project_members.remove_error'))
        } finally {
            setRemovingId(null)
        }
    }

    // Sort members: Admin/Leader first, then alphabetical
    const sortedMembers = [...(project.members || [])].sort((a, b) => {
        if (a.user.role === 'ADMIN' && b.user.role !== 'ADMIN') return -1;
        if (a.user.role !== 'ADMIN' && b.user.role === 'ADMIN') return 1;
        return a.user.firstName.localeCompare(b.user.firstName);
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('project_members.title')}</CardTitle>
                <CardDescription>
                    {t('project_members.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Add Member Form */}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onAddMember)} className="flex gap-2">
                        <FormField
                            control={form.control}
                            name="userId"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger data-testid="project-member-select-trigger">
                                                <SelectValue placeholder={t('project_members.select_tester_placeholder')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {availableTesters.length > 0 ? (
                                                availableTesters.map((tester) => (
                                                    <SelectItem key={tester.id} value={tester.id}>
                                                        {tester.firstName} {tester.lastName} ({tester.email})
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="p-2 text-sm text-muted-foreground text-center">
                                                    {t('project_members.no_testers_found')}
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button data-testid="project-member-add-btn" type="submit" disabled={isAdding || availableTesters.length === 0}>
                            {isAdding ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                            )}
                            {t('project_members.add_button')}
                        </Button>
                    </form>
                </Form>

                {/* Members List */}
                <div className="space-y-4">
                    {sortedMembers.map((member) => (
                        <div
                            key={member.user.id}
                            className="flex items-center justify-between rounded-lg border p-4"
                        >
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarFallback className={member.user.role === 'ADMIN' ? "bg-primary text-primary-foreground" : ""}>
                                        {member.user.firstName[0]}{member.user.lastName[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">
                                        {member.user.firstName} {member.user.lastName}
                                        {member.user.id === currentUser?.id && t('project_members.you_suffix')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {member.user.email}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                                    {member.user.role === 'ADMIN' ? (
                                        <Shield className="h-3 w-3" />
                                    ) : (
                                        <User className="h-3 w-3" />
                                    )}
                                    {t(`common.roles.${member.user.role}`)}
                                </div>

                                {member.user.role !== 'ADMIN' && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                data-testid={`project-member-remove-trigger-${member.user.id}`}
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">{t('common.delete')}</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="bg-background border-primary/10 shadow-2xl">
                                            <AlertDialogHeader className="flex flex-row items-center gap-4 space-y-0">
                                                <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shadow-sm">
                                                    <Trash2 className="h-5 w-5 text-red-600" />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <AlertDialogTitle className="text-lg font-bold">{t('project_members.remove_member_title')}</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm font-medium text-muted-foreground/80">
                                                        {t('project_members.remove_member_description', { name: `${member.user.firstName} ${member.user.lastName}` })}
                                                    </AlertDialogDescription>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="pt-2">
                                                <AlertDialogCancel className="hover:bg-muted/50">{t('project_members.cancel_button')}</AlertDialogCancel>
                                                <AlertDialogAction
                                                    data-testid="project-member-remove-confirm-btn"
                                                    onClick={() => onRemoveMember(member.user.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all"
                                                >
                                                    {removingId === member.user.id ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        t('project_members.remove_button')
                                                    )}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
