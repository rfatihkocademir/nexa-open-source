import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    Plus, Trash2, ArrowUp, ArrowDown, Save, Play, Loader2,
    CheckCircle, XCircle, AlertCircle, Pencil, Download, Copy,
    MousePointer2, Keyboard, Clock, Search, Settings2, Terminal, Sparkles, MonitorPlay, Braces, Layers, X, GripVertical
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { Step } from "@/types/testCase"
import { automationService, type AutomationStep, type ScenarioStep, type DryRunResult, type AutomationScenario } from "@/services/automation.service"
import { SuggestStepsDialog } from "./SuggestStepsDialog"
import { CreateStepDialog } from "./CreateStepDialog"
import { UpdateStepDialog } from "./UpdateStepDialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/store/authStore"
import { useAppDialog } from "@/components/ui/app-dialog-context"

interface ScenarioBuilderProps {
    testCaseId: string
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    manualSteps?: Step[]
}

const getStepIcon = (type?: string) => {
    if (!type) return <Terminal className="h-4 w-4" />
    const t = type.toLowerCase()
    if (t.includes('click')) return <MousePointer2 className="h-4 w-4" />
    if (t.includes('type') || t.includes('input')) return <Keyboard className="h-4 w-4" />
    if (t.includes('assert') || t.includes('verify')) return <CheckCircle className="h-4 w-4" />
    if (t.includes('wait')) return <Clock className="h-4 w-4" />
    return <Terminal className="h-4 w-4" />
}

const getStepColor = (type?: string) => {
    if (!type) return "bg-muted text-muted-foreground border-border"
    const t = type.toLowerCase()
    if (t.includes('click')) return "bg-info/10 text-info border-info/20 dark:border-info/40"
    if (t.includes('type')) return "bg-primary/10 text-primary border-primary/20 dark:border-primary/40"
    if (t.includes('assert')) return "bg-success/10 text-success border-success/20 dark:border-success/40"
    if (t.includes('wait')) return "bg-warning/10 text-warning border-warning/20 dark:border-warning/40"
    return "bg-muted text-muted-foreground border-border"
}

const getStepReadiness = (step?: AutomationStep) => {
    if (!step) return { ready: false, label: "Eksik", detail: "Adım seçilmedi" }

    const actionType = step.actionType?.toUpperCase()
    const needsLocator = ["CLICK", "FILL", "ASSERT_TEXT", "ASSERT_VISIBLE", "SELECT"].includes(actionType)
    const needsData = ["FILL", "ASSERT_TEXT", "WAIT", "SELECT", "SET_COOKIE", "SET_LOCAL_STORAGE"].includes(actionType)
    const missingLocator = needsLocator && !step.locator?.trim()
    const missingData = needsData && !step.data?.trim()

    if (missingLocator || missingData) {
        return {
            ready: false,
            label: "Kontrol gerekli",
            detail: missingLocator ? "Locator eksik" : "Veri eksik",
        }
    }

    return { ready: true, label: "Hazır", detail: "Çalıştırmaya uygun" }
}

export function ScenarioEditor({ testCaseId, projectId, manualSteps }: { testCaseId: string, projectId: string, manualSteps?: Step[] }) {
    const { t } = useTranslation()
    const { data: scenario, isLoading, isError } = useQuery({
        queryKey: ["automation-scenario", testCaseId],
        queryFn: () => automationService.getScenarioByTestCase(testCaseId),
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex h-full items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                    <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
                    <p className="mt-3 text-sm font-semibold text-foreground">{t('scenario_builder.load_error_title')}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.load_error_description')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
                <ScenarioBuilderContent 
                    key={testCaseId} 
                    testCaseId={testCaseId} 
                    projectId={projectId} 
                    manualSteps={manualSteps} 
                    initialScenario={scenario}
                />
            </div>
        </div>
    )
}

export function ScenarioBuilder({ testCaseId, projectId, open, onOpenChange, manualSteps }: ScenarioBuilderProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[100dvh] w-[100vw] max-w-none rounded-none border-0 p-0 shadow-2xl sm:h-[95vh] sm:w-[95vw] sm:max-w-[95vw] sm:rounded-xl sm:border-primary/10">
                <ScenarioEditor testCaseId={testCaseId} projectId={projectId} manualSteps={manualSteps} />
            </DialogContent>
        </Dialog>
    )
}

const getAbsoluteVideoUrl = (videoUrl: string | undefined) => {
    if (!videoUrl) return "";
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    if (backendUrl) {
        return `${backendUrl}${videoUrl}`;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "";
    if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
        const rootUrl = apiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/v1\/?$/, "");
        return `${rootUrl}${videoUrl}`;
    }
    if (window.location.port === "5173" || window.location.port === "5174") {
        return `http://${window.location.hostname}:1996${videoUrl}`;
    }
    return videoUrl;
};

import { socketService } from '@/services/socket.service';

type LiveRunEvent = {
    type: 'step:start' | 'step:end' | 'action' | 'pointer' | 'stream:status'
    stepIndex?: number
    name?: string
    actionType?: string
    status?: 'passed' | 'failed' | 'running' | 'connected' | 'disconnected'
    error?: string
    x?: number
    y?: number
    viewportWidth?: number
    viewportHeight?: number
}

const framePayloadToUrl = (payload: unknown): string | null => {
    if (!payload) return null
    if (typeof payload === 'string') return `data:image/jpeg;base64,${payload}`
    if (payload instanceof Blob) return URL.createObjectURL(payload)
    if (payload instanceof ArrayBuffer) return URL.createObjectURL(new Blob([payload], { type: 'image/jpeg' }))
    if (ArrayBuffer.isView(payload)) {
        const view = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
        return URL.createObjectURL(new Blob([new Uint8Array(view)], { type: 'image/jpeg' }))
    }
    if (typeof payload === 'object' && payload !== null && 'type' in payload && 'data' in payload) {
        const bufferPayload = payload as { type?: string; data?: number[] }
        if (bufferPayload.type === 'Buffer' && Array.isArray(bufferPayload.data)) {
            return URL.createObjectURL(new Blob([new Uint8Array(bufferPayload.data)], { type: 'image/jpeg' }))
        }
    }
    return null
}

