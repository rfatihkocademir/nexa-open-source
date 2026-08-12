import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "react-i18next"
import type { User } from "@/types/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { userService } from "@/services/user.service"
import { projectService } from "@/services/project.service"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle, Ban, Briefcase, Plus, Loader2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

interface ProjectMember {
    projectId: string;
    project: {
        id: string;
        name: string;
    }
}

interface UserDetails extends User {
    members?: ProjectMember[];
}

interface UserDetailsDialogProps {
    user: User | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function UserDetailsDialog({ user: initialUser, open, onOpenChange }: UserDetailsDialogProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [openSelect, setOpenSelect] = useState(false)

    // Fetch full user details including project memberships
    const { data: fullUserData, isLoading } = useQuery<UserDetails>({
        queryKey: ["user", initialUser?.id],
        queryFn: async () => {
            if (!initialUser?.id) throw new Error("User ID is required");
            return userService.getById(initialUser.id);
        },
        enabled: !!initialUser && open,
    })

    const user = fullUserData || (initialUser as UserDetails | null)

    const { data: allProjectsData } = useQuery({
        queryKey: ["projects-list"],
        queryFn: () => projectService.getAll(1, 100),
        enabled: open,
    })

    const addMemberMutation = useMutation({
        mutationFn: (projectId: string) => {
            if (!user?.id) throw new Error("User required");
            return projectService.addMember(projectId, user.id);
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ["user", user.id] })
            }
            toast.success(t('user_management.project_added'))
            setOpenSelect(false)
        },
        onError: () => {
            toast.error(t('user_management.project_add_failed'))
        }
    })

    const toggleStatusMutation = useMutation({
        mutationFn: () => {
            if (!user?.id) throw new Error("User required");
            return userService.update(user.id, { isActive: !user.isActive });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] })
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ["user", user.id] })
            }
            toast.success(t('user_management.status_updated'))
            onOpenChange(false)
        },
        onError: () => {
            toast.error(t('common.error_occurred'))
        }
    })

    if (!user) return null

    const availableProjects = allProjectsData?.data.filter(p =>
        !user.members?.some((m) => m.projectId === p.id)
    ) || []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('user_management.user_details')}</DialogTitle>
                    <DialogDescription>
                        {t('user_management.user_details_desc')}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="grid gap-6 py-4">
                        {/* User Info Header */}
                        <div className="flex items-start justify-between border-b pb-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-xl font-bold font-heading">{user.firstName} {user.lastName}</h3>
                                <p className="text-muted-foreground">{user.email}</p>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant={user.role === "ADMIN" ? "destructive" : "default"}>
                                        {t(`common.roles.${user.role}`)}
                                    </Badge>
                                    <Badge variant={user.isActive ? "outline" : "secondary"} className={user.isActive ? "text-green-600 border-green-600" : "text-gray-500"}>
                                        {user.isActive ? t('user_management.active') : t('user_management.inactive')}
                                    </Badge>
                                </div>
                            </div>

                            <Button
                                variant={user.isActive ? "destructive" : "default"}
                                onClick={() => toggleStatusMutation.mutate()}
                                disabled={toggleStatusMutation.isPending || user.role === 'ADMIN'}
                                className="gap-2"
                            >
                                {user.isActive ? (
                                    <>
                                        <Ban className="h-4 w-4" />
                                        {t('user_management.deactivate_user')}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        {t('user_management.activate_user')}
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="flex items-center gap-2 font-semibold">
                                    <Briefcase className="h-4 w-4 text-primary" />
                                    {t('user_management.member_projects')}
                                </h4>
                                {user.isActive && (
                                    <div className="flex items-center gap-2">
                                        <Select
                                            open={openSelect}
                                            onOpenChange={setOpenSelect}
                                            onValueChange={(value) => addMemberMutation.mutate(value)}
                                            disabled={addMemberMutation.isPending}
                                        >
                                            <SelectTrigger className="w-[180px] h-8">
                                                <div className="flex items-center gap-2">
                                                    <Plus className="h-4 w-4" />
                                                    <SelectValue placeholder={t('user_management.add_to_project')} />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableProjects.length > 0 ? (
                                                    availableProjects.map((project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            {project.name}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                                        {t('user_management.no_available_projects')}
                                                    </div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {addMemberMutation.isPending && (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {user.members && user.members.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {user.members.map((member) => (
                                        <div key={member.project.id} className="flex items-center p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 text-primary font-bold">
                                                {member.project.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{member.project.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                    {t('user_management.no_projects')}
                                </div>
                            )}
                        </div>

                        {/* Admin Warning for Deactivation */}
                        {user.isActive && (
                            <div className="rounded-lg border border-warning/50 bg-warning/5 p-4 flex items-start gap-4">
                                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <h5 className="font-bold text-warning mb-1">{t('common.warning')}</h5>
                                    <p className="text-muted-foreground">
                                        {t('user_management.deactivation_warning')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}


