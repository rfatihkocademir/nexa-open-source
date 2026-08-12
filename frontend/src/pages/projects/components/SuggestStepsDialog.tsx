import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, Wand2, Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { automationService, type SuggestedStep } from "@/services/automation.service"
import { useTranslation } from "react-i18next"

interface SuggestStepsDialogProps {
    projectId: string
    onStepsCreated: () => void
    trigger?: React.ReactNode
    className?: string
}

export function SuggestStepsDialog({ projectId, onStepsCreated, trigger, className }: SuggestStepsDialogProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [html, setHtml] = useState("")
    const [suggestions, setSuggestions] = useState<SuggestedStep[]>([])
    const [selectedIndices, setSelectedIndices] = useState<number[]>([])

    const { data: existingSteps } = useQuery({
        queryKey: ["automation-steps", projectId],
        queryFn: () => automationService.getSteps(projectId),
    })

    const suggestMutation = useMutation({
        mutationFn: ({ projectId, html }: { projectId: string; html: string }) =>
            automationService.suggestSteps(projectId, html),
        onSuccess: (data) => {
            if (existingSteps && existingSteps.length > 0) {
                const filtered = data.filter(suggestion => 
                    !existingSteps.some(existing => 
                        existing.actionType === suggestion.actionType && 
                        existing.locator === suggestion.locator
                    )
                );
                
                if (data.length > 0 && filtered.length === 0) {
                    toast.info(t('suggest_steps_dialog.all_exist', 'Tüm önerilen adımlar zaten projenizde mevcut.'));
                }
                
                setSuggestions(filtered)
                setSelectedIndices(filtered.map((_, i) => i))
            } else {
                setSuggestions(data)
                setSelectedIndices(data.map((_, i) => i)) // Select all by default
            }
        },
        onError: () => toast.error(t('suggest_steps_dialog.suggest_error')),
    })

    const createStepsMutation = useMutation({
        mutationFn: async (steps: SuggestedStep[]) => {
            const promises = steps.map(step =>
                automationService.createStep({
                    name: step.name,
                    locator: step.locator,
                    actionType: step.actionType,
                    description: step.description,
                    projectId,
                    data: step.actionType === 'FILL' ? 'test-data' : undefined
                })
            )
            return Promise.all(promises)
        },
        onSuccess: (createdSteps) => {
            toast.success(t('suggest_steps_dialog.create_success', { count: createdSteps.length }))
            onStepsCreated()
            setOpen(false)
            setHtml("")
            setSuggestions([])
            setSelectedIndices([])
        },
        onError: () => toast.error(t('suggest_steps_dialog.create_error')),
    })

    const handleSuggest = () => {
        if (!html.trim()) return
        suggestMutation.mutate({ projectId, html })
    }

    const handleCreateSelected = () => {
        const selectedSteps = suggestions.filter((_, i) => selectedIndices.includes(i))
        if (selectedSteps.length === 0) return
        createStepsMutation.mutate(selectedSteps)
    }

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        )
    }

    const getActionTypeLabel = (type: string) => {
        const key = `create_step_dialog.action_types.${type}`
        const translated = t(key)
        return translated === key ? type : translated
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className={cn("gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors", className)}>
                        <Wand2 className="h-4 w-4" />
                        {t('suggest_steps_dialog.trigger_button')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-background border-primary/10 shadow-2xl">
                <DialogHeader className="flex flex-row items-center gap-4 pb-2 border-b border-border/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {t('suggest_steps_dialog.title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground/80">
                            {t('suggest_steps_dialog.description')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-1 gap-4 min-h-0 pt-4">
                    {/* Left: HTML Input */}
                    <div className="w-1/2 flex flex-col gap-2">
                        <Textarea
                            placeholder={t('suggest_steps_dialog.html_placeholder')}
                            className="flex-1 font-mono text-sm resize-none border-primary/10 focus:border-primary/30 transition-all text-foreground bg-secondary/50"
                            value={html}
                            onChange={(e) => setHtml(e.target.value)}
                        />
                        <Button
                            onClick={handleSuggest}
                            disabled={!html.trim() || suggestMutation.isPending}
                            className=""
                        >
                            {suggestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('suggest_steps_dialog.analyze_button')}
                        </Button>
                    </div>

                    {/* Right: Suggestions */}
                    <div className="w-1/2 flex flex-col gap-2 border border-primary/10 rounded-xl p-4 bg-muted/20 shadow-inner">
                        <div className="flex justify-between items-center pb-2 border-b border-border/40">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Wand2 className="h-3.5 w-3.5 text-primary" />
                                {t('suggest_steps_dialog.suggestions_title')} ({suggestions.length})
                            </h4>
                            <span className="text-xs font-medium text-primary">
                                {t('suggest_steps_dialog.selected_count', { count: selectedIndices.length })}
                            </span>
                        </div>

                        <ScrollArea className="flex-1 pr-2">
                            <div className="space-y-3 pt-2">
                                {suggestions.map((step, index) => (
                                    <Card
                                        key={index}
                                        className={`cursor-pointer border transition-all duration-200 hover:shadow-md ${selectedIndices.includes(index)
                                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                                            : 'border-transparent bg-card hover:bg-accent/50'
                                            }`}
                                        onClick={() => toggleSelection(index)}
                                    >
                                        <CardContent className="p-3 flex items-start gap-3">
                                            <Checkbox
                                                checked={selectedIndices.includes(index)}
                                                onCheckedChange={() => toggleSelection(index)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="font-semibold text-sm text-foreground/90">{step.name}</div>
                                                <div className="text-xs text-muted-foreground line-clamp-2">{step.description}</div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] bg-background/50">{getActionTypeLabel(step.actionType)}</Badge>
                                                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/50 font-mono text-muted-foreground truncate max-w-[150px] block">{step.locator}</code>
                                                </div>
                                            </div>
                                            <Badge variant={step.confidence > 0.8 ? "default" : "secondary"} className={`text-[10px] ${step.confidence > 0.8 ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20' : ''}`}>
                                                {Math.round(step.confidence * 100)}%
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                                {suggestions.length === 0 && !suggestMutation.isPending && (
                                    <div className="text-center text-muted-foreground py-12 text-sm flex flex-col items-center gap-3">
                                        <div className="p-3 bg-muted/50 rounded-full">
                                            <Sparkles className="h-6 w-6 opacity-20" />
                                        </div>
                                        <span>{t('suggest_steps_dialog.no_suggestions')}</span>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <Button
                            onClick={handleCreateSelected}
                            disabled={selectedIndices.length === 0 || createStepsMutation.isPending}
                            className="w-full"
                        >
                            {createStepsMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="mr-2 h-4 w-4" />
                            )}
                            {t('suggest_steps_dialog.create_button', { count: selectedIndices.length })}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
