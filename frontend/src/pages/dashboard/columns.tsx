"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Settings, Eye } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/types/project"
import { appRoutes } from "@/lib/routes"
import i18n from "@/lib/i18n"

export const columns: ColumnDef<Project>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    {i18n.t("dashboard_columns.project_name")}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const project = row.original
            return (
                <Link
                    to={appRoutes.project(project.key)}
                    className="font-medium hover:underline text-primary"
                >
                    {project.name}
                </Link>
            )
        },
    },
    {
        accessorKey: "description",
        header: i18n.t("common.description"),
        cell: ({ row }) => {
            return <div className="max-w-[300px] truncate text-muted-foreground">{row.getValue("description") || "-"}</div>
        },
    },
    {
        accessorKey: "stats",
        header: i18n.t("dashboard_columns.stats"),
        cell: ({ row }) => {
            const project = row.original
            return (
                <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                        {i18n.t("dashboard_columns.suites_count", { count: project._count?.suites || 0 })}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                        {i18n.t("dashboard_columns.runs_count", { count: project._count?.testRuns || 0 })}
                    </Badge>
                </div>
            )
        },
    },
    {
        accessorKey: "members",
        header: i18n.t("dashboard_columns.team"),
        cell: ({ row }) => {
            const project = row.original
            const testers = project.members?.filter(m => m.user.role === 'TESTER') || []

            if (testers.length === 0) return <span className="text-xs text-muted-foreground">-</span>

            return (
                <div className="flex -space-x-2 overflow-hidden">
                    {testers.slice(0, 4).map((member) => (
                        <TooltipProvider key={member.user.id}>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Avatar className="inline-block h-6 w-6 ring-2 ring-background">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                            {member.user.firstName[0]}{member.user.lastName[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{member.user.firstName} {member.user.lastName}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                    {testers.length > 4 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-medium">
                            +{testers.length - 4}
                        </div>
                    )}
                </div>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const project = row.original
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">{i18n.t("projects.open_menu")}</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{i18n.t("common.actions")}</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link to={appRoutes.project(project.key)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {i18n.t("projects.view_project")}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link to={appRoutes.projectSection(project.key, 'settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                {i18n.t("common.settings")}
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
