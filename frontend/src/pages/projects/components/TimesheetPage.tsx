import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { worklogService } from '@/services/worklog.service';
import { format, addDays, startOfWeek, subWeeks, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/useDateLocale';
import { formatWorklogDuration } from '@/lib/worklogDuration';

interface TimesheetPageProps {
    projectId?: string;
}

export default function TimesheetPage({ projectId }: TimesheetPageProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const dateLocale = useDateLocale();

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endOfCurrentWeek = addDays(startOfCurrentWeek, 6);
    const startDateStr = format(startOfCurrentWeek, 'yyyy-MM-dd');
    const endDateStr = format(endOfCurrentWeek, 'yyyy-MM-dd');

    const { data: timesheetData, isLoading } = useQuery({
        queryKey: ['timesheet', projectId, startDateStr, endDateStr],
        queryFn: () => worklogService.getTimesheetData(projectId!, startDateStr, endDateStr),
        enabled: !!projectId,
    });

    const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const currentWeek = () => setCurrentDate(new Date());

    const days = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

    const formatMinutes = (mins: number) => formatWorklogDuration(mins);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Zaman Çizelgesi</h2>
                    <p className="text-muted-foreground">Kullanıcıların ve görevlerin haftalık efor dağılımı.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" aria-label="Önceki hafta" title="Önceki hafta" onClick={prevWeek}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={currentWeek} className="w-[200px] gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {format(startOfCurrentWeek, 'd MMM', { locale: dateLocale })} - {format(endOfCurrentWeek, 'd MMM yyyy', { locale: dateLocale })}
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Sonraki hafta" title="Sonraki hafta" onClick={nextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                        <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-medium border-b border-r w-[300px]">Kullanıcı / Görev</th>
                                {days.map(day => (
                                    <th key={day.toISOString()} className="px-4 py-3 font-medium border-b text-center w-[100px]">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs uppercase">{format(day, 'EEE', { locale: dateLocale })}</span>
                                            <span className="text-foreground">{format(day, 'd')}</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 font-bold border-b border-l text-center bg-muted/80">Toplam</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!timesheetData || timesheetData.length === 0) ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                        Bu hafta için kayıtlı efor bulunmuyor.
                                    </td>
                                </tr>
                            ) : (
                                timesheetData.map((userRow: any) => (
                                    <React.Fragment key={userRow.user.id}>
                                        {/* User Row */}
                                        <tr className="bg-muted/20 hover:bg-muted/30 transition-colors border-b border-t">
                                            <td className="px-4 py-3 border-r font-medium flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{userRow.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {userRow.user.name}
                                            </td>
                                            {/* We could sum up daily totals per user here if we wanted, but let's keep it simple for now or leave blank */}
                                            {days.map(day => {
                                                const dStr = format(day, 'yyyy-MM-dd');
                                                const dayTotal = userRow.items.reduce((sum: number, item: any) => sum + (item.dailyLogs[dStr] || 0), 0);
                                                return (
                                                    <td key={dStr} className="px-4 py-3 text-center text-muted-foreground/70 border-b">
                                                        {formatMinutes(dayTotal)}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 border-l text-center font-bold bg-muted/40">
                                                {formatMinutes(userRow.totalMinutes)}
                                            </td>
                                        </tr>
                                        {/* Work Item Rows */}
                                        {userRow.items.map((item: any) => (
                                            <tr key={item.workItem.id} className="hover:bg-muted/10 transition-colors border-b last:border-b-0">
                                                <td className="px-4 py-3 border-r pl-12 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        {item.workItem.key ? (
                                                            <Badge variant="outline" className="text-[10px] font-mono">{item.workItem.key}</Badge>
                                                        ) : null}
                                                        <span className="truncate max-w-[200px]" title={item.workItem.title}>
                                                            {item.workItem.title}
                                                        </span>
                                                    </div>
                                                </td>
                                                {days.map(day => {
                                                    const dStr = format(day, 'yyyy-MM-dd');
                                                    const val = item.dailyLogs[dStr];
                                                    return (
                                                        <td key={dStr} className={cn("px-4 py-3 text-center border-b border-r border-r-border/30", val > 0 ? "text-primary font-medium bg-primary/5" : "text-muted-foreground/40")}>
                                                            {formatMinutes(val)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-3 border-l text-center font-semibold text-foreground/80">
                                                    {formatMinutes(item.totalMinutes)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                        {(timesheetData && timesheetData.length > 0) && (
                            <tfoot className="bg-muted/80 font-bold sticky bottom-0">
                                <tr>
                                    <td className="px-4 py-3 border-r text-right">Genel Toplam</td>
                                    {days.map(day => {
                                        const dStr = format(day, 'yyyy-MM-dd');
                                        const dayGrandTotal = timesheetData.reduce((sum: number, user: any) => 
                                            sum + user.items.reduce((itemSum: number, item: any) => itemSum + (item.dailyLogs[dStr] || 0), 0)
                                        , 0);
                                        return (
                                            <td key={dStr} className="px-4 py-3 text-center border-b">
                                                {formatMinutes(dayGrandTotal)}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 border-l text-center text-primary">
                                        {formatMinutes(timesheetData.reduce((sum: number, user: any) => sum + user.totalMinutes, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                        
                    </table>
                </div>
            </div>
        </div>
    );
}
