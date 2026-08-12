"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, PlayCircle, Eye, BarChart3 } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TestRun } from "@/types/testRun"
import { appRoutes } from "@/lib/routes"
import { StatusBadge, ProgressBar } from "./test-runs-cells"

import type { TFunction } from "i18next"



export const getColumns = (t: TFunction): ColumnDef<TestRun>[] => [
    {
        accessorKey: "title",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent pl-0"
                >
                    {t('test_run_list.columns.title')}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const run = row.original
            return (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <BarChart3 className="h-4 w-4" />
                    </div>
                    <Link
                        to={appRoutes.resource(run.key)}
                        className="font-medium hover:text-primary transition-colors"
                    >
                        {run.title}
                    </Link>
                </div>
            )
        },
    },
    {
        accessorKey: "status",
        header: t('test_run_list.columns.status'),
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
        accessorKey: "progress",
        header: t('test_run_list.columns.progress'),
        cell: ({ row }) => {
            const run = row.original
            return (
                <ProgressBar
                    items={run.items}
                    totalItems={run.totalItems}
                    passedCount={run.passedCount}
                    failedCount={run.failedCount}
                    blockedCount={run.blockedCount}
                    untestedCount={run.untestedCount}
                    t={t}
                />
            )
        },
    },
    {
        accessorKey: "milestone",
        header: t('test_run_list.columns.milestone'),
        cell: ({ row }) => {
            const milestone = row.original.milestone
            return milestone ? (
                <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground hover:bg-muted/80">{milestone.name}</Badge>
            ) : (
                <span className="text-muted-foreground text-xs">-</span>
            )
        },
    },
    {
        accessorKey: "creator",
        header: t('test_run_list.columns.created_by'),
        cell: ({ row }) => {
            const creator = row.original.creator
            return creator ? (
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        {creator.firstName[0]}
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {creator.firstName}
                    </span>
                </div>
            ) : (
                "-"
            )
        },
    },
    {
        accessorKey: "createdAt",
        header: t('test_run_list.columns.created_at'),
        cell: ({ row }) => {
            return <span className="text-xs text-muted-foreground font-medium">
                {new Date(row.original.createdAt).toLocaleDateString()}
            </span>
        },
    },
    {
        id: "actions",
        header: t('test_run_list.columns.actions'),
        cell: ({ row }) => {
            const run = row.original
            return (
                <div className="flex justify-end">
                    <Button asChild size="sm" className={run.status === 'OPEN' ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-8" : "bg-secondary hover:bg-secondary/80 text-secondary-foreground h-8"}>
                        <Link to={appRoutes.resource(run.key)}>
                            {run.status === 'OPEN' ? <PlayCircle className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                            {run.status === 'OPEN' ? t('test_run_list.actions.execute') : t('test_run_list.actions.view')}
                        </Link>
                    </Button>
                </div>
            )
        },
    },
]
