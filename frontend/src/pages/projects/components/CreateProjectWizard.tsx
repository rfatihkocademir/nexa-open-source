import { useState } from 'react';
import { api } from '@/services/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import {
    CheckCircle2, ChevronRight, ChevronLeft, FileText, LayoutTemplate,
    Settings2, Users, Search, X, Plus, Loader2, Sparkles, MessageSquare
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { projectService } from '@/services/project.service';
import { userService } from '@/services/user.service';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';
import type { User } from '@/types/auth';
import type { ApiResponse } from '@/types/api';

interface CreateProjectWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface AiQuestion {
    text: string;
    suggestions?: string[];
}

interface QuestionsPayload {
    questions: Array<string | AiQuestion>;
}

interface DocumentationSuitePayload {
    docs: Record<string, string>;
    titles?: Record<string, string>;
}

interface ArchitecturePayload {
    architecture: string;
}

const createInitialFormData = () => ({
    name: '',
    description: '',
    scope: '',
    architecture: '',
    memberIds: [] as string[],
    wikiContent: '',
    documentationSuite: {
        scope: '',
        testStrategy: '',
        automationStrategy: '',
        releasePolicy: '',
    } as Record<string, string>,
    documentationTitles: {} as Record<string, string>,
});

export function CreateProjectWizard({ open, onOpenChange }: CreateProjectWizardProps) {
    const [step, setStep] = useState(1);
    const [activeDocTab, setActiveDocTab] = useState('scope');
    const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
    const [aiAnswers, setAiAnswers] = useState<Record<number, string>>({});
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [isGeneratingSuite, setIsGeneratingSuite] = useState(false);
    // Architecture AI interview state
    const [archQuestions, setArchQuestions] = useState<AiQuestion[]>([]);
    const [archAnswers, setArchAnswers] = useState<Record<number, string>>({});
    const [isGeneratingArchQuestions, setIsGeneratingArchQuestions] = useState(false);
    const [isGeneratingArchDoc, setIsGeneratingArchDoc] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation();

const STEPS = [
    { id: 1, title: t('create_project_wizard.steps.project_info'), icon: Settings2, description: t('create_project_wizard.description.project_info') },
    { id: 2, title: t('create_project_wizard.steps.interview'), icon: MessageSquare, description: t('create_project_wizard.ai.interview_desc') },
    { id: 3, title: t('create_project_wizard.steps.docs'), icon: FileText, description: t('create_project_wizard.description.purpose_scope') },
    { id: 4, title: t('create_project_wizard.steps.architecture'), icon: LayoutTemplate, description: t('create_project_wizard.description.architecture') },
    { id: 5, title: t('create_project_wizard.steps.team'), icon: Users, description: t('create_project_wizard.description.team') }
];


    const [formData, setFormData] = useState(createInitialFormData);


    // Fetch users for member selection
    const { data: allUsers = [] } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: () => userService.getAll(),
        enabled: open && step === 5,
    });

    const filteredUsers = allUsers.filter(user => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const query = memberSearch.toLowerCase();
        return (fullName.includes(query) || user.email.toLowerCase().includes(query)) &&
            !formData.memberIds.includes(user.id);
    });

    const selectedUsers = allUsers.filter(u => formData.memberIds.includes(u.id));

    const createMutation = useMutation({
        mutationFn: (data: typeof formData) => {
            const payload = {
                ...data,
                // If suite wasn't generated or user edited scope directly, fallback
                scope: data.documentationSuite.scope || data.scope,
                architecture: data.architecture,
                documentationSuite: {
                    ...data.documentationSuite,
                    architecture: data.architecture // Include arch in the suite
                }
            };
            return projectService.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.success(t('create_project_wizard.toast.create_success'));
            handleClose();
        },
        onError: () => toast.error(t('create_project_wizard.toast.create_error'))
    });


    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep(1);
            setFormData(createInitialFormData());
            setAiQuestions([]);
            setAiAnswers({});
            setArchQuestions([]);
            setArchAnswers({});
            setMemberSearch('');
        }, 300);
    };


    // Helper to check if rich text content is actually empty
    const isHtmlEmpty = (html: string) => {
        if (!html) return true;
        const stripped = html.replace(/<[^>]*>/g, '').trim();
        return stripped.length === 0;
    };

    const handleSuggestionClick = (idx: number, suggestion: string) => {
        setAiAnswers(prev => {
            const current = (prev[idx] || '').trim();
            // Split by comma or newline and trim
            const items = current.split(/,|\n/).map(s => s.trim()).filter(Boolean);
            
            if (items.includes(suggestion)) {
                // Remove it
                const filtered = items.filter(s => s !== suggestion);
                return { ...prev, [idx]: filtered.join(', ') };
            } else {
                // Add it
                return { ...prev, [idx]: current ? `${current}, ${suggestion}` : suggestion };
            }
        });
    };

    const handleArchSuggestionClick = (idx: number, suggestion: string) => {
        setArchAnswers(prev => {
            const current = (prev[idx] || '').trim();
            const items = current.split(/,|\n/).map(s => s.trim()).filter(Boolean);
            if (items.includes(suggestion)) {
                const filtered = items.filter(s => s !== suggestion);
                return { ...prev, [idx]: filtered.join(', ') };
            } else {
                return { ...prev, [idx]: current ? `${current}, ${suggestion}` : suggestion };
            }
        });
    };

    const handleSkipAi = () => {
        setIsGeneratingQuestions(false);
        setIsGeneratingSuite(false);
        setStep(3);
    };

    const handleSkipArchAi = () => {
        setIsGeneratingArchQuestions(false);
        setIsGeneratingArchDoc(false);
        setStep(5);
    };

    const handleNext = async () => {

        // Step 1: Info -> Generate Questions
        if (step === 1) {
            if (!formData.name.trim()) {
                toast.error(t('create_project_wizard.validation.name_required'));
                return;
            }

                // Generate Questions
            setIsGeneratingQuestions(true);
            try {
                const response = (await api.post<ApiResponse<QuestionsPayload>>('/projects/ai/questions', {
                    name: formData.name,
                    description: formData.description,
                    language: i18n.language || 'en'
                })) as unknown as ApiResponse<QuestionsPayload>;
                const rawQuestions = response.data.questions;

                if (rawQuestions && Array.isArray(rawQuestions)) {
                    // Normalize questions to handle both old string format and new object format
                    const normalized = rawQuestions.map((q: string | AiQuestion) => 
                        typeof q === 'string' ? { text: q, suggestions: [] } : q
                    );
                    setAiQuestions(normalized);
                    setStep(2);
                } else {
                    toast.error(t('create_project_wizard.toast.generate_questions_error'));
                }

            } catch (error) {
                console.error(error);
                toast.error(t('create_project_wizard.toast.ai_error_manual_scope'));
                setStep(3); // Skip interview
            } finally {
                setIsGeneratingQuestions(false);
            }
            return;
        }

        // Step 2: Interview -> Generate Documentation Suite
        if (step === 2) {
            setIsGeneratingSuite(true);
            try {
                const qaPairs = aiQuestions.map((q, i) => ({
                    question: q.text,
                    answer: aiAnswers[i] || 'Skipped'
                }));


                const response = (await api.post<ApiResponse<DocumentationSuitePayload>>('/projects/ai/documentation-suite', {
                    name: formData.name,
                    description: formData.description,
                    qaPairs: qaPairs,
                    language: i18n.language || 'en'
                })) as unknown as ApiResponse<DocumentationSuitePayload>;
                const result = response.data;

                if (result && result.docs) {
                    setFormData(prev => ({ 
                        ...prev, 
                        documentationSuite: result.docs,
                        documentationTitles: result.titles ?? {},
                        scope: result.docs.scope || prev.scope
                    }));
                    setStep(3);
                }
            } catch (error) {
                console.error(error);
                toast.error(t('create_project_wizard.toast.generate_suite_error'));
                setStep(3);
            } finally {
                setIsGeneratingSuite(false);
            }
            return;
        }

        // Step 3: Documentation Review -> Generate Architecture Questions
        if (step === 3) {
            setIsGeneratingArchQuestions(true);
            try {
                const scopeSummary = formData.documentationSuite.scope || formData.scope || '';
                const response = (await api.post<ApiResponse<QuestionsPayload>>('/projects/ai/architecture-questions', {
                    name: formData.name,
                    description: formData.description,
                    scopeSummary,
                    language: i18n.language || 'en'
                })) as unknown as ApiResponse<QuestionsPayload>;
                const rawQuestions = response.data.questions;

                if (rawQuestions && Array.isArray(rawQuestions)) {
                    const normalized = rawQuestions.map((q: string | AiQuestion) =>
                        typeof q === 'string' ? { text: q, suggestions: [] } : q
                    );
                    setArchQuestions(normalized);
                    setStep(4);
                } else {
                    toast.error(t('create_project_wizard.toast.generate_questions_error'));
                    setStep(4);
                }
            } catch (error) {
                console.error(error);
                setStep(4); // Go to step 4 anyway, user can fill manually
            } finally {
                setIsGeneratingArchQuestions(false);
            }
            return;
        }

        // Step 4: Architecture Interview -> Generate Architecture Document
        if (step === 4) {
            // If there are architecture questions, generate document from answers
            if (archQuestions.length > 0) {
                setIsGeneratingArchDoc(true);
                try {
                    const qaPairs = archQuestions.map((q, i) => ({
                        question: q.text,
                        answer: archAnswers[i] || 'Skipped'
                    }));
                    const scopeSummary = formData.documentationSuite.scope || formData.scope || '';
                    const response = (await api.post<ApiResponse<ArchitecturePayload>>('/projects/ai/architecture', {
                        name: formData.name,
                        description: formData.description,
                        scopeSummary,
                        qaPairs,
                        language: i18n.language || 'en'
                    })) as unknown as ApiResponse<ArchitecturePayload>;

                    if (response.data?.architecture) {
                        setFormData(prev => ({
                            ...prev,
                            architecture: response.data.architecture,
                            documentationSuite: {
                                ...prev.documentationSuite,
                                architecture: response.data.architecture
                            }
                        }));
                    }
                    setStep(5);
                } catch (error) {
                    console.error(error);
                    toast.error(t('create_project_wizard.toast.generate_suite_error'));
                    setStep(5);
                } finally {
                    setIsGeneratingArchDoc(false);
                }
                return;
            }
            // No AI questions — just move forward if user typed something
            if (isHtmlEmpty(formData.architecture)) {
                toast.error(t('create_project_wizard.validation.arch_required'));
                return;
            }
            setStep(5);
            return;
        }


        // Final Step
        if (step < 5) setStep(step + 1);
        else handleCreate();
    };

    const handleCreate = () => {
        createMutation.mutate(formData);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const toggleMember = (userId: string) => {
        setFormData(prev => ({
            ...prev,
            memberIds: prev.memberIds.includes(userId)
                ? prev.memberIds.filter(id => id !== userId)
                : [...prev.memberIds, userId]
        }));
    };

    const removeMember = (userId: string) => {
        setFormData(prev => ({
            ...prev,
            memberIds: prev.memberIds.filter(id => id !== userId)
        }));
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'TEAM_LEADER': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'PRODUCT_OWNER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'SCRUM_MASTER': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'DEVELOPER': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'ANALYST': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
            case 'TESTER': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    const formatRole = (role: string) => {
        const key = `common.roles.${role}`;
        const translated = t(key);
        if (translated !== key) return translated;
        return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const progress = (step / STEPS.length) * 100;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-[calc(100vw-1rem)] max-w-[1200px] h-[calc(100vh-1rem)] sm:h-[85vh] max-h-[900px] p-0 !gap-0 overflow-hidden border-0 shadow-2xl rounded-xl flex flex-col"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <div className="flex flex-1 min-h-0 w-full flex-col sm:flex-row">
                    {/* ─── Left Sidebar ─── */}
                    <div className="relative flex w-full shrink-0 flex-col border-b sm:border-b-0 sm:border-r border-slate-800 bg-slate-950 p-4 sm:w-72 sm:p-8 text-white max-h-44 sm:max-h-none">
                        {/* Decorative gradient circles */}

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <span className="text-xs font-semibold text-primary uppercase tracking-widest">{t('create_project_wizard.sidebar.badge')}</span>
                            </div>
                            <h2 className="text-lg sm:text-2xl font-bold tracking-tight mb-1">{t('create_project_wizard.sidebar.title')}</h2>
                            <p className="hidden sm:block text-sm text-slate-400 leading-relaxed">
                                {t('create_project_wizard.sidebar.description')}
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 sm:mt-8 mb-3 sm:mb-8 relative z-10">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                <span>{t('create_project_wizard.sidebar.progress')}</span>
                                <span className="font-mono">{step}/{STEPS.length}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-2 relative z-10 flex-1">
                            {STEPS.map((s) => {
                                const isActive = step === s.id;
                                const isCompleted = step > s.id;
                                const Icon = s.icon;

                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            // Allow going back but not skipping ahead
                                            if (s.id < step) setStep(s.id);
                                        }}
                                        className={cn(
                                            "w-12 sm:w-full min-w-12 sm:min-w-0 flex items-center justify-center sm:justify-start gap-3 p-2 sm:p-3.5 rounded-lg transition-all duration-300 text-left group",
                                            isActive && "border border-white/10 bg-white/10",
                                            isCompleted && "hover:bg-white/5 cursor-pointer",
                                            !isActive && !isCompleted && "opacity-40 cursor-default"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 text-sm font-bold",
                                            isActive && "bg-primary text-primary-foreground",
                                            isCompleted && "bg-green-500 text-white",
                                            !isActive && !isCompleted && "bg-slate-700/50 border border-slate-600/50 text-slate-400"
                                        )}>
                                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                        </div>
                                            <div className="min-w-0 hidden sm:block">
                                            <div className={cn(
                                                "text-sm font-semibold leading-none mb-1 transition-colors",
                                                isActive ? "text-white" : "text-slate-300"
                                            )}>
                                                {s.title}
                                            </div>
                                            <div className="text-[11px] text-slate-500 leading-none">
                                                {s.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Bottom info */}
                        <div className="hidden sm:block relative z-10 pt-4 border-t border-slate-700/50">
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                <Trans i18nKey="create_project_wizard.sidebar.required_info" components={{ required: <span className="text-red-400">*</span> }} />
                            </p>
                        </div>
                    </div>

                    {/* ─── Main Content ─── */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
                        {/* Header */}
                        <div className="px-4 sm:px-8 pt-4 sm:pt-8 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const StepIcon = STEPS[step - 1].icon;
                                    return (
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <StepIcon className="h-5 w-5" />
                                        </div>
                                    );
                                })()}
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight">{STEPS[step - 1].title}</h3>
                                    <p className="text-sm text-muted-foreground">{STEPS[step - 1].description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 px-8 pb-4 min-h-0 flex flex-col overflow-hidden">

                            {/* Step 1: Basic Info */}
                            {step === 1 && (
                                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 max-w-2xl pr-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">
                                            {t('create_project_wizard.step1.project_name_label')} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.name}
                                            data-testid="wizard-project-name-input"
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder={t('create_project_wizard.step1.project_name_placeholder')}
                                            className="h-12 text-base px-4 border-2 focus:border-primary transition-colors"
                                            autoFocus
                                        />
                                        <p className="text-xs text-muted-foreground">{t('create_project_wizard.step1.project_name_help')}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">{t('create_project_wizard.step1.short_description_label')}</Label>
                                        <Textarea
                                            value={formData.description}
                                            data-testid="wizard-project-desc-input"
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder={t('create_project_wizard.step1.short_description_placeholder')}
                                            className="min-h-[140px] text-sm border-2 focus:border-primary transition-colors resize-none leading-relaxed"
                                        />
                                        <p className="text-xs text-muted-foreground">{t('create_project_wizard.step1.short_description_help')}</p>
                                    </div>

                                    {isGeneratingQuestions && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 flex flex-col items-center justify-center text-center animate-pulse">
                                            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                                            <h4 className="font-semibold text-primary">{t('create_project_wizard.step1.generating_questions_title')}</h4>
                                            <p className="text-sm text-muted-foreground mb-4">{t('create_project_wizard.step1.generating_questions_desc')}</p>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleSkipAi}
                                                className="bg-background text-xs font-semibold"
                                            >
                                                {t('create_project_wizard.ai.skip_ai')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 2: AI Interview (Q&A) */}
                            {step === 2 && (
                                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="mb-4 shrink-0 bg-primary/5 rounded-lg p-4 border border-primary/10">
                                        <div className="flex items-start gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Sparkles className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="font-semibold text-sm text-primary">{t('create_project_wizard.ai.interview_title')}</h4>
                                                    <Button variant="ghost" size="sm" onClick={handleSkipAi} className="h-7 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors">
                                                        {t('create_project_wizard.ai.skip_ai')} →
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('create_project_wizard.ai.interview_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                            <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-4 pb-4">
                                        {aiQuestions.map((q, i) => (
                                            <div key={i} className="space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
                                                <div className="flex items-start gap-3">
                                                    <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                                                        {i + 1}
                                                    </span>
                                                    <Label className="text-base font-medium pt-0.5">{q.text}</Label>
                                                </div>
                                                
                                                {q.suggestions && q.suggestions.length > 0 && (
                                                    <div className="ml-9 flex flex-wrap gap-2">
                                                        {q.suggestions.map((suggestion, sIdx) => {
                                                            const isSelected = (aiAnswers[i] || '')
                                                                .split(/,|\n/)
                                                                .map(s => s.trim())
                                                                .includes(suggestion);

                                                            return (
                                                                <button
                                                                    key={sIdx}
                                                                    type="button"
                                                                    onClick={() => handleSuggestionClick(i, suggestion)}
                                                                    className={cn(
                                                                        "text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-200",
                                                                        "bg-muted/30 hover:bg-primary/5 hover:border-primary/30 hover:text-primary",
                                                                        isSelected 
                                                                            ? "bg-primary/10 border-primary text-primary shadow-sm"
                                                                            : "border-border text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {suggestion}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}


                                                <Textarea
                                                    value={aiAnswers[i] || ''}
                                                    onChange={(e) => setAiAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                                    placeholder={t('create_project_wizard.ai.answer_placeholder')}
                                                    className="min-h-[100px] bg-background/50 border-2 focus:border-primary/50 ml-9 w-[calc(100%-2.25rem)] rounded-lg transition-all"
                                                />
                                            </div>
                                        ))}



                                        {isGeneratingSuite && (
                                            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                                                <div className="bg-background border shadow-lg rounded-lg p-8 flex flex-col items-center gap-4 max-w-sm text-center">
                                                    <div className="relative">
                                                        <Loader2 className="h-10 w-10 text-primary animate-spin relative z-10" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-lg">{t('create_project_wizard.step2.generating_suite_title')}</h4>
                                                        <p className="text-sm text-muted-foreground mt-2 mb-4">{t('create_project_wizard.step2.generating_suite_desc')}</p>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={handleSkipAi}
                                                            className="text-xs"
                                                        >
                                                            {t('create_project_wizard.ai.skip_ai')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Documentation Suite Review */}
                            {step === 3 && (
                                <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="shrink-0">
                                        <h3 className="text-lg font-semibold">{t('create_project_wizard.steps.docs')}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('create_project_wizard.step3.help')}
                                        </p>
                                    </div>
                                    
                                    <Tabs value={activeDocTab} onValueChange={setActiveDocTab} className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
                                        <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/50 rounded-lg shrink-0">
                                            <TabsTrigger value="scope" className="rounded-md py-2 px-4 transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                {formData.documentationTitles.scope || t('project_details.overview')}
                                            </TabsTrigger>
                                            <TabsTrigger value="testStrategy" className="rounded-md py-2 px-4 transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                {formData.documentationTitles.testStrategy || t('project_details.quality')}
                                            </TabsTrigger>
                                            <TabsTrigger value="automationStrategy" className="rounded-md py-2 px-4 transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                {formData.documentationTitles.automationStrategy || t('test_case_details.automation')}
                                            </TabsTrigger>
                                            <TabsTrigger value="releasePolicy" className="rounded-md py-2 px-4 transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                {formData.documentationTitles.releasePolicy || t('common.release_hub')}
                                            </TabsTrigger>
                                        </TabsList>
                                        
                                        {Object.entries(formData.documentationSuite).map(([key, content]) => (
                                            <TabsContent key={key} value={key} className="flex-1 min-h-0 mt-4 ring-offset-background outline-none data-[state=active]:flex flex-col">
                                                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-background/50 shadow-sm flex flex-col overflow-hidden transition-all focus-within:border-primary/30 focus-within:shadow-md focus-within:bg-background">
                                                    <MarkdownEditor
                                                        value={content}
                                                        onChange={(val) => setFormData(prev => ({
                                                            ...prev,
                                                            documentationSuite: { ...prev.documentationSuite, [key]: val }
                                                        }))}
                                                        className="flex-1 border-0 rounded-none shadow-none bg-transparent"
                                                        minHeight="0"
                                                        placeholder={t('create_project_wizard.step3.placeholder')}
                                                    />
                                                </div>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                </div>
                            )}

                            {/* Step 4: Architecture AI Interview */}
                            {step === 4 && (
                                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Architecture questions from AI */}
                                    {archQuestions.length > 0 ? (
                                        <>
                                            <div className="mb-4 shrink-0 bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                                        <LayoutTemplate className="h-4 w-4 text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400">{t('create_project_wizard.step4.architecture_label')}</h4>
                                                            <Button variant="ghost" size="sm" onClick={handleSkipArchAi} className="h-7 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors">
                                                                {t('create_project_wizard.ai.skip_ai')} →
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('create_project_wizard.step4.help')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-4 pb-4">
                                                {archQuestions.map((q, i) => (
                                                    <div key={i} className="space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
                                                        <div className="flex items-start gap-3">
                                                            <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                                {i + 1}
                                                            </span>
                                                            <Label className="text-base font-medium pt-0.5">
                                                                {q.text || (typeof q === 'string' ? q : JSON.stringify(q))}
                                                            </Label>
                                                        </div>

                                                        {q.suggestions && q.suggestions.length > 0 && (
                                                            <div className="ml-9 flex flex-wrap gap-2">
                                                                {q.suggestions.map((suggestion, sIdx) => {
                                                                    const isSelected = (archAnswers[i] || '')
                                                                        .split(/,|\n/)
                                                                        .map(s => s.trim())
                                                                        .includes(suggestion);
                                                                    return (
                                                                        <button
                                                                            key={sIdx}
                                                                            type="button"
                                                                            onClick={() => handleArchSuggestionClick(i, suggestion)}
                                                                            className={cn(
                                                                                "text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-200",
                                                                                "bg-muted/30 hover:bg-blue-500/5 hover:border-blue-500/30 hover:text-blue-600",
                                                                                isSelected
                                                                                    ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                                                                                    : "border-border text-muted-foreground"
                                                                            )}
                                                                        >
                                                                            {suggestion}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        <Textarea
                                                            value={archAnswers[i] || ''}
                                                            onChange={(e) => setArchAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                                            placeholder={t('create_project_wizard.ai.answer_placeholder')}
                                                            className="min-h-[100px] bg-background/50 border-2 focus:border-blue-500/50 ml-9 w-[calc(100%-2.25rem)] rounded-lg transition-all"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        /* Fallback: Manual architecture editor if no AI questions */
                                        <>
                                            <div className="shrink-0 space-y-1 mb-4">
                                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                                    <LayoutTemplate className="h-5 w-5 text-primary" />
                                                    {t('create_project_wizard.step4.architecture_label')}
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('create_project_wizard.step4.help')}
                                                </p>
                                            </div>
                                            <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-background/50 shadow-sm flex flex-col overflow-hidden transition-all focus-within:border-primary/30 focus-within:shadow-md focus-within:bg-background">
                                                <MarkdownEditor
                                                    value={formData.architecture}
                                                    onChange={(val) => setFormData({ ...formData, architecture: val })}
                                                    className="flex-1 border-0 rounded-none shadow-none bg-transparent"
                                                    minHeight="0"
                                                    placeholder={t('create_project_wizard.step4.architecture_placeholder')}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Loading overlay for architecture document generation */}
                                    {isGeneratingArchDoc && (
                                        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                                            <div className="bg-background border shadow-lg rounded-lg p-8 flex flex-col items-center gap-4 max-w-sm text-center">
                                                <div className="relative">
                                                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin relative z-10" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-lg">{t('create_project_wizard.step4.generating_arch_title')}</h4>
                                                    <p className="text-sm text-muted-foreground mt-2 mb-4">{t('create_project_wizard.step4.generating_arch_desc')}</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleSkipArchAi}
                                                        className="text-xs"
                                                    >
                                                        {t('create_project_wizard.ai.skip_ai')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 5: Team Members */}
                            {step === 5 && (
                                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="mb-4 shrink-0">
                                        <Label className="text-sm font-semibold">
                                            {t('create_project_wizard.step5.team_members_label')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('create_project_wizard.step5.team_members_help')}
                                        </p>
                                    </div>

                                    {/* Selected Members */}
                                    {selectedUsers.length > 0 && (
                                        <div className="mb-4 shrink-0">
                                            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                                                {t('create_project_wizard.step5.selected_count', { count: selectedUsers.length })}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedUsers.map(user => (
                                                    <div
                                                        key={user.id}
                                                        className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 group hover:border-red-300 transition-colors"
                                                    >
                                                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                                            {user.firstName[0]}{user.lastName[0]}
                                                        </div>
                                                        <span className="text-xs font-medium">{user.firstName} {user.lastName}</span>
                                                        <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-lg", getRoleColor(user.role))}>
                                                            {formatRole(user.role)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMember(user.id)}
                                                            className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Search */}
                                    <div className="relative mb-3 shrink-0">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                            placeholder={t('create_project_wizard.step5.member_search_placeholder')}
                                            className="pl-10 h-10 border-2"
                                            autoFocus
                                        />
                                    </div>

                                    {/* User List */}
                                    <div className="flex-1 border rounded-lg overflow-hidden">
                                        <div className="h-full overflow-y-auto">
                                            {filteredUsers.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                                    <Users className="h-8 w-8 mb-2 opacity-30" />
                                                    <p className="text-sm font-medium">{t('create_project_wizard.step5.no_users_found')}</p>
                                                    <p className="text-xs">{t('create_project_wizard.step5.try_different_search')}</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y">
                                                    {filteredUsers.map(user => (
                                                        <button
                                                            key={user.id}
                                                            type="button"
                                                            onClick={() => toggleMember(user.id)}
                                                            className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                                                        >
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                                                                {user.firstName[0]}{user.lastName[0]}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-semibold">{user.firstName} {user.lastName}</div>
                                                                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                                                            </div>
                                                            <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg", getRoleColor(user.role))}>
                                                                {formatRole(user.role)}
                                                            </span>
                                                            <div className="h-8 w-8 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-primary/50 hover:text-primary transition-colors">
                                                                <Plus className="h-4 w-4" />
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 border-t bg-muted/5 shrink-0">
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={step === 1 || isGeneratingQuestions || isGeneratingSuite || isGeneratingArchQuestions || isGeneratingArchDoc}
                                    className="gap-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    {t('create_project_wizard.footer.back')}
                                </Button>

                                <div className="flex items-center gap-3">
                                    <Button data-testid="wizard-cancel-btn" variant="outline" onClick={handleClose}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        data-testid="wizard-next-btn"
                                        onClick={handleNext}
                                        disabled={createMutation.isPending || isGeneratingQuestions || isGeneratingSuite || isGeneratingArchQuestions || isGeneratingArchDoc}
                                        className={cn(
                                            "gap-2 min-w-[140px]",
                                            step === 5 && "bg-primary text-primary-foreground hover:bg-primary/90"
                                        )}
                                    >
                                        {step === 5 ? (
                                            createMutation.isPending ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('create_project_wizard.footer.creating')}</>
                                            ) : (
                                                <><Sparkles className="h-4 w-4" /> {t('create_project_wizard.footer.create_project')}</>
                                            )
                                        ) : (
                                            isGeneratingQuestions ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('create_project_wizard.footer.analyzing')}</>
                                            ) : isGeneratingSuite ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('create_project_wizard.footer.generating_suite')}</>
                                            ) : isGeneratingArchQuestions ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('create_project_wizard.footer.analyzing')}</>
                                            ) : isGeneratingArchDoc ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('create_project_wizard.footer.generating_suite')}</>
                                            ) : (
                                                <>{t('create_project_wizard.footer.next_step')} <ChevronRight className="h-4 w-4" /></>
                                            )
                                        )}
                                    </Button>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
