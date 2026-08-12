import { useQuery } from "@tanstack/react-query"
import { testRunService } from "@/services/testRun.service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportService } from "@/services/export.service"

interface TestRunComparisonProps {
    runId: string
}

import { useTranslation } from "react-i18next"

export function TestRunComparison({ runId }: TestRunComparisonProps) {
    const { t } = useTranslation()
    const { data: report, isLoading } = useQuery({
        queryKey: ["test-run-comparison", runId],
        queryFn: () => testRunService.getComparisonReport(runId),
    })

    if (isLoading) {
        return <Skeleton className="h-60 w-full" />
    }

    if (!report) return <div>{t('test_run_comparison.no_data')}</div>

    const data = [
        { name: t('test_run_comparison.match'), value: report.matched, color: '#22c55e' }, // green-500
        { name: t('test_run_comparison.mismatch'), value: report.conflicts, color: '#ef4444' }, // red-500
        { name: t('test_run_comparison.only_manual'), value: report.manualOnly, color: '#3b82f6' }, // blue-500
        { name: t('test_run_comparison.only_automation'), value: report.automationOnly, color: '#a855f7' }, // purple-500
    ].filter(item => item.value > 0)

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportService.exportComparisonReport(runId)}
                >
                    <Download className="mr-2 h-4 w-4" />
                    {t('test_run_comparison.export_pdf')}
                </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('test_run_comparison.total_items')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{report.totalTests}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('test_run_comparison.matches')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{report.matched}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('test_run_comparison.agreement', { percent: report.totalTests > 0 ? ((report.matched / report.totalTests) * 100).toFixed(1) : 0 })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('test_run_comparison.mismatches')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{report.conflicts}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('test_run_comparison.conflict_rate', { percent: report.totalTests > 0 ? ((report.conflicts / report.totalTests) * 100).toFixed(1) : 0 })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('test_run_comparison.coverage_gap')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {report.manualOnly + report.automationOnly}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('test_run_comparison.coverage_gap_desc')}
                        </p>
                    </CardContent>
                </Card>

                <Card className="col-span-full md:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('test_run_comparison.distribution')}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
