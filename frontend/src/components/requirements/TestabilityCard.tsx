import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export interface TestabilityCardProps {
    score: number;
    status: 'EXCELLENT' | 'ADEQUATE' | 'NEEDS_IMPROVEMENT' | 'POOR';
    hasAcceptanceCriteria: boolean;
    givenWhenThenFormat: boolean;
    edgeCasesDefined: boolean;
    missingElements: string[];
    recommendations: string[];
}

export const TestabilityCard: React.FC<TestabilityCardProps> = ({
    score,
    status,
    hasAcceptanceCriteria,
    givenWhenThenFormat,
    edgeCasesDefined,
    missingElements,
    recommendations,
}) => {
    const getStatusColor = () => {
        if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
        if (score >= 70) return 'text-indigo-400 border-indigo-500/30 bg-indigo-950/20';
        if (score >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
        return 'text-rose-400 border-rose-500/30 bg-rose-950/20';
    };

    return (
        <div className={`p-4 rounded-xl border ${getStatusColor()} space-y-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-sm text-slate-100">Gereksinim Test Edilebilirlik Analizi</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Testability Index:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-slate-700 text-slate-200">
                        %{score} ({status})
                    </span>
                </div>
            </div>

            {/* Formats Checklist */}
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${hasAcceptanceCriteria ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                    {hasAcceptanceCriteria ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                    <span>Kabul Kriteri</span>
                </div>
                <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${givenWhenThenFormat ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                    {givenWhenThenFormat ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                    <span>Given-When-Then</span>
                </div>
                <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${edgeCasesDefined ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                    {edgeCasesDefined ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                    <span>Sınır Hataları</span>
                </div>
            </div>

            {/* Missing Elements & Recommendations */}
            {missingElements.length > 0 && (
                <div className="space-y-1 text-xs">
                    <span className="font-semibold text-slate-300 block">AI İyileştirme Önerileri:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                        {recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
