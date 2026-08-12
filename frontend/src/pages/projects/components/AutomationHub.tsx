import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Activity, AlertTriangle, CheckCircle2, ExternalLink, Search, ShieldCheck, Wrench, Zap } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, PageMetric, PageMetricGrid, PageToolbar } from "@/components/layout/PageChrome"
import { testCaseService } from "@/services/testCase.service"
import type { TestCase } from "@/types/testCase"
import { appRoutes } from "@/lib/routes"
import { SortableTableHead } from "@/components/ui/sortable-table-head"

type CoverageState = "AUTOMATED" | "BROKEN" | "OUTDATED" | "CANDIDATE" | "NOT_AUTOMATED"

function getCoverageState(testCase: TestCase): CoverageState {
    const scenario = testCase.automationScenarios?.[0]
    if (!scenario) return testCase.priority === "CRITICAL" || testCase.priority === "HIGH" ? "CANDIDATE" : "NOT_AUTOMATED"
    if (scenario.status === "DEPRECATED") return "OUTDATED"
    if (scenario.status === "DRAFT") return "BROKEN"
    return "AUTOMATED"
}

function getStateVariant(state: CoverageState): "default" | "secondary" | "destructive" | "outline" {
    if (state === "AUTOMATED") return "default"
    if (state === "BROKEN") return "destructive"
    if (state === "OUTDATED") return "secondary"
    return "outline"
}

function getCaseSharePath(testCase: TestCase) {
    return `/c/${testCase.key || testCase.id}`
}

export function AutomationHub({ projectId }: { projectId: string }) {
    const { t } = useTranslation()
    const [search, setSearch] = useState("")
    const [sortBy, setSortBy] = useState("case")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

    const { data, isLoading } = useQuery({
        queryKey: ["automation-coverage", projectId],
        queryFn: () => testCaseService.getAllByProject(projectId, 1, 500, ""),
        enabled: !!projectId,
    })

    const testCases = useMemo(() => data?.data ?? [], [data?.data])

    const rows = useMemo(() => {
        return testCases
            .map((testCase) => ({
                testCase,
                state: getCoverageState(testCase),
                scenario: testCase.automationScenarios?.[0],
            }))
            .filter(({ testCase }) => {
                const query = search.trim().toLowerCase()
                if (!query) return true
                return (
                    testCase.title.toLowerCase().includes(query) ||
                    testCase.suite?.name?.toLowerCase().includes(query)
                )
            })
    }, [search, testCases])

    const sortedRows = useMemo(() => {
        const valueFor = (row: (typeof rows)[number]) => {
            if (sortBy === "case") return row.testCase.title
            if (sortBy === "suite") return row.testCase.suite?.name || ""
            if (sortBy === "priority") return row.testCase.priority || ""
            if (sortBy === "state") return row.state
            return row.scenario?.steps?.length ?? 0
        }

        return [...rows].sort((left, right) => {
            const leftValue = valueFor(left)
            const rightValue = valueFor(right)
            const result = typeof leftValue === "number" && typeof rightValue === "number"
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue))
            return sortOrder === "asc" ? result : -result
        })
    }, [rows, sortBy, sortOrder])

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((current) => current === "asc" ? "desc" : "asc")
            return
        }
        setSortBy(field)
        setSortOrder("asc")
    }

    const automatable = testCases.length
    const automated = testCases.filter((testCase) => getCoverageState(testCase) === "AUTOMATED").length
    const candidate = testCases.filter((testCase) => getCoverageState(testCase) === "CANDIDATE").length
    const broken = testCases.filter((testCase) => {
        const state = getCoverageState(testCase)
        return state === "BROKEN" || state === "OUTDATED"
    }).length
    const coverage = automatable > 0 ? Math.round((automated / automatable) * 100) : 0

    return (
        <div className="page-shell page-stack">
            <PageHeader
                title={t("automation_hub.title")}
                description={t("automation_hub.description")}
                meta={
                    <>
                        <span>{t("automation_hub.coverage")}: <span className="font-semibold text-foreground">{coverage}%</span></span>
                        <span className="text-border">|</span>
                        <span>{automated} / {automatable}</span>
                    </>
                }
            />

            <section className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">{t("automation_hub.health_title")}</h2>
                    </div>
                    <div className="min-w-[220px] flex-1 sm:max-w-md">
                        <Progress value={coverage} className="h-3" />
                    </div>
                </div>
                <PageMetricGrid>
                    <PageMetric label={t("automation_hub.metrics.coverage")} value={`${coverage}%`} icon={ShieldCheck} tone="primary" />
                    <PageMetric label={t("automation_hub.metrics.automated")} value={automated} icon={CheckCircle2} tone="success" />
                    <PageMetric label={t("automation_hub.metrics.candidates")} value={candidate} icon={Zap} tone="warning" />
                    <PageMetric label={t("automation_hub.metrics.needs_work")} value={broken} icon={AlertTriangle} tone={broken > 0 ? "danger" : "neutral"} />
                </PageMetricGrid>
            </section>

            <PageToolbar>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Activity className="h-4 w-4 text-primary" />
                        {t("automation_hub.inventory")}
                    </div>
                    <div className="relative md:ml-auto md:w-80">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t("automation_hub.search_placeholder")}
                            className="h-10 pl-9"
                        />
                    </div>
                </div>
            </PageToolbar>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <SortableTableHead sortKey="case" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("automation_hub.table.case")}</SortableTableHead>
                            <SortableTableHead sortKey="suite" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("automation_hub.table.suite")}</SortableTableHead>
                            <SortableTableHead sortKey="priority" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("automation_hub.table.priority")}</SortableTableHead>
                            <SortableTableHead sortKey="state" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("automation_hub.table.state")}</SortableTableHead>
                            <SortableTableHead sortKey="steps" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort}>{t("automation_hub.table.steps")}</SortableTableHead>
                            <SortableTableHead sortKey="actions" activeSortKey={sortBy} direction={sortOrder} onSort={handleSort} sortable={false} className="text-right">{t("common.actions")}</SortableTableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRows.map(({ testCase, state, scenario }) => (
                            <TableRow key={testCase.id}>
                                <TableCell>
                                    <div className="min-w-0">
                                        <Link to={`${appRoutes.resource(testCase.key)}?tab=automation`} className="font-semibold text-foreground hover:text-primary">
                                            {testCase.title}
                                        </Link>
                                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{testCase.key || getCaseSharePath(testCase)}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{testCase.suite?.name || "-"}</TableCell>
                                <TableCell><Badge variant="outline">{testCase.priority}</Badge></TableCell>
                                <TableCell><Badge variant={getStateVariant(state)}>{t(`automation_hub.states.${state}`)}</Badge></TableCell>
                                <TableCell className="tabular-nums">{scenario?.steps?.length ?? 0}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button asChild size="sm" variant={state === "AUTOMATED" ? "secondary" : "default"} className="h-8">
                                            <Link to={`${appRoutes.resource(testCase.key)}?tab=automation`}>
                                                {state === "AUTOMATED" ? <Wrench className="mr-2 h-3.5 w-3.5" /> : <Zap className="mr-2 h-3.5 w-3.5" />}
                                                {state === "AUTOMATED" ? t("automation_hub.actions.maintain") : t("automation_hub.actions.automate")}
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title={t("automation_hub.actions.open_short_link")}>
                                            <Link to={getCaseSharePath(testCase)}>
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                                    {t("automation_hub.empty")}
                                </TableCell>
                            </TableRow>
                        )}
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                                    {t("common.loading")}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
