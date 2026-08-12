import React, { useState } from 'react';
import { automationService } from '@/services/automation.service';
import { Zap, CheckCircle2, Bot, Sparkles, Loader2, X } from 'lucide-react';

interface ManualToAutomationModalProps {
  testCaseId: string;
  testCaseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManualToAutomationModal: React.FC<ManualToAutomationModalProps> = ({
  testCaseId,
  testCaseTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [convertedData, setConvertedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConvert = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await automationService.convertManualToAutomation(testCaseId);
      setConvertedData(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Dönüştürme sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Manuel &gt; Otomasyon AI Dönüştürücü
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                  Kodsuz (No-Code)
                </span>
              </h2>
              <p className="text-xs text-slate-400">Test: {testCaseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!convertedData ? (
            <div className="text-center py-8 space-y-5">
              <div className="inline-flex p-4 bg-indigo-600/10 rounded-2xl text-indigo-400 border border-indigo-500/20 mb-2">
                <Bot className="w-12 h-12 animate-pulse" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-semibold text-slate-200">
                  Manuel adımları saniyeler içinde No-Code Otomasyona dönüştürün
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Yapay zeka, manuel test adımlarınızı ve doğrulama kriterlerinizi analiz eder, Playwright uyumlu element seçicileri (Locators) ve aksiyonları otomatik oluşturur.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 max-w-md mx-auto">
                  {error}
                </div>
              )}

              <button
                onClick={handleConvert}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Yapay Zeka Adımları Analiz Ediyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> ⚡ 1-Tıkla Otomasyona Aktar
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Başarıyla Dönüştürüldü! Toplam {convertedData.stepCount} No-Code adım oluşturuldu.
                </div>
              </div>

              {convertedData.hasWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    ⚠️ Eksik Seçici (Locator) Uyarısı
                  </div>
                  <p className="text-[11px] text-amber-300/80">
                    Bazı adımlar için otomatik seçici eşleştirilemedi. Senaryonun sorunsuz çalışması için eksik adımların locator&apos;larını manuel kaydedin veya HTML Sihirli Öneri ile seçicileri ekleyin.
                  </p>
                </div>
              )}

              {/* Steps List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {convertedData.steps.map((s: any, idx: number) => {
                  const hasMissingLocator = !s.testStep?.locator && s.testStep?.actionType !== 'WAIT' && s.testStep?.actionType !== 'NAVIGATE';
                  return (
                    <div
                      key={s.id}
                      className={`p-3 bg-slate-950 border ${hasMissingLocator ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'} rounded-xl flex items-center justify-between text-xs`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400 flex items-center justify-center font-mono font-bold text-[11px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-200 block mb-0.5">
                            {s.testStep?.name || s.testStep?.action}
                          </span>
                          <span className={`font-mono text-[10px] block ${hasMissingLocator ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                            Locator: {s.testStep?.locator || '⚠️ Seçici Eksik (Düzenleyin)'}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-md bg-slate-800 text-indigo-300 font-mono text-[10px] font-bold border border-slate-700">
                        {s.testStep?.actionType}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
