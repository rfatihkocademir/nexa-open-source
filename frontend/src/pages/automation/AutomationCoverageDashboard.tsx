import React, { useState, useEffect, useCallback } from 'react';
import { automationService, type AutomationCoverageMetrics } from '@/services/automation.service';
import { ManualToAutomationModal } from '@/components/automation/ManualToAutomationModal';
import { ApiTestingStudio } from './components/ApiTestingStudio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Clock,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Cpu,
  Network,
} from 'lucide-react';

interface AutomationCoverageDashboardProps {
  projectId: string;
}

export const AutomationCoverageDashboard: React.FC<AutomationCoverageDashboardProps> = ({ projectId }) => {
  const [metrics, setMetrics] = useState<AutomationCoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTestCase, setSelectedTestCase] = useState<{ id: string; title: string } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await automationService.getCoverageMetrics(projectId);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load coverage metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchMetrics();
  }, [fetchMetrics, projectId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm animate-pulse">
        Otomasyon metrikleri ve bulut grid bilgisi yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-100">Otomasyon Paneli, Bulut Grid & API Studio</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Kod yazmadan manuel testleri otomasyona dönüştürün, Web Cross-Browser Grid ve Postman-Class API Entegrasyon Stüdyosunu kullanın.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl">
            <ShieldCheck className="w-4 h-4" /> Kendi Kendini Onaran AI Selektörler & API Runner Aktif
          </span>
        </div>
      </div>

      <Tabs defaultValue="web-grid" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-900 border border-slate-800">
          <TabsTrigger value="web-grid" className="flex items-center gap-2 text-xs font-bold">
            <Globe className="h-4 w-4 text-indigo-400" /> Web & Bulut Grid (BrowserStack)
          </TabsTrigger>
          <TabsTrigger value="api-studio" className="flex items-center gap-2 text-xs font-bold">
            <Network className="h-4 w-4 text-purple-400" /> API & Entegrasyon Studio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web-grid" className="space-y-6 mt-0">
          {/* Primary KPI Cards */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Coverage Ratio Card */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Otomasyon Kapsam Oranı</span>
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">%{metrics.coveragePercentage}</span>
                  <span className="text-xs text-slate-400">
                    ({metrics.automatedTestCases} / {metrics.totalTestCases} Otomatik)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.coveragePercentage}%` }}
                  />
                </div>
              </div>

              {/* Time Saved Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Kazanılan Mühendislik Süresi</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-400">{metrics.hoursSaved} Saat</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">Kodsuz otomasyon koşumları sayesinde tasarruf edildi</p>
              </div>

              {/* Pass Rate Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Koşum Başarı Oranı</span>
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-blue-400">%{metrics.passRate}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">Toplam {metrics.totalExecutions} otomasyon koşumunda</p>
              </div>

              {/* Manual Cases Pending Converter Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Bekleyen Manuel Testler</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-400">{metrics.manualTestCases}</span>
                  <span className="text-xs text-slate-400">Test</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">1-Tık AI dönüştürücü ile otomasyona aktarılabilir</p>
              </div>
            </div>
          )}

          {/* Cloud Grid Browser Matrix & Device Profiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cross-Browser Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" /> Bulut Tarayıcı Grid Matrisi (Cross-Browser)
                </h3>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  3/3 Node Aktif
                </span>
              </div>

              <div className="space-y-3">
                {metrics?.gridBrowsers.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-200 block">{b.name}</span>
                        <span className="text-[10px] text-slate-500">Playwright Web First Engine</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono font-bold text-emerald-400">%{b.passRate} Başarı</span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-semibold">
                        HAZIR
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Viewport Profiles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-400" /> Cihaz & Çözünürlük Simülasyonları
                </h3>
                <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                  Multi-Viewport
                </span>
              </div>

              <div className="space-y-3">
                {metrics?.deviceProfiles.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 text-slate-300 rounded-lg">
                        {d.type === 'MOBILE' ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-200 block">{d.name}</span>
                        <span className="text-[10px] text-slate-500">Otomatik Video & Trace Kaydı</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-semibold">
                      DESTEKLENİYOR
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api-studio" className="mt-0">
          <ApiTestingStudio projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Modal Converter */}
      {selectedTestCase && (
        <ManualToAutomationModal
          testCaseId={selectedTestCase.id}
          testCaseTitle={selectedTestCase.title}
          isOpen={!!selectedTestCase}
          onClose={() => setSelectedTestCase(null)}
          onSuccess={fetchMetrics}
        />
      )}
    </div>
  );
};
