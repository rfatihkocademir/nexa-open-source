import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/services/api';
import type { TraceabilityResponse } from '@/types/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Circle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';

const TraceabilityPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<TraceabilityResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedEpic, setSelectedEpic] = useState<string>('all');
    const aiFocus = searchParams.get('aiFocus');

    // We would fetch epics/sprints for filters here ideally

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/projects/${projectId}/analytics/traceability`, {
                params: { epicId: selectedEpic }
            });
            setData(response.data);
        } catch (error) {
            logger.error('Failed to fetch traceability matrix', error);
        } finally {
            setLoading(false);
        }
    }, [projectId, selectedEpic]);

    useEffect(() => {
        if (projectId) fetchData();
    }, [fetchData, projectId]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PASS': return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> {t('traceability.status.PASS')}</Badge>;
            case 'FAIL': return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" /> {t('traceability.status.FAIL')}</Badge>;
            default: return <Badge variant="outline" className="text-gray-500"><Circle className="w-3 h-3 mr-1" /> {t('traceability.status.UNTESTED')}</Badge>;
        }
    };

    if (loading) return <div className="p-8 text-center">{t('traceability.loading')}</div>;
    if (!data) return <div className="p-8 text-center">{t('traceability.no_data')}</div>;

    const filteredMatrix = data.matrix
        .map((epic) => ({
            ...epic,
            stories: epic.stories.filter((story) => {
                if (aiFocus === 'traceability-gaps') {
                    return story.testCases.length === 0;
                }
                if (aiFocus === 'coverage-gaps') {
                    return story.testCases.length === 0 || story.testCases.some((testCase) => testCase.status !== 'APPROVED');
                }
                return true;
            }),
        }))
        .filter((epic) => epic.stories.length > 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">{t('traceability.title')}</h1>
                    {aiFocus && (
                        <p className="text-xs text-muted-foreground">
                            {t('traceability.ai_focus')} {t(`traceability.focus_values.${aiFocus}`)}
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Select value={selectedEpic} onValueChange={setSelectedEpic}>
                        <SelectTrigger data-testid="traceability-epic-select" className="w-[200px]"><SelectValue placeholder={t('traceability.all_epics')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('traceability.all_epics')}</SelectItem>
                            {data.matrix.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('traceability.cards.coverage')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{data.stats.coverageRate}%</div>
                        <p className="text-xs text-muted-foreground">{t('traceability.cards.coverage_desc')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('traceability.cards.total_stories')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.totalStories}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('traceability.cards.covered_stories')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.coveredStories}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[400px]">{t('traceability.table.requirement')}</TableHead>
                            <TableHead>{t('traceability.table.test_cases')}</TableHead>
                            <TableHead className="w-[150px]">{t('traceability.table.last_execution')}</TableHead>
                            <TableHead className="w-[250px]">{t('traceability.table.defects')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMatrix.map(epic => (
                            <React.Fragment key={epic.id}>
                                <TableRow className="bg-muted/50">
                                    <TableCell colSpan={4} className="font-semibold px-4 py-2">
                                        📘 {t('traceability.table.epic')}: {epic.title}
                                    </TableCell>
                                </TableRow>
                                {epic.stories.map(story => (
                                    <React.Fragment key={story.id}>
                                        <TableRow className="border-t">
                                            <TableCell className="align-top">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{story.status}</Badge>
                                                    <span className="font-medium">{story.title}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-0" colSpan={3}>
                                                <Table>
                                                    <TableBody>
                                                        {story.testCases.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell className="text-muted-foreground italic">{t('traceability.table.no_linked_tests')}</TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            story.testCases.map(tc => (
                                                                <TableRow key={tc.id} className="border-0">
                                                                    <TableCell className="w-[30%] align-top border-none pl-4">
                                                                        📄 {tc.title}
                                                                        <div className="text-xs text-muted-foreground ml-4">{tc.status}</div>
                                                                    </TableCell>
                                                                    <TableCell className="w-[20%] align-top border-none">
                                                                        {tc.lastExecution ? (
                                                                            <div className="flex flex-col gap-1">
                                                                                {getStatusBadge(tc.lastExecution.status)}
                                                                                <span className="text-xs text-muted-foreground flex items-center">
                                                                                    <Clock className="w-3 h-3 mr-1" />
                                                                                    {new Date(tc.lastExecution.executedAt).toLocaleDateString(i18n.language)}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            getStatusBadge('UNTESTED')
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="w-[30%] align-top border-none">
                                                                        {tc.bugs && tc.bugs.length > 0 ? (
                                                                            <div className="space-y-1">
                                                                                {tc.bugs.map(bug => (
                                                                                    <div key={bug.id} className="text-xs flex items-center gap-1 text-red-600">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        {bug.title}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default TraceabilityPage;
