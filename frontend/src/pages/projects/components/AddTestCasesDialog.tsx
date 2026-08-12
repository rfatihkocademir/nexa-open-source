import { useState } from "react"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"
import { Loader2, Plus, Search, FilePlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { testCaseService } from "@/services/testCase.service"
import { testRunService } from "@/services/testRun.service"
import { projectService } from "@/services/project.service"
import { useTranslation } from "react-i18next"

interface AddTestCasesDialogProps {
    testRunId: string
    projectId?: string | null
    trigger?: React.ReactNode
}

export function AddTestCasesDialog({ testRunId, projectId, trigger }: AddTestCasesDialogProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId || undefined)
    const [selectedCases, setSelectedCases] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedSearch = useDebounce(searchQuery, 500)
    const queryClient = useQueryClient()

    // Fetch projects if global run
    const { data: projectsData } = useQuery({
        queryKey: ["projects"],
        queryFn: () => projectService.getAll(1, 100), // Fetch first 100 projects
        enabled: !projectId,
    })

    const projects = projectsData?.data || [];

    // Fetch cases with infinite scroll
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingCases
    } = useInfiniteQuery({
        queryKey: ["test-cases", "search", selectedProjectId, debouncedSearch],
        queryFn: async ({ pageParam }) => {
            const res = await testCaseService.getAllByProject(selectedProjectId, pageParam as number, 20, debouncedSearch);
            return res;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.totalPages) return lastPage.meta.page + 1;
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!selectedProjectId || !projectId
    })

    const testCases = data?.pages.flatMap(page => page.data) || [];

    const addItemsMutation = useMutation({
        mutationFn: (caseIds: string[]) => testRunService.addItems(testRunId, caseIds),
        onSuccess: async () => {
            toast.success(t('add_test_cases_dialog.add_success'))
            setOpen(false)
            setSelectedCases([])
            await queryClient.invalidateQueries({ queryKey: ["test-run", testRunId] })
        },
        onError: () => toast.error(t('add_test_cases_dialog.add_error')),
    })

    const handleToggleCase = (caseId: string) => {
        const testCase = testCases.find((candidate) => candidate.id === caseId)
        if (testCase?.status !== 'APPROVED') return
        setSelectedCases(prev =>
            prev.includes(caseId)
                ? prev.filter(id => id !== caseId)
                : [...prev, caseId]
        )
    }

    const handleSelectAll = () => {
        // Select all currently loaded cases
        if (testCases.length === 0) return;

        const allLoadedIds = testCases.filter(tc => tc.status === 'APPROVED').map(tc => tc.id);
        if (allLoadedIds.length === 0) return;
        const allSelected = allLoadedIds.every(id => selectedCases.includes(id));

        if (allSelected) {
            // Deselect all loaded
            setSelectedCases(prev => prev.filter(id => !allLoadedIds.includes(id)));
        } else {
            // Select all loaded (merge unique)
            const newSelected = new Set([...selectedCases, ...allLoadedIds]);
            setSelectedCases(Array.from(newSelected));
        }
    }

    const approvedCases = testCases.filter((testCase) => testCase.status === 'APPROVED');
    const isAllLoadedSelected = approvedCases.length > 0 && approvedCases.every((testCase) => selectedCases.includes(testCase.id));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('add_test_cases_dialog.trigger_button')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col bg-background border-primary/10 shadow-2xl">
                <DialogHeader className="flex flex-row items-center gap-4 pb-2 border-b border-border/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <FilePlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {t('add_test_cases_dialog.title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground/80">
                            {t('add_test_cases_dialog.description')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                    {/* Project Selection for Global Runs */}
                    {!projectId && (
                        <Select
                            value={selectedProjectId}
                            onValueChange={setSelectedProjectId}
                        >
                            <SelectTrigger className="bg-muted/30 border-primary/10 focus:border-primary/30 transition-all">
                                <SelectValue placeholder={t('add_test_cases_dialog.select_project_placeholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('add_test_cases_dialog.all_projects')}</SelectItem>
                                {projects?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-primary/10">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('add_test_cases_dialog.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 border-none bg-transparent focus-visible:ring-0 h-8"
                        />
                    </div>

                    <div className="flex items-center space-x-2 pb-2 border-b border-border/40 px-1">
                        <Checkbox
                            checked={isAllLoadedSelected}
                            onCheckedChange={handleSelectAll}
                        />
                        <span className="text-sm font-medium text-muted-foreground">{t('add_test_cases_dialog.select_all_loaded')}</span>
                        <span className="ml-auto text-sm font-medium text-primary">
                            {t('add_test_cases_dialog.selected_count', { count: selectedCases.length })}
                        </span>
                    </div>

                    <ScrollArea className="flex-1 pr-4">
                        {isLoadingCases ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {testCases.map(tc => {
                                    const isApproved = tc.status === 'APPROVED';
                                    return (
                                    <div key={tc.id} className={`flex items-start space-x-3 rounded-xl border border-transparent p-3 transition-all ${isApproved ? 'cursor-pointer hover:border-primary/10 hover:bg-primary/5' : 'cursor-not-allowed opacity-60'}`} onClick={() => handleToggleCase(tc.id)}>
                                        <Checkbox
                                            checked={selectedCases.includes(tc.id)}
                                            onCheckedChange={() => handleToggleCase(tc.id)}
                                            disabled={!isApproved}
                                            className="mt-1"
                                        />
                                        <div className="grid gap-1.5 leading-none flex-1">
                                            <label className="text-sm font-semibold leading-none cursor-pointer">
                                                {tc.title}
                                            </label>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{tc.suite?.name}</span>
                                                <span>•</span>
                                                <span className={
                                                    tc.priority === 'HIGH' ? 'text-red-500 font-medium' :
                                                        tc.priority === 'MEDIUM' ? 'text-yellow-500 font-medium' :
                                                        'text-blue-500 font-medium'
                                                }>{t('add_test_cases_dialog.priority_label', { priority: tc.priority })}</span>
                                                <Badge variant={isApproved ? 'success' : 'outline'} className="ml-auto text-[10px]">
                                                    {t(`common.statuses.${tc.status}`, { defaultValue: tc.status })}
                                                </Badge>
                                            </div>
                                            {!isApproved && <span className="text-[11px] text-amber-600">{t('add_test_cases_dialog.approved_only')}</span>}
                                        </div>
                                    </div>
                                    )
                                })}
                                {testCases.length === 0 && (
                                    <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-2">
                                        <Search className="h-8 w-8 opacity-20" />
                                        <span>{t('add_test_cases_dialog.no_cases_found')}</span>
                                    </div>
                                )}
                                {hasNextPage && (
                                    <div className="p-4 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fetchNextPage();
                                            }}
                                            disabled={isFetchingNextPage}
                                        >
                                            {isFetchingNextPage ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                t('add_test_cases_dialog.load_more')
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="pt-4 border-t border-border/40">
                    <Button
                        onClick={() => addItemsMutation.mutate(selectedCases)}
                        disabled={selectedCases.length === 0 || addItemsMutation.isPending}
                        className="w-full sm:w-auto"
                    >
                        {addItemsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('add_test_cases_dialog.add_button', { count: selectedCases.length })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
