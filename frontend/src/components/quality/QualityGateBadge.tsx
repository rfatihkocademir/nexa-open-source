import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, XCircle } from 'lucide-react';

export interface QualityGateProps {
    isEligible: boolean;
    readinessScore: number;
    blockers: string[];
    warnings: string[];
    details?: {
        criticalBugs: number;
        coverage: number;
        failedRuns: number;
        openFollowUps: number;
        traceabilityGaps: number;
    };
}

export const QualityGateBadge: React.FC<QualityGateProps> = ({
    isEligible,
    readinessScore,
    blockers,
    warnings,
    details,
}) => {
    return (
        <div className={`p-4 rounded-xl border ${isEligible ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/30'} space-y-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isEligible ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <ShieldAlert className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="font-bold text-sm text-slate-100">
                        {isEligible ? 'CANLIYA ÇIKIŞ KALİTE KAPISI PASSED' : 'CANLIYA ÇIKIŞ KALİTE KAPISI ENGELLENDİ (BLOCKED)'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Kalite Skoru:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${readinessScore >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        %{readinessScore.toFixed(0)}
                    </span>
                </div>
            </div>

            {/* Blockers List */}
            {blockers.length > 0 && (
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Engelleme Sebepleri ({blockers.length}):
                    </div>
                    <ul className="list-disc list-inside text-xs text-rose-300/90 pl-1 space-y-0.5">
                        {blockers.map((b, idx) => (
                            <li key={idx}>{b}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Warnings List */}
            {warnings.length > 0 && (
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Kalite Uyarıları ({warnings.length}):
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-300/90 pl-1 space-y-0.5">
                        {warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Metrics Row */}
            {details && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div className="bg-slate-900/60 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">Kritik Bug</span>
                        <span className={`font-bold ${details.criticalBugs > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {details.criticalBugs}
                        </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">Test Kapsama</span>
                        <span className="font-bold text-indigo-300">
                            %{(details.coverage * 100).toFixed(0)}
                        </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">Hatalı Test</span>
                        <span className={`font-bold ${details.failedRuns > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {details.failedRuns}
                        </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">İzlenebilirlik Açığı</span>
                        <span className={`font-bold ${details.traceabilityGaps > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {details.traceabilityGaps}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
