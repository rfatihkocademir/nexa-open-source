"use client"

import * as React from "react"
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    onRowClick?: (row: TData) => void
    rowSelection?: Record<string, boolean>
    setRowSelection?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    getRowId?: (row: TData) => string
    caption?: string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    rowSelection,
    setRowSelection,
    getRowId,
    caption,
}: DataTableProps<TData, TValue>) {
    const { t } = useTranslation()
    const [sorting, setSorting] = React.useState<SortingState>([])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        getRowId,
        state: {
            sorting,
            rowSelection: rowSelection || {},
        },
    })

    const shouldIgnoreRowClick = React.useCallback((target: EventTarget | null) => {
        if (!(target instanceof Element)) {
            return false
        }

        return Boolean(
            target.closest(
                'a, button, input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [data-no-row-click="true"]'
            )
        )
    }, [])

    return (
        <div>
            <div className="rounded-md border">
                <Table>
                    <TableCaption className="sr-only">{caption || t('common.table.caption', 'Veri tablosu')}</TableCaption>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const headerContent = header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )
                                    const isSimpleSortableHeader = typeof headerContent === "string" && header.column.getCanSort()

                                    return isSimpleSortableHeader ? (
                                            <SortableTableHead
                                                key={header.id}
                                                sortKey={header.column.id}
                                                activeSortKey={header.column.getIsSorted() ? header.column.id : undefined}
                                                direction={header.column.getIsSorted() || null}
                                                onSort={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}
                                                aria-sort={header.column.getIsSorted()
                                                    ? header.column.getIsSorted() === "asc" ? "ascending" : "descending"
                                                    : "none"}
                                            >
                                                {headerContent}
                                            </SortableTableHead>
                                        ) : (
                                        <TableHead
                                            key={header.id}
                                            aria-sort={header.column.getCanSort()
                                                ? header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'
                                                : undefined}
                                        >
                                            {headerContent}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={(event) => {
                                        if (!onRowClick || shouldIgnoreRowClick(event.target)) {
                                            return
                                        }

                                        const selection = window.getSelection?.()
                                        if (selection && selection.toString().trim().length > 0) {
                                            return
                                        }

                                        onRowClick(row.original)
                                    }}
                                    tabIndex={onRowClick ? 0 : undefined}
                                    onKeyDown={(event) => {
                                        if (!onRowClick || shouldIgnoreRowClick(event.target)) return
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            onRowClick(row.original)
                                        }
                                    }}
                                    aria-label={onRowClick ? t('common.table.open_row', 'Satırı aç') : undefined}
                                    className={`group ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t('common.table.no_results')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end gap-3 py-4">
                <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">
                    {t('common.pagination.page_x_of_y', { current: table.getState().pagination.pageIndex + 1, total: table.getPageCount() })}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    {t('common.pagination.previous')}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    {t('common.pagination.next')}
                </Button>
            </div>
        </div>
    )
}
