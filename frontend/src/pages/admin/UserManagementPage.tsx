import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Search, UserPlus, Users } from "lucide-react";

import { userService } from "@/services/user.service";
import { type User, type Role } from "@/types/auth";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { UserDetailsDialog } from "./components/UserDetailsDialog";
import { PageHeader, PageToolbar } from "@/components/layout/PageChrome";

import { useTranslation } from "react-i18next";

export default function UserManagementPage() {
    const { t } = useTranslation();

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: users = [], isLoading } = useQuery<User[]>({
        queryKey: ["users"],
        queryFn: userService.getAll,
    });

    const filteredUsers = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return users;

        return users.filter((user) =>
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(needle) ||
            user.email.toLowerCase().includes(needle) ||
            user.role.toLowerCase().includes(needle)
        );
    }, [searchQuery, users]);

    const columns: ColumnDef<User>[] = [
        {
            accessorKey: "firstName",
            header: t("user_management.first_name"),
        },
        {
            accessorKey: "lastName",
            header: t("user_management.last_name"),
        },
        {
            accessorKey: "email",
            header: t("user_management.email"),
        },
        {
            accessorKey: "role",
            header: t("user_management.role"),
            cell: ({ row }) => {
                const role = row.getValue("role") as Role;
                return (
                    <Badge variant={role === "ADMIN" ? "destructive" : role === "TEAM_LEADER" ? "default" : "secondary"}>
                        {t(`common.roles.${role}`)}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "isActive",
            header: t("user_management.status"),
            cell: ({ row }) => {
                const isActive = row.getValue("isActive") as boolean;
                return (
                    <Badge
                        variant={isActive ? "outline" : "secondary"}
                        className={isActive ? "border-emerald-500 text-emerald-600" : "text-muted-foreground"}
                    >
                        {isActive ? t("user_management.active") : t("user_management.inactive")}
                    </Badge>
                );
            },
        },
    ];

    if (isLoading) {
        return (
            <div className="page-shell page-stack">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-[420px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t("user_management.title")}
                description={t("user_management.description")}
                actions={
                    <Button data-testid="user-management-create-btn" onClick={() => setIsCreateDialogOpen(true)} className="rounded-md">
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t("common.create")}
                    </Button>
                }
                meta={
                    <>
                        <span>{t("user_management.stats.users")}: <span className="font-semibold text-foreground">{users.length}</span></span>
                        <span className="text-border">•</span>
                        <span>{t("user_management.stats.active")}: <span className="font-semibold text-foreground">{users.filter((user) => user.isActive).length}</span></span>
                    </>
                }
            />

            <PageToolbar>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-full max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            data-testid="user-management-search-input"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("common.search")}
                            className="h-9 rounded-lg border-border/70 pl-9"
                        />
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
                        {filteredUsers.length} / {users.length}
                    </div>
                </div>
            </PageToolbar>

            {filteredUsers.length === 0 ? (
                <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
                    <EmptyState
                        icon={Users}
                        title={t("user_management.no_users_found")}
                        description={searchQuery ? t("common.table.no_results") : t("user_management.no_users_desc")}
                        action={searchQuery ? undefined : {
                            label: t("common.create"),
                            onClick: () => setIsCreateDialogOpen(true),
                        }}
                        className="py-20"
                    />
                </section>
            ) : (
                <section className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                    <DataTable
                        columns={columns}
                        data={filteredUsers}
                        onRowClick={(row) => {
                            setSelectedUser(row);
                            setIsDetailsDialogOpen(true);
                        }}
                    />
                </section>
            )}

            <CreateUserDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            />

            <UserDetailsDialog
                user={selectedUser}
                open={isDetailsDialogOpen}
                onOpenChange={setIsDetailsDialogOpen}
            />
        </div>
    );
}