function LiveSessionModal({ open, onOpenChange, runId, status, stepNames }: { open: boolean, onOpenChange: (open: boolean) => void, runId: string | null, status?: string, stepNames: string[] }) {
    const { t } = useTranslation()
    const [frameUrl, setFrameUrl] = useState<string | null>(null)
    const frameUrlRef = useRef<string | null>(null)
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
    const [activeAction, setActiveAction] = useState<string | null>(null)
    const [activeStepName, setActiveStepName] = useState<string | null>(null)
    const { data: polledFrame } = useQuery({
        queryKey: ['dryrun-live-frame', runId],
        queryFn: () => automationService.getLiveFrame(runId!),
        enabled: open && !!runId,
        refetchInterval: false,
        staleTime: 10_000,
    })
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (!open) {
            window.setTimeout(() => setElapsed(0), 0)
            return
        }
        const startedAt = Date.now()
        const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
        return () => window.clearInterval(timer)
    }, [open, runId])

    useEffect(() => {
        if (!open || !runId) {
            if (frameUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(frameUrlRef.current)
            frameUrlRef.current = null
            const resetTimer = window.setTimeout(() => {
                setFrameUrl(null)
                setActiveStepIndex(null)
                setCompletedSteps(new Set())
                setActiveAction(null)
                setActiveStepName(null)
            }, 0)
            return () => window.clearTimeout(resetTimer)
        }

        let socket = socketService.getSocket()
        if (!socket) {
            const token = useAuthStore.getState().token || localStorage.getItem('token') || localStorage.getItem('accessToken');
            if (token) {
                socketService.connect(token);
                socket = socketService.getSocket();
            }
        }

        if (!socket) return

        const eventName = `test-live-frame-${runId}`
        const liveEventName = `test-live-event-${runId}`
        const handleFrame = (payload: unknown) => {
            const nextUrl = framePayloadToUrl(payload)
            if (!nextUrl) return
            const previousUrl = frameUrlRef.current
            frameUrlRef.current = nextUrl
            setFrameUrl(nextUrl)
            if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
        }
        const handleLiveEvent = (event: LiveRunEvent) => {
            if (!event) return
            if (event.type === 'step:start' && typeof event.stepIndex === 'number') {
                setActiveStepIndex(event.stepIndex)
                setActiveStepName(event.name || stepNames[event.stepIndex] || null)
                setActiveAction(event.actionType || null)
            } else if (event.type === 'action') {
                if (typeof event.stepIndex === 'number') {
                    setActiveStepIndex(event.stepIndex)
                    setActiveStepName(event.name || stepNames[event.stepIndex] || null)
                }
                setActiveAction(event.actionType || null)
            } else if (event.type === 'pointer' && typeof event.x === 'number' && typeof event.y === 'number') {
                if (typeof event.stepIndex === 'number') {
                    setActiveStepIndex(event.stepIndex)
                    setActiveStepName(event.name || stepNames[event.stepIndex] || null)
                }
            } else if (event.type === 'step:end' && typeof event.stepIndex === 'number') {
                if (event.status === 'passed') {
                    setCompletedSteps((previous) => new Set(previous).add(event.stepIndex!))
                }
                setActiveAction(null)
            }
        }

        socket.on(eventName, handleFrame)
        socket.on(liveEventName, handleLiveEvent)
        // Replay the latest frame in case the socket connected after the
        // first screenshot was emitted by the runner.
        socket.emit('request-live-frame', runId)
        return () => {
            socket?.off(eventName, handleFrame)
            socket?.off(liveEventName, handleLiveEvent)
        }
    }, [open, runId, stepNames])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[92vw] w-full max-h-[90vh] h-full flex flex-col p-0 gap-0 overflow-hidden bg-background border-primary/10 shadow-premium rounded-xl">
                <DialogHeader className="px-6 py-4 border-b bg-muted/20 flex-shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                            <MonitorPlay className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="font-heading text-lg font-semibold tracking-tight">{t('scenario_builder.live_session', 'Canlı İzleme')}</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                </span>
                                {status === 'RUNNING' ? 'Test arka planda koşuluyor; ekran canlı olarak aktarılıyor.' : 'Koşum başlatılıyor...'}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="rounded-md border bg-background px-2 py-1 font-mono">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
                        <Badge variant="outline" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" />{status === 'RUNNING' ? 'Çalışıyor' : 'Hazırlanıyor'}</Badge>
                    </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 flex bg-black/95 overflow-hidden">
                    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-zinc-950/90 p-3 md:block">
                        <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Test adımları</p>
                        <div className="space-y-1.5">
                            {stepNames.map((name, index) => {
                                const isActive = activeStepIndex === index
                                const isComplete = completedSteps.has(index)
                                return (
                                    <div key={`${name}-${index}`} className={cn(
                                        "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-all",
                                        isActive ? "border-primary/60 bg-primary/15 text-white shadow-[0_0_18px_rgba(99,102,241,0.18)]" : "border-white/5 bg-white/[0.03] text-zinc-300"
                                    )}>
                                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]", isComplete ? "bg-emerald-500/20 text-emerald-300" : isActive ? "bg-primary text-white" : "bg-primary/15 text-primary")}>{isComplete ? '✓' : index + 1}</span>
                                        <span className="truncate">{name}</span>
                                        {isActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
                                    </div>
                                )
                            })}
                        </div>
                    </aside>
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
                    {activeStepIndex !== null && (
                        <div className="pointer-events-none absolute left-5 top-5 z-20 max-w-[min(420px,calc(100%-2.5rem))] rounded-xl border border-indigo-300/30 bg-zinc-950/90 px-3.5 py-2.5 text-white shadow-2xl backdrop-blur">
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
                                <MousePointer2 className="h-3.5 w-3.5" />
                                <span>Adım {activeStepIndex + 1} / {stepNames.length}</span>
                                {activeAction && <span className="rounded bg-indigo-400/20 px-1.5 py-0.5 text-[9px] text-indigo-100">{activeAction}</span>}
                            </div>
                            <p className="mt-1 truncate text-xs font-medium text-zinc-100">{activeStepName || stepNames[activeStepIndex]}</p>
                        </div>
                    )}
                    {frameUrl || polledFrame?.frame ? (
                        <div className="relative flex max-h-full max-w-full items-stretch">
                            <img
                                src={frameUrl || `data:image/jpeg;base64,${polledFrame?.frame}`}
                                alt="Live Session Frame"
                                className="block max-h-full max-w-full rounded-md object-contain shadow-2xl ring-1 ring-white/10"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-white/50">
                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                            <p className="text-sm">Bağlantı bekleniyor...</p>
                        </div>
                    )}
                    {activeAction && (
                        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-indigo-300/20 bg-zinc-950/85 px-3 py-1.5 text-[11px] text-zinc-200 shadow-xl backdrop-blur">
                            <span className="mr-1.5 text-indigo-300">●</span>{activeAction}
                        </div>
                    )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function ScenarioBuilderContent({ testCaseId, projectId, manualSteps, initialScenario }: { testCaseId: string, projectId: string, manualSteps?: Step[], initialScenario?: AutomationScenario | null }) {
    const { t } = useTranslation()
    const { confirm } = useAppDialog()
    const queryClient = useQueryClient()
    const scenario = initialScenario
    const [searchTerm, setSearchTerm] = useState("")
    const [libraryFilter, setLibraryFilter] = useState<"ALL" | "UI" | "API">("ALL")
    const [pageObjectFilter, setPageObjectFilter] = useState("ALL")
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
    const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null)
    const [isLibraryOpen, setIsLibraryOpen] = useState(false)
    const [insertIndex, setInsertIndex] = useState<number | null>(null)

    // Helper to format variable pairs
    const getInitialPairs = (vars: Record<string, string> | undefined) => {
        if (!vars) return [{ key: "", value: "" }]
        const pairs = Object.entries(vars).map(([key, value]) => ({
            key,
            value: String(value)
        }))
        return pairs.length > 0 ? pairs : [{ key: "", value: "" }]
    }

    const [variables, setVariables] = useState<Record<string, string>>(initialScenario?.variables || {})
    const [variablesString, setVariablesString] = useState(initialScenario?.variables ? JSON.stringify(initialScenario.variables, null, 2) : "{}")
    const [variablesView, setVariablesView] = useState<"table" | "json">("table")
    const [variablePairs, setVariablePairs] = useState<{ key: string, value: string }[]>(getInitialPairs(initialScenario?.variables))
    const [localSteps, setLocalSteps] = useState<AutomationStep[]>([]) // For new scenario creation
    const [scenarioTitle, setScenarioTitle] = useState(initialScenario?.title || initialScenario?.testCase?.title || "")
    const [scenarioDescription, setScenarioDescription] = useState(initialScenario?.description || "")
    const [isScenarioSettingsOpen, setIsScenarioSettingsOpen] = useState(false)

    const [activeDryRunId, setActiveDryRunId] = useState<string | null>(null)

    const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
    const [isDryRunResultOpen, setIsDryRunResultOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("steps")
    const [editingStepData, setEditingStepData] = useState<{ step: AutomationStep, scenarioStepId?: string, orderIndex?: number } | null>(null)
    const [catalogEditingStep, setCatalogEditingStep] = useState<AutomationStep | null>(null)

    // Fetch available steps
    const { data: availableSteps, isLoading: isLoadingSteps } = useQuery({
        queryKey: ["automation-steps", projectId],
        queryFn: () => automationService.getSteps(projectId),
    })

    // Sync from JSON string to pairs (when switching to table view or after error check)
    const syncStringToPairs = (jsonStr: string) => {
        try {
            const parsed = JSON.parse(jsonStr)
            setVariables(parsed) // Sync logic added
            const pairs = Object.entries(parsed).map(([key, value]) => ({
                key,
                value: typeof value === 'string' ? value : JSON.stringify(value)
            }))
            setVariablePairs(pairs.length > 0 ? pairs : [{ key: "", value: "" }])
            return true
        } catch {
            return false
        }
    }

    // Sync from pairs to JSON string
    const syncPairsToString = (pairs: { key: string, value: string }[]) => {
        const obj: Record<string, string> = {}
        pairs.forEach(p => {
            if (p.key.trim()) {
                obj[p.key.trim()] = p.value
            }
        })
        setVariables(obj) // Sync logic added
        setVariablesString(JSON.stringify(obj, null, 2))
    }


    // Mutations
    const createScenarioMutation = useMutation({
        mutationFn: automationService.createScenario,
        onSuccess: () => {
            toast.success(t('scenario_builder.create_success'))
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
            setLocalSteps([])
        },
        onError: () => toast.error(t('scenario_builder.create_error')),
    })

    const publishScenarioMutation = useMutation({
        mutationFn: () => automationService.publishScenario(scenario!.id),
        onSuccess: () => {
            toast.success(t('scenario_builder.publish_success'))
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || t('scenario_builder.publish_error')),
    })

    const updateScenarioMetadataMutation = useMutation({
        mutationFn: () => automationService.updateScenario(scenario!.id, {
            title: scenarioTitle.trim(),
            description: scenarioDescription.trim(),
        }),
        onSuccess: () => {
            toast.success(t('scenario_builder.settings_updated'))
            setIsScenarioSettingsOpen(false)
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: () => toast.error(t('scenario_builder.settings_update_error')),
    })

    const addStepMutation = useMutation({
        mutationFn: ({ scenarioId, stepId, orderIndex }: { scenarioId: string; stepId: string; orderIndex: number }) =>
            automationService.addStepToScenario(scenarioId, stepId, orderIndex),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: () => toast.error(t('scenario_builder.add_step_error')),
    })

    const removeStepMutation = useMutation({
        mutationFn: automationService.removeStepFromScenario,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: () => toast.error(t('scenario_builder.remove_step_error')),
    })

    const reorderMutation = useMutation({
        mutationFn: ({ scenarioId, steps }: { scenarioId: string; steps: { id: string; orderIndex: number }[] }) =>
            automationService.reorderSteps(scenarioId, steps),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: () => toast.error(t('scenario_builder.reorder_error')),
    })

    const updateVariablesMutation = useMutation({
        mutationFn: ({ id, variables }: { id: string; variables: Record<string, string> }) =>
            automationService.updateScenario(id, { variables }),
        onSuccess: () => {
            toast.success(t('scenario_builder.variables_updated'))
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
    })

    const deleteGlobalStepMutation = useMutation({
        mutationFn: automationService.deleteStep,
        onSuccess: () => {
            toast.success(t('common.deleted', 'Silindi'))
            queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
        },
        onError: () => toast.error(t('common.error', 'Hata oluştu')),
    })

    // Polling active dry run
    const { data: dryRunStatus, isError: isDryRunError, error: dryRunError } = useQuery({
        queryKey: ['dryrun-status', activeDryRunId],
        queryFn: () => automationService.getDryRunStatus(activeDryRunId!),
        enabled: !!activeDryRunId,
        retry: (failureCount, error: any) => {
            if (error?.response?.status === 404) return false;
            return failureCount < 3;
        },
        refetchInterval: (query) => {
            if (query.state.data?.status === 'RUNNING') return 2000;
            return false;
        },
    });

    // Handle status changes & errors
    useEffect(() => {
        if (activeDryRunId && isDryRunError) {
            const status = (dryRunError as any)?.response?.status;
            if (status === 404) {
                toast.error(t('scenario_builder.verification_error', 'Test koşum bilgisi bulunamadı.'));
                window.setTimeout(() => setActiveDryRunId(null), 0);
            }
            return;
        }

        if (activeDryRunId && dryRunStatus) {
            if (dryRunStatus.status === 'COMPLETED' || dryRunStatus.status === 'FAILED') {
                if (dryRunStatus.result) {
                    window.setTimeout(() => {
                        setDryRunResult(dryRunStatus.result!);
                        setIsDryRunResultOpen(true);
                    }, 0);
                    if (dryRunStatus.status === 'COMPLETED' && dryRunStatus.result.status === 'PASS') {
                        toast.success(t('scenario_builder.verification_success'));
                    } else {
                        toast.error(t('scenario_builder.verification_failed'));
                    }
                } else if (dryRunStatus.error) {
                    toast.error(dryRunStatus.error);
                }
                window.setTimeout(() => setActiveDryRunId(null), 0);
            }
        }
    }, [dryRunStatus, isDryRunError, dryRunError, activeDryRunId, testCaseId, t]);

    const dryRunMutation = useMutation({
        mutationFn: ({ steps, variables, headless }: { steps: AutomationStep[]; variables: Record<string, string>; headless: boolean }) =>
            automationService.startDryRun(projectId, steps, variables, headless),
        onSuccess: (data) => {
            const runId = data.dryRunId;
            setActiveDryRunId(runId);
            toast.info(t('scenario_builder.dry_run_started', 'Test yavaşlatılmış modda başlatıldı, lütfen bekleyin...'));
        },
        onError: () => toast.error(t('scenario_builder.verification_error')),
    })

    const autoGenerateFromManualSteps = () => {
        if (!manualSteps || !availableSteps) return;

        const newScenarioSteps: { stepId: string; orderIndex: number }[] = [];

        manualSteps.forEach((mStep, index) => {
            const action = mStep.action.toLowerCase();

            let bestMatch: AutomationStep | null = null;
            let highestScore = 0;

            availableSteps.forEach(aStep => {
                let score = 0;
                const aName = aStep.name.toLowerCase();
                const aDesc = (aStep.description || "").toLowerCase();

                // Exact match (bonus)
                if (aName === action) score += 20;
                // Inclusion
                else if (aName.includes(action) || action.includes(aName)) score += 10;

                // Keyword matching
                const mWords = action.split(/[\s,.;:!?()]+/).filter(w => w.length > 2);
                const aWords = (aName + " " + aDesc).split(/[\s,.;:!?()]+/).filter(w => w.length > 2);

                mWords.forEach(mw => {
                    if (aWords.includes(mw)) score += 3;
                });

                // Action type hint matching
                const clickKeywords = ["tıkla", "bas", "seç", "click", "press", "select", "tap"];
                const fillKeywords = ["yaz", "gir", "doldur", "type", "fill", "input", "enter"];

                if (aStep.actionType === 'CLICK' && clickKeywords.some(kw => action.includes(kw))) score += 5;
                if (aStep.actionType === 'FILL' && fillKeywords.some(kw => action.includes(kw))) score += 5;

                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = aStep;
                }
            });

            if (bestMatch && highestScore > 7) {
                const matchedStep = bestMatch as AutomationStep;
                newScenarioSteps.push({
                    stepId: matchedStep.id,
                    orderIndex: index + 1
                });
            }
        });

        if (newScenarioSteps.length > 0) {
            createScenarioMutation.mutate({
                testCaseId,
                steps: newScenarioSteps,
                variables: {}
            });
            toast.success(t('scenario_builder.auto_generate_success', { count: newScenarioSteps.length }));
        } else {
            toast.error(t('scenario_builder.auto_generate_no_matches'));
        }
    };

    // Handlers
    const handleAddStep = (step: AutomationStep) => {
        if (scenario) {
            // Add to existing scenario
            const nextIndex = insertIndex ?? (scenario.steps?.length || 0)
            addStepMutation.mutate({
                scenarioId: scenario.id,
                stepId: step.id,
                orderIndex: nextIndex + 1,
            }, {
                onSuccess: (createdStep) => {
                    setSelectedStepId(createdStep.id)
                    setInsertIndex(null)
                    setIsLibraryOpen(false)
                },
            })
        } else {
            // Add to local state
            const targetIndex = insertIndex ?? localSteps.length
            const newSteps = [...localSteps]
            newSteps.splice(targetIndex, 0, step)
            setSelectedStepId(`${step.id}-${targetIndex}`)
            setLocalSteps(newSteps)
            setInsertIndex(null)
            setIsLibraryOpen(false)
        }
    }

    const handleRemoveStep = async (id: string, index: number) => {
        const confirmed = await confirm({
            title: t('scenario_builder.remove_step_title', 'Adımı akıştan kaldır'),
            description: t('scenario_builder.remove_step_confirm', 'Bu adımı senaryodan kaldırmak istediğinize emin misiniz?'),
            confirmLabel: t('common.delete', 'Sil'),
            destructive: true,
        })
        if (!confirmed) return

        setSelectedStepId(null)
        if (scenario) {
            removeStepMutation.mutate(id)
        } else {
            const newSteps = [...localSteps]
            newSteps.splice(index, 1)
            setLocalSteps(newSteps)
        }
    }

    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        if (scenario) {
            const steps = [...scenario.steps].sort((a, b) => a.orderIndex - b.orderIndex)
            if (direction === 'up' && index > 0) {
                const temp = steps[index].orderIndex
                steps[index].orderIndex = steps[index - 1].orderIndex
                steps[index - 1].orderIndex = temp
            } else if (direction === 'down' && index < steps.length - 1) {
                const temp = steps[index].orderIndex
                steps[index].orderIndex = steps[index + 1].orderIndex
                steps[index + 1].orderIndex = temp
            }

            reorderMutation.mutate({
                scenarioId: scenario.id,
                steps: steps.map(s => ({ id: s.id, orderIndex: s.orderIndex })),
            })
        } else {
            const newSteps = [...localSteps]
            if (direction === 'up' && index > 0) {
                [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]]
            } else if (direction === 'down' && index < newSteps.length - 1) {
                [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]]
            }
            setLocalSteps(newSteps)
        }
    }

    const handleDropStep = (targetIndex: number) => {
        if (draggedStepIndex === null || draggedStepIndex === targetIndex) return

        if (scenario) {
            const steps = [...scenario.steps].sort((a, b) => a.orderIndex - b.orderIndex)
            const [movedStep] = steps.splice(draggedStepIndex, 1)
            steps.splice(targetIndex, 0, movedStep)
            reorderMutation.mutate({
                scenarioId: scenario.id,
                steps: steps.map((step, index) => ({ id: step.id, orderIndex: index + 1 })),
            })
            setSelectedStepId(movedStep.id)
        } else {
            const newSteps = [...localSteps]
            const [movedStep] = newSteps.splice(draggedStepIndex, 1)
            newSteps.splice(targetIndex, 0, movedStep)
            setLocalSteps(newSteps)
            setSelectedStepId(`${movedStep.id}-${targetIndex}`)
        }
        setDraggedStepIndex(null)
    }

    const handleSaveNewScenario = () => {
        let finalVariables = variables;
        try {
            finalVariables = JSON.parse(variablesString);
        } catch {
            toast.error(t('scenario_builder.invalid_json_error'));
            return;
        }

        createScenarioMutation.mutate({
            testCaseId,
            steps: localSteps.map((step, index) => ({
                stepId: step.id,
                orderIndex: index + 1,
            })),
            variables: finalVariables,
            title: scenarioTitle.trim() || undefined,
            description: scenarioDescription.trim() || undefined,
        })
    }

    const handleUpdateVariables = () => {
        if (scenario) {
            let finalVariables = variables;
            try {
                finalVariables = JSON.parse(variablesString);
            } catch (error) {
                console.error(error);
                toast.error(t('scenario_builder.invalid_json_error'));
                return;
            }

            updateVariablesMutation.mutate({
                id: scenario.id,
                variables: finalVariables,
            })
        }
    }

    const handleStepsCreated = (createdStep?: AutomationStep) => {
        queryClient.invalidateQueries({ queryKey: ["automation-steps", projectId] })
        if (createdStep) handleAddStep(createdStep)
    }

    const handleDryRun = () => {
        // Correctly handle either ScenarioStep or AutomationStep
        const stepsToRun: AutomationStep[] = currentSteps.map((item: ScenarioStep | AutomationStep) => 
            'step' in item ? item.step : item
        )

        let finalVariables = variables;
        try {
            finalVariables = JSON.parse(variablesString);
        } catch {
            toast.error(t('scenario_builder.invalid_json_error'));
            return;
        }

        dryRunMutation.mutate({ steps: stepsToRun, variables: finalVariables, headless: true })
    }

    const handleEditStep = (step: AutomationStep, scenarioStepId?: string, orderIndex?: number) => {
        setEditingStepData({ step, scenarioStepId, orderIndex })
    }

    const handleStepUpdated = (updatedStep: AutomationStep) => {
        if (editingStepData?.scenarioStepId && updatedStep.id !== editingStepData.step.id && scenario) {
            // It was a "Create New" (Local Copy) - Replace the step in the scenario
            // 1. Remove old
            removeStepMutation.mutate(editingStepData.scenarioStepId, {
                onSuccess: () => {
                    // 2. Add new at same index
                    addStepMutation.mutate({
                        scenarioId: scenario.id,
                        stepId: updatedStep.id,
                        orderIndex: editingStepData.orderIndex!
                    }, {
                        onSuccess: (createdStep) => setSelectedStepId(createdStep.id),
                    })
                }
            })
        } else {
            // Global update - invalidate scenario to reflect changes (e.g. name change)
            queryClient.invalidateQueries({ queryKey: ["automation-scenario", testCaseId] })
            setSelectedStepId(`${updatedStep.id}-${(editingStepData?.orderIndex ?? 1) - 1}`)
        }
        setEditingStepData(null);
    }

    const pageObjectGroups = Array.from(new Set(
        (availableSteps ?? [])
            .map((step) => step.pageObject?.trim())
            .filter((pageObject): pageObject is string => Boolean(pageObject))
    )).sort((a, b) => a.localeCompare(b))

    const filteredSteps = availableSteps?.filter((step: AutomationStep) => {
        const queryMatches = step.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            step.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            step.locator.toLowerCase().includes(searchTerm.toLowerCase()) ||
            step.pageObject?.toLowerCase().includes(searchTerm.toLowerCase())
        const typeMatches = libraryFilter === "ALL" ||
            (libraryFilter === "API" ? step.actionType === "API_REQUEST" : step.actionType !== "API_REQUEST")
        const pageObjectMatches = pageObjectFilter === "ALL" || (step.pageObject?.trim() || "") === pageObjectFilter
        return queryMatches && typeMatches && pageObjectMatches
    })

    const groupedLibrarySteps = Object.entries((filteredSteps ?? []).reduce<Record<string, AutomationStep[]>>((groups, step) => {
        const groupKey = step.pageObject?.trim() || "__UNASSIGNED__"
        groups[groupKey] = groups[groupKey] || []
        groups[groupKey].push(step)
        return groups
    }, {})).sort(([first], [second]) => {
        if (first === "__UNASSIGNED__") return 1
        if (second === "__UNASSIGNED__") return -1
        return first.localeCompare(second)
    })

    const currentSteps: (ScenarioStep | AutomationStep)[] = scenario 
        ? [...scenario.steps].sort((a, b) => a.orderIndex - b.orderIndex) 
        : localSteps

    const getCurrentStepId = (item: ScenarioStep | AutomationStep, index = 0) => scenario
        ? (item as ScenarioStep).id
        : `${(item as AutomationStep).id}-${index}`

    const selectedIndex = selectedStepId
        ? currentSteps.findIndex((item, index) => getCurrentStepId(item, index) === selectedStepId)
        : -1
    const activeIndex = selectedIndex >= 0 ? selectedIndex : (currentSteps.length > 0 ? 0 : -1)
    const selectedItem = activeIndex >= 0 ? currentSteps[activeIndex] : null
    const selectedStep = selectedItem
        ? scenario ? (selectedItem as ScenarioStep).step : selectedItem as AutomationStep
        : null
    const incompleteStepCount = currentSteps.filter((item) => {
        const step = scenario ? (item as ScenarioStep).step : item as AutomationStep
        return !getStepReadiness(step).ready
    }).length
    const variableCount = Object.keys(variables).length

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950/[0.02]">
            <header className="shrink-0 border-b bg-card px-3 py-2 pr-12 lg:px-4 lg:pr-12">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                            <Settings2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{t('scenario_builder.workspace_eyebrow')}</p>
                                <Badge variant={scenario?.status === 'PUBLISHED' ? "default" : "outline"} className={cn("h-5 px-2 text-[10px]", scenario?.status === 'PUBLISHED' && "bg-success text-success-foreground") }>
                                    {scenario?.status === 'PUBLISHED' ? t('scenario_builder.status_published') : t('scenario_builder.status_draft')}
                                </Badge>
                                {scenario?.version ? <span className="text-[10px] text-muted-foreground">v{scenario.version}</span> : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{scenario?.title || scenario?.testCase?.title || scenarioTitle || t('scenario_builder.workspace_title')}</h2>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setIsScenarioSettingsOpen(true)} aria-label={t('scenario_builder.settings_button')} title={t('scenario_builder.settings_button')}>
                                    <Settings2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className="hidden truncate text-[11px] text-muted-foreground md:block">{t('scenario_builder.workspace_description')}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="hidden items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1 text-[11px] sm:flex">
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{t('scenario_builder.metric_steps')}</span>
                                <span className="font-semibold text-foreground">{currentSteps.length}</span>
                            </div>
                            <div className="h-5 w-px bg-border" />
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{t('scenario_builder.metric_quality')}</span>
                                <span className={cn("font-semibold", incompleteStepCount > 0 ? "text-warning" : "text-success")}>{incompleteStepCount > 0 ? t('scenario_builder.quality_attention') : t('scenario_builder.quality_ready')}</span>
                            </div>
                            <div className="h-5 w-px bg-border" />
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{t('scenario_builder.metric_variables')}</span>
                                <span className="font-semibold text-foreground">{variableCount}</span>
                            </div>
                        </div>
                        <Button
                            variant="info"
                            size="sm"
                            onClick={handleDryRun}
                            disabled={currentSteps.length === 0 || incompleteStepCount > 0 || dryRunMutation.isPending || !!activeDryRunId}
                            className="h-8 gap-1.5 px-2.5"
                        >
                            {dryRunMutation.isPending || !!activeDryRunId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                <span className="hidden sm:inline">{dryRunMutation.isPending || !!activeDryRunId ? t('common.running', 'Çalışıyor...') : t('scenario_builder.run_test_button')}</span>
                        </Button>
                        {activeTab === "steps" && (
                            <Button size="sm" className="h-8 gap-1.5 px-2.5" onClick={() => { setInsertIndex(null); setIsLibraryOpen(true) }}>
                                <Plus className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('scenario_builder.add_step_button')}</span>
                            </Button>
                        )}
                        {scenario && scenario.status !== 'PUBLISHED' && (
                            <Button
                                variant="success"
                                size="sm"
                                className="h-8 gap-1.5 px-2.5"
                                onClick={() => publishScenarioMutation.mutate()}
                                disabled={publishScenarioMutation.isPending || currentSteps.length === 0 || incompleteStepCount > 0}
                                title={incompleteStepCount > 0 ? t('scenario_builder.publish_quality_hint') : undefined}
                            >
                                {publishScenarioMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{t('scenario_builder.publish_button')}</span>
                            </Button>
                        )}
                        {!scenario && (
                            <Button
                                size="sm"
                                variant="success"
                                onClick={handleSaveNewScenario}
                                disabled={createScenarioMutation.isPending || currentSteps.length === 0}
                                className="h-8 gap-1.5 px-2.5"
                            >
                                {createScenarioMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{t('scenario_builder.save_button')}</span>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="h-8 rounded-lg bg-muted p-1">
                            <TabsTrigger value="steps" className="h-6 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Layers className="h-3.5 w-3.5" />
                                {t('scenario_builder.scenario_flow_tab')}
                            </TabsTrigger>
                            <TabsTrigger value="variables" className="h-6 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Braces className="h-3.5 w-3.5" />
                                {t('scenario_builder.variables_tab')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <span className="hidden text-xs text-muted-foreground lg:inline">{t('scenario_builder.workspace_hint')}</span>
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1">
                <aside className="hidden" aria-hidden="true">
                    <div className="flex items-start justify-between border-b px-4 py-4">
                        <div>
                            <p className="text-sm font-semibold text-foreground">{t('scenario_builder.flow_panel_title')}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.flow_panel_hint')}</p>
                        </div>
                        <Badge variant="secondary" className="h-6 px-2 text-xs">{currentSteps.length}</Badge>
                    </div>

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-2 p-3">
                            {currentSteps.length === 0 ? (
                                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center">
                                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    <p className="mt-3 text-xs font-semibold text-foreground">{t('scenario_builder.flow_empty_title')}</p>
                                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{t('scenario_builder.flow_empty_hint')}</p>
                                </div>
                            ) : currentSteps.map((item, index) => {
                                const step = scenario ? (item as ScenarioStep).step : item as AutomationStep
                                const itemId = getCurrentStepId(item, index)
                                const readiness = getStepReadiness(step)
                                const isSelected = activeIndex === index
                                return (
                                    <div
                                        key={`${itemId}-${index}`}
                                        draggable
                                        onDragStart={() => setDraggedStepIndex(index)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => { event.preventDefault(); handleDropStep(index) }}
                                        onDragEnd={() => setDraggedStepIndex(null)}
                                        title={t('scenario_builder.drag_hint')}
                                        className={cn("cursor-grab rounded-xl border transition-colors active:cursor-grabbing", draggedStepIndex === index && "opacity-50", isSelected ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "border-border/70 bg-card hover:border-primary/20")}
                                    >
                                        <div className="flex items-start gap-2 p-2">
                                            <button
                                                type="button"
                                                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                                onClick={() => setSelectedStepId(itemId)}
                                            >
                                                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{index + 1}</span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-xs font-semibold text-foreground">{step.name}</span>
                                                    <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", readiness.ready ? "bg-success" : "bg-warning")} />
                                                        {step.actionType}
                                                    </span>
                                                </span>
                                            </button>
                                            <div className="flex shrink-0 items-center gap-0.5">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleMoveStep(index, 'up')} disabled={index === 0} aria-label={t('scenario_builder.move_up')} title={t('scenario_builder.move_up')}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleMoveStep(index, 'down')} disabled={index === currentSteps.length - 1} aria-label={t('scenario_builder.move_down')} title={t('scenario_builder.move_down')}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>

                    <div className="border-t p-3">
                        <div className="flex items-start gap-2 rounded-lg bg-primary/[0.06] p-3 text-[11px] leading-5 text-muted-foreground">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{t('scenario_builder.flow_selection_hint')}</span>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1 bg-muted/20">
                    <ScrollArea className="h-full">
                        <div className="min-h-full w-full p-2 sm:p-3 lg:p-4">
                            {activeTab === "steps" && (
                                <div className="space-y-3">
                                    {currentSteps.length > 0 && (
                                        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">{t('scenario_builder.flow_panel_title')}</h3>
                                                    <p className="hidden text-[11px] text-muted-foreground sm:block">{t('scenario_builder.flow_panel_hint')}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="h-6 px-2 text-[11px]">{t('scenario_builder.step_count', { count: currentSteps.length })}</Badge>
                                                    <Badge variant="outline" className={cn("h-6 px-2 text-[11px]", incompleteStepCount > 0 ? "border-warning/30 text-warning" : "border-success/30 text-success")}>
                                                        {incompleteStepCount > 0 ? t('scenario_builder.quality_attention') : t('scenario_builder.quality_ready')}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="p-1.5 sm:p-2">
                                                <div className="relative space-y-1">
                                                    <div className="absolute bottom-6 left-[1rem] top-6 w-px bg-border" aria-hidden="true" />
                                                    {currentSteps.map((item, index) => {
                                                        const step = scenario ? (item as ScenarioStep).step : item as AutomationStep
                                                        const itemId = getCurrentStepId(item, index)
                                                        const readiness = getStepReadiness(step)
                                                        const isSelected = activeIndex === index
                                                        return (
                                                            <div key={`flow-${itemId}-${index}`} className="relative z-10 space-y-1">
                                                                <div className="flex items-start gap-2">
                                                                    <button
                                                                        type="button"
                                                                        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold shadow-sm transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                                                                        onClick={() => setSelectedStepId(itemId)}
                                                                        aria-label={`${t('scenario_builder.step_label')} ${index + 1}`}
                                                                    >
                                                                        {index + 1}
                                                                    </button>
                                                                    <div
                                                                        draggable
                                                                        onDragStart={() => setDraggedStepIndex(index)}
                                                                        onDragOver={(event) => event.preventDefault()}
                                                                        onDrop={(event) => { event.preventDefault(); handleDropStep(index) }}
                                                                        onDragEnd={() => setDraggedStepIndex(null)}
                                                                        className={cn("min-w-0 flex-1 rounded-lg border px-2.5 py-2 transition-all", draggedStepIndex === index && "opacity-50", isSelected ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/10" : "border-border/80 bg-background hover:border-primary/25")}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" aria-hidden="true" />
                                                                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedStepId(itemId)}>
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <span className="truncate text-sm font-semibold text-foreground">{step.name}</span>
                                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[9px] uppercase tracking-wide">{step.actionType}</Badge>
                                                                                    {step.pageObject && <Badge variant="outline" className="h-5 max-w-40 gap-1 truncate px-1.5 text-[9px] font-normal"><Layers className="h-2.5 w-2.5 shrink-0" />{step.pageObject}</Badge>}
                                                                                </div>
                                                                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{step.locator || t('scenario_builder.no_locator')}</p>
                                                                            </button>
                                                                            <div className="flex shrink-0 items-center gap-0.5">
                                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStep(step, scenario ? (item as ScenarioStep).id : undefined, scenario ? (item as ScenarioStep).orderIndex : index + 1)} aria-label={t('scenario_builder.edit_step')} title={t('scenario_builder.edit_step')}><Pencil className="h-3 w-3" /></Button>
                                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddStep(step)} aria-label={t('scenario_builder.duplicate_step')} title={t('scenario_builder.duplicate_step')}><Copy className="h-3 w-3" /></Button>
                                                                                <Button variant="ghost" size="icon" className="hidden h-7 w-7 sm:inline-flex" onClick={() => handleMoveStep(index, 'up')} disabled={index === 0} aria-label={t('scenario_builder.move_up')} title={t('scenario_builder.move_up')}><ArrowUp className="h-3 w-3" /></Button>
                                                                                <Button variant="ghost" size="icon" className="hidden h-7 w-7 sm:inline-flex" onClick={() => handleMoveStep(index, 'down')} disabled={index === currentSteps.length - 1} aria-label={t('scenario_builder.move_down')} title={t('scenario_builder.move_down')}><ArrowDown className="h-3 w-3" /></Button>
                                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void handleRemoveStep(itemId, index)} aria-label={t('scenario_builder.remove_step')} title={t('scenario_builder.remove_step')}><Trash2 className="h-3 w-3" /></Button>
                                                                            </div>
                                                                        </div>
                                                                        {!readiness.ready && (
                                                                            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-warning/20 bg-warning/5 px-2 py-1.5 text-[11px] text-warning">
                                                                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                                                <span>{readiness.detail}</span>
                                                                                <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[11px] text-warning hover:bg-warning/10 hover:text-warning" onClick={() => handleEditStep(step, scenario ? (item as ScenarioStep).id : undefined, scenario ? (item as ScenarioStep).orderIndex : index + 1)}>{t('scenario_builder.fix_step')}</Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button type="button" className="ml-10 flex h-6 w-[calc(100%-2.5rem)] items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary" onClick={() => { setInsertIndex(index + 1); setIsLibraryOpen(true) }}>
                                                                    <Plus className="h-3 w-3" />
                                                                    {t('scenario_builder.add_between_steps')}
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {!selectedStep ? (
                                        <Card className="border-dashed bg-card/70">
                                            <CardContent className="px-5 py-8 sm:px-8 sm:py-10">
                                                <div className="mx-auto max-w-2xl text-center">
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MousePointer2 className="h-6 w-6" /></div>
                                                    <h3 className="mt-5 text-xl font-semibold text-foreground">{t('scenario_builder.empty_state_title')}</h3>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('scenario_builder.empty_state_description_simple')}</p>
                                                </div>
                                                <div className="mx-auto mt-7 grid max-w-2xl gap-3 md:grid-cols-3">
                                                    {manualSteps && manualSteps.length > 0 && (
                                                        <Button variant="outline" className="h-auto min-h-24 flex-col items-start gap-2 p-4 text-left" onClick={autoGenerateFromManualSteps} disabled={createScenarioMutation.isPending}>
                                                            <Sparkles className="h-5 w-5 text-primary" />
                                                            <span><span className="block text-sm font-semibold">{t('scenario_builder.start_from_manual')}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{t('scenario_builder.start_from_manual_hint')}</span></span>
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" className="h-auto min-h-24 flex-col items-start gap-2 p-4 text-left" onClick={() => { setInsertIndex(0); setIsLibraryOpen(true) }}>
                                                        <Plus className="h-5 w-5 text-primary" />
                                                        <span><span className="block text-sm font-semibold">{t('scenario_builder.start_from_library')}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{t('scenario_builder.start_from_library_hint')}</span></span>
                                                    </Button>
                                                    <CreateStepDialog
                                                        projectId={projectId}
                                                        onStepCreated={handleStepsCreated}
                                                        trigger={<Button variant="outline" className="h-auto min-h-24 w-full flex-col items-start gap-2 p-4 text-left"><Plus className="h-5 w-5 text-primary" /><span><span className="block text-sm font-semibold">{t('scenario_builder.start_with_step')}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{t('scenario_builder.start_with_step_hint')}</span></span></Button>}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <Card className="hidden">
                                            <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 py-5 lg:px-6">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", getStepColor(selectedStep.actionType))}>
                                                        {getStepIcon(selectedStep.actionType)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{t('scenario_builder.step_label')} {activeIndex + 1}</span>
                                                            <Badge variant="secondary" className="h-5 px-2 text-[10px] uppercase tracking-wider">{selectedStep.actionType}</Badge>
                                                            <Badge variant={getStepReadiness(selectedStep).ready ? "default" : "outline"} className={cn("h-5 px-2 text-[10px]", !getStepReadiness(selectedStep).ready && "border-warning/30 text-warning") }>
                                                                {getStepReadiness(selectedStep).label}
                                                            </Badge>
                                                        </div>
                                                        <h3 className="mt-1 truncate text-lg font-semibold text-foreground">{selectedStep.name}</h3>
                                                        <p className="mt-1 text-xs text-muted-foreground">{getStepReadiness(selectedStep).detail}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleEditStep(selectedStep, scenario ? (selectedItem as ScenarioStep).id : undefined, scenario ? (selectedItem as ScenarioStep).orderIndex : activeIndex + 1)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        {t('scenario_builder.edit_step')}
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleAddStep(selectedStep)}>
                                                        <Copy className="h-3.5 w-3.5" />
                                                        {t('scenario_builder.duplicate_step')}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void handleRemoveStep(getCurrentStepId(selectedItem!, activeIndex), activeIndex)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        {t('scenario_builder.remove_step')}
                                                    </Button>
                                                </div>
                                            </div>

                                            <CardContent className="space-y-5 p-5 lg:p-6">
                                                {selectedStep.description && (
                                                    <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
                                                        {selectedStep.description}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">{t('scenario_builder.step_details_title')}</p>
                                                            <p className="mt-1 text-xs text-muted-foreground">{t('scenario_builder.step_details_hint')}</p>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleEditStep(selectedStep, scenario ? (selectedItem as ScenarioStep).id : undefined, scenario ? (selectedItem as ScenarioStep).orderIndex : activeIndex + 1)}>
                                                            <Settings2 className="h-3.5 w-3.5" />
                                                            {t('scenario_builder.open_editor')}
                                                        </Button>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="rounded-xl border bg-muted/20 p-4">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('scenario_builder.locator_label')}</p>
                                                            <p className="mt-2 break-all font-mono text-xs leading-5 text-foreground">{selectedStep.locator || t('scenario_builder.not_defined')}</p>
                                                        </div>
                                                        <div className="rounded-xl border bg-muted/20 p-4">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('scenario_builder.data_label')}</p>
                                                            <p className="mt-2 break-all font-mono text-xs leading-5 text-foreground">{selectedStep.data || t('scenario_builder.not_defined')}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                                                    <div className="rounded-xl border bg-background p-4">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('scenario_builder.usage_label')}</p>
                                                        <p className="mt-1 text-sm font-semibold text-foreground">{t('scenario_builder.usage_count', { count: selectedStep._count?.scenarioSteps || 0 })}</p>
                                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.usage_hint')}</p>
                                                    </div>
                                                    <div className="rounded-xl border bg-background p-4">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('scenario_builder.order_label')}</p>
                                                        <div className="mt-2 flex items-center justify-between gap-2">
                                                            <span className="text-sm font-semibold text-foreground">{activeIndex + 1} / {currentSteps.length}</span>
                                                            <div className="flex items-center gap-1">
                                                                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleMoveStep(activeIndex, 'up')} disabled={activeIndex === 0}><ArrowUp className="h-3 w-3" />{t('scenario_builder.move_up')}</Button>
                                                                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleMoveStep(activeIndex, 'down')} disabled={activeIndex === currentSteps.length - 1}><ArrowDown className="h-3 w-3" />{t('scenario_builder.move_down')}</Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}

                            {activeTab === "variables" && (
                                <Card className="overflow-hidden border-primary/10 bg-card shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 py-5 lg:px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Braces className="h-5 w-5" /></div>
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground">{t('scenario_builder.environment_variables_title')}</h3>
                                                <p className="mt-1 text-xs text-muted-foreground">{t('scenario_builder.environment_variables_description')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center rounded-lg border bg-background p-0.5">
                                                <Button variant={variablesView === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => { if (syncStringToPairs(variablesString)) setVariablesView('table'); else toast.error(t('scenario_builder.invalid_json_error')) }} className="h-7 px-3 text-[11px]">{t('scenario_builder.table_view_label')}</Button>
                                                <Button variant={variablesView === 'json' ? 'secondary' : 'ghost'} size="sm" onClick={() => setVariablesView('json')} className="h-7 px-3 text-[11px]">{t('scenario_builder.json_view_label')}</Button>
                                            </div>
                                            {scenario && <Button onClick={handleUpdateVariables} size="sm" className="h-8 gap-2"><Save className="h-3.5 w-3.5" />{t('scenario_builder.update_variables_button')}</Button>}
                                        </div>
                                    </div>
                                    <CardContent className="p-5 lg:p-6">
                                        {variablesView === "table" ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-[1fr_1fr_40px] gap-3 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"><div>{t('scenario_builder.variable_key')}</div><div>{t('scenario_builder.variable_value')}</div><div /></div>
                                                <div className="space-y-2">
                                                    {variablePairs.map((pair: { key: string, value: string }, idx: number) => (
                                                        <div key={idx} className="grid grid-cols-[1fr_1fr_40px] items-start gap-3">
                                                            <Input value={pair.key} placeholder="API_KEY..." onChange={(e) => { const newPairs = [...variablePairs]; newPairs[idx].key = e.target.value; setVariablePairs(newPairs); syncPairsToString(newPairs) }} className="h-10 bg-background font-mono text-sm placeholder:font-sans" />
                                                            <Input value={pair.value} placeholder="value..." onChange={(e) => { const newPairs = [...variablePairs]; newPairs[idx].value = e.target.value; setVariablePairs(newPairs); syncPairsToString(newPairs) }} className="h-10 bg-background font-mono text-sm placeholder:font-sans" />
                                                            <Button variant="ghost" size="icon" onClick={() => { const newPairs = variablePairs.filter((_, i) => i !== idx); const finalPairs = newPairs.length > 0 ? newPairs : [{ key: "", value: "" }]; setVariablePairs(finalPairs); syncPairsToString(finalPairs) }} disabled={variablePairs.length === 1 && !pair.key && !pair.value} aria-label={t('common.delete')} className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button variant="outline" className="w-full border-dashed text-xs text-primary hover:bg-primary/5" onClick={() => setVariablePairs([...variablePairs, { key: "", value: "" }])}><Plus className="mr-2 h-3.5 w-3.5" />{t('scenario_builder.add_variable_button')}</Button>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border bg-muted/30 p-1 ring-1 ring-inset ring-black/5">
                                                <Textarea value={variablesString} onChange={(e) => setVariablesString(e.target.value)} className="h-[390px] resize-none border-none bg-background font-mono text-sm shadow-none focus-visible:ring-0" placeholder='{"BASE_URL": "https://example.com"}' />
                                            </div>
                                        )}
                                        <div className="mt-5 flex items-start gap-2 rounded-xl border border-dashed bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
                                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                            <span><strong className="text-foreground">{t('scenario_builder.tip_label')}</strong> {t('scenario_builder.json_format_help')} <code className="rounded border bg-background px-1.5 py-0.5 font-mono text-foreground">{"${NAME}"}</code></span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </ScrollArea>
                </main>

                {isLibraryOpen && <button type="button" aria-label={t('common.close')} className="fixed inset-0 z-20 bg-slate-950/20" onClick={() => setIsLibraryOpen(false)} />}
                <aside className={cn("fixed inset-y-0 right-0 z-30 flex w-[min(92vw,320px)] shrink-0 flex-col border-l bg-background shadow-2xl", isLibraryOpen ? "flex" : "hidden")}>
                    {activeTab === "steps" ? (
                        <>
                            <div className="border-b px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{t('scenario_builder.library_panel_title')}</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.library_panel_hint')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="h-6 px-2 text-xs">{filteredSteps?.length || 0}</Badge>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsLibraryOpen(false)} aria-label={t('common.close')} title={t('common.close')}><X className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    <CreateStepDialog projectId={projectId} onStepCreated={handleStepsCreated} className="h-7 w-full truncate px-2 text-[11px]" />
                                    <SuggestStepsDialog projectId={projectId} onStepsCreated={handleStepsCreated} className="h-7 w-full truncate px-2 text-[11px]" />
                                </div>
                                <div className="relative mt-2">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input placeholder={t('scenario_builder.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8 bg-background pl-9 text-xs" />
                                </div>
                                <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                                    {([['ALL', t('scenario_builder.filter_all')], ['UI', t('scenario_builder.filter_ui')], ['API', t('scenario_builder.filter_api')]] as const).map(([value, label]) => (
                                        <Button key={value} variant={libraryFilter === value ? 'secondary' : 'ghost'} size="sm" className="h-6 flex-1 px-1.5 text-[10px]" onClick={() => setLibraryFilter(value)}>{label}</Button>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <label htmlFor="page-object-filter" className="sr-only">{t('scenario_builder.page_object_filter')}</label>
                                    <select
                                        id="page-object-filter"
                                        value={pageObjectFilter}
                                        onChange={(event) => setPageObjectFilter(event.target.value)}
                                        className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="ALL">{t('scenario_builder.all_page_objects')}</option>
                                        {pageObjectGroups.map((pageObject) => <option key={pageObject} value={pageObject}>{pageObject}</option>)}
                                    </select>
                                </div>
                            </div>
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="space-y-1.5 p-2">
                                    {isLoadingSteps ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : groupedLibrarySteps.length ? groupedLibrarySteps.map(([groupKey, steps]) => (
                                        <details key={groupKey} open={searchTerm.trim().length > 0 || pageObjectFilter !== "ALL" || groupedLibrarySteps.length === 1} className="group/section overflow-hidden rounded-lg border bg-muted/20">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                                                <span className="flex min-w-0 items-center gap-2"><Layers className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{groupKey === "__UNASSIGNED__" ? t('scenario_builder.unassigned_page_object') : groupKey}</span></span>
                                                <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">{t('scenario_builder.page_object_group_count', { count: steps.length })}</Badge>
                                            </summary>
                                            <div className="space-y-1.5 border-t p-1.5">
                                                {steps.map((step) => (
                                                    <div key={step.id} className="group rounded-lg border bg-card p-2 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", getStepColor(step.actionType))}>{getStepIcon(step.actionType)}</div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold leading-4 text-foreground">{step.name}</p>
                                                                <div className="mt-0.5 flex items-center gap-1.5"><Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase">{step.actionType}</Badge>{step._count?.scenarioSteps ? <span className="text-[10px] text-muted-foreground">{t('scenario_builder.step_used_count', { count: step._count.scenarioSteps })}</span> : null}</div>
                                                            </div>
                                                            <Button variant="default" size="sm" className="h-7 shrink-0 gap-1 px-2 text-[11px]" onClick={() => handleAddStep(step)} aria-label={t('common.add')} title={t('common.add')}><Plus className="h-3 w-3" /><span>{t('common.add')}</span></Button>
                                                        </div>
                                                        <div className="mt-1.5 flex items-center justify-between gap-2 border-t pt-1.5">
                                                            <span className="truncate font-mono text-[10px] text-muted-foreground" title={step.locator}>{step.locator || t('scenario_builder.no_locator')}</span>
                                                            <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCatalogEditingStep(step)} aria-label={t('common.edit')} title={t('common.edit')}><Pencil className="h-3 w-3" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => void confirm({ title: t('common.delete'), description: t('common.confirm_delete'), destructive: true }).then((confirmed) => { if (confirmed) deleteGlobalStepMutation.mutate(step.id) })} aria-label={t('common.delete')} title={t('common.delete')}><Trash2 className="h-3 w-3" /></Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )) : <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">{t('scenario_builder.library_empty')}</div>}
                                </div>
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="space-y-4 p-4">
                            <div className="rounded-xl border bg-card p-4">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Braces className="h-4 w-4" /></div>
                                <h3 className="mt-3 text-sm font-semibold text-foreground">{t('scenario_builder.variables_guide_title')}</h3>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.variables_guide_description')}</p>
                                <code className="mt-4 block rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs text-primary">{"${BASE_URL}"}</code>
                            </div>
                            <div className="rounded-xl border bg-card p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('scenario_builder.metric_variables')}</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">{variableCount}</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('scenario_builder.variables_count_hint')}</p>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            <Dialog open={isScenarioSettingsOpen} onOpenChange={setIsScenarioSettingsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('scenario_builder.settings_title')}</DialogTitle>
                        <DialogDescription>{t('scenario_builder.settings_description')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3">
                        <div className="grid gap-2">
                            <Label htmlFor="automation-scenario-title">{t('scenario_builder.settings_name_label')}</Label>
                            <Input
                                id="automation-scenario-title"
                                value={scenarioTitle}
                                onChange={(event) => setScenarioTitle(event.target.value)}
                                placeholder={t('scenario_builder.settings_name_placeholder')}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="automation-scenario-description">{t('scenario_builder.settings_description_label')}</Label>
                            <Textarea
                                id="automation-scenario-description"
                                value={scenarioDescription}
                                onChange={(event) => setScenarioDescription(event.target.value)}
                                placeholder={t('scenario_builder.settings_description_placeholder')}
                                className="min-h-24 resize-y"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsScenarioSettingsOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            onClick={() => scenario ? updateScenarioMetadataMutation.mutate() : setIsScenarioSettingsOpen(false)}
                            disabled={!scenario ? !scenarioTitle.trim() : updateScenarioMetadataMutation.isPending || !scenarioTitle.trim()}
                        >
                            {updateScenarioMetadataMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {scenario ? t('common.save') : t('scenario_builder.settings_apply_before_save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dry Run Result Dialog */}
            <Dialog open={isDryRunResultOpen} onOpenChange={(open) => {
                setIsDryRunResultOpen(open);
                if (!open && dryRunResult?.videoUrl) {
                    automationService.cleanupVideo(projectId, dryRunResult.videoUrl).catch(console.error);
                }
            }}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-zinc-950 text-zinc-50 border-zinc-800 shadow-2xl overflow-hidden">
                    <DialogHeader className="border-b border-zinc-800 bg-zinc-900 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                                    <Terminal className="h-5 w-5 text-zinc-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-zinc-100 text-base">{t('scenario_builder.console_title')}</DialogTitle>
                                    <DialogDescription className="text-zinc-500 text-xs">{t('scenario_builder.console_description')}</DialogDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('scenario_builder.duration_label')}</span>
                                    <span className="text-sm font-mono text-zinc-300">{dryRunResult?.duration}ms</span>
                                </div>
                                <div className="h-8 w-px bg-zinc-800" />
                                {dryRunResult?.status === 'PASS' ? (
                                    <Badge className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20 px-3 py-1 text-sm">{t('scenario_builder.passed_badge')}</Badge>
                                ) : (
                                    <Badge className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 px-3 py-1 text-sm">{t('scenario_builder.failed_badge')}</Badge>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Steps List */}
                        <div className="w-[350px] border-r border-zinc-800 bg-zinc-900/30 flex flex-col">
                            <div className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50">{t('scenario_builder.execution_steps_label')}</div>
                            <ScrollArea className="flex-1">
                                <div className="p-2 space-y-1">
                                    {dryRunResult?.steps?.map((step, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all border border-transparent",
                                                step.status === 'failed' ? "bg-red-500/10 text-red-200 border-red-500/20" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                                            )}
                                        >
                                            {step.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                                            {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                                            {step.status === 'skipped' && <AlertCircle className="h-4 w-4 text-zinc-600 flex-shrink-0" />}
                                            <span className="truncate font-medium">{step.name}</span>
                                            <span className="ml-auto text-[10px] text-zinc-600 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">{step.duration}ms</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Logs & Video */}
                        <div className="flex-1 flex flex-col bg-zinc-950 relative">
                            {dryRunResult?.videoUrl && (
                                <div className="border-b border-zinc-800 bg-black flex flex-col items-center justify-center p-6 shadow-2xl z-10 gap-4">
                                    <video
                                        src={getAbsoluteVideoUrl(dryRunResult.videoUrl)}
                                        controls
                                        autoPlay
                                        className="max-h-[350px] rounded-lg border border-zinc-800 shadow-lg"
                                    />
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = getAbsoluteVideoUrl(dryRunResult.videoUrl);
                                                link.download = `test-video-${Date.now()}.webm`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                        >
                                            <Download className="h-4 w-4" />
                                            {t('scenario_builder.download_video')}
                                        </Button>
                                        <div className="flex items-center gap-2 text-[10px] text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                                            <AlertCircle className="h-3 w-3" />
                                            {t('scenario_builder.video_temporary_warning')}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 flex flex-col min-h-0">
                                {dryRunResult?.status === 'FAIL' && dryRunResult.steps?.find(s => s.status === 'failed')?.error && (
                                    <div className="p-4 border-b border-red-500/20 bg-red-500/5">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-1 overflow-hidden">
                                                <h4 className="text-sm font-medium text-red-400">{t('scenario_builder.execution_failed_title')}</h4>
                                                <p className="text-xs text-red-300/80 font-mono break-all whitespace-pre-wrap">
                                                    {dryRunResult.steps.find(s => s.status === 'failed')?.error}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-2">{t('scenario_builder.console_output_label')}</span>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="p-4 font-mono text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed selection:bg-zinc-700 selection:text-zinc-100">
                                        {dryRunResult?.logs || <span className="text-zinc-600 italic">{t('scenario_builder.no_logs_message')}</span>}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {
                editingStepData && (
                    <UpdateStepDialog
                        key={editingStepData.step.id}
                        step={editingStepData.step}
                        projectId={projectId}
                        open={!!editingStepData}
                        onOpenChange={(open) => !open && setEditingStepData(null)}
                        onStepUpdated={handleStepUpdated}
                    />
                )
            }
            {
                catalogEditingStep && (
                    <UpdateStepDialog
                        key={catalogEditingStep.id}
                        step={catalogEditingStep}
                        projectId={projectId}
                        open={!!catalogEditingStep}
                        onOpenChange={(open) => !open && setCatalogEditingStep(null)}
                        onStepUpdated={() => {
                            // Automatically handled by invalidateQueries in UpdateStepDialog
                            setCatalogEditingStep(null);
                        }}
                    />
                )
            }
            <LiveSessionModal 
                open={!!activeDryRunId} 
                onOpenChange={(open) => {
                    if (!open) {
                        setActiveDryRunId(null);
                    }
                }} 
                runId={activeDryRunId} 
                status={dryRunStatus?.status}
                stepNames={currentSteps.map((step) => 'step' in step ? step.step.name : step.name)}
            />
        </div >
    )
}
