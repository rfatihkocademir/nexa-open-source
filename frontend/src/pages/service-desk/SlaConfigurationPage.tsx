import React, { useState, useEffect } from 'react';
import { serviceDeskService } from '../../services/service-desk.service';
import type { SlaPolicy, Priority } from '../../types/service-desk';
import { ShieldAlert, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const SlaConfigurationPage: React.FC = () => {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('HIGH');
  const [firstResponseTargetMinutes, setFirstResponseTargetMinutes] = useState(30);
  const [resolutionTargetMinutes, setResolutionTargetMinutes] = useState(240);
  const [isBusinessHoursOnly, setIsBusinessHoursOnly] = useState(true);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await serviceDeskService.getSlaPolicies();
      setPolicies(data);
    } catch (err) {
      setPolicies([]);
      toast.error('SLA politikaları yüklenemedi', { description: err instanceof Error ? err.message : 'Lütfen yeniden deneyin.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await serviceDeskService.createSlaPolicy({
        name,
        description,
        priority,
        firstResponseTargetMinutes,
        resolutionTargetMinutes,
        isBusinessHoursOnly,
      });

      setShowModal(false);
      setName('');
      setDescription('');
      fetchPolicies();
    } catch (err: unknown) {
      toast.error('Politika oluşturulamadı', { description: err instanceof Error ? err.message : 'Lütfen yeniden deneyin.' });
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            SLA Yönetimi ve Politikaları (Service Level Agreements)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Biletlerin öncelik seviyelerine göre hedeflenen ilk yanıt ve çözüm sürelerini tanımlayın.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Yeni SLA Politikası Ekle
        </button>
      </div>

      {/* SLA Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-500 text-sm">Politikalar yükleniyor...</div>
        ) : policies.length === 0 ? (
          <div className="col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">Henüz Özel SLA Politikası Tanımlanmadı</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Sistem varsayılan olarak İlk Yanıt için 60 dk, Çözüm için 480 dk varsayılan süreleri kullanmaktadır.
            </p>
          </div>
        ) : (
          policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-100">{policy.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{policy.description || 'Açıklama yok'}</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  {policy.priority} ÖNCELİK
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">Hedef İlk Yanıt Süresi</span>
                  <span className="text-lg font-bold font-mono text-indigo-300">
                    {policy.firstResponseTargetMinutes} dk
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    ({(policy.firstResponseTargetMinutes / 60).toFixed(1)} saat)
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">Hedef Çözüm Süresi</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {policy.resolutionTargetMinutes} dk
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    ({(policy.resolutionTargetMinutes / 60).toFixed(1)} saat)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                <span>Mesai Saatleri Dikkate Alınsın Mı?</span>
                <span className={`font-semibold ${policy.isBusinessHoursOnly ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {policy.isBusinessHoursOnly ? 'Evet (9:00 - 18:00)' : 'Hayır (7/24)'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
            <h3 className="text-lg font-bold text-slate-100">Yeni SLA Politikası Tanımla</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="sla-policy-name" className="text-xs font-medium text-slate-300 block mb-1">Politika Adı *</label>
                <input
                  id="sla-policy-name"
                  type="text"
                  required
                  placeholder="Örn: Kritik Müşteri SLA Politikası"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sla-priority" className="text-xs font-medium text-slate-300 block mb-1">Uygulanacak Öncelik</label>
                  <select
                    id="sla-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                  >
                    <option value="CRITICAL">KRİTİK</option>
                    <option value="HIGH">YÜKSEK</option>
                    <option value="MEDIUM">ORTA</option>
                    <option value="LOW">DÜŞÜK</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sla-mode" className="text-xs font-medium text-slate-300 block mb-1">Hesaplama Modu</label>
                  <select
                    id="sla-mode"
                    value={isBusinessHoursOnly ? 'BUSINESS' : 'CALENDAR'}
                    onChange={(e) => setIsBusinessHoursOnly(e.target.value === 'BUSINESS')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                  >
                    <option value="BUSINESS">Mesai Saatleri (Pzt-Cuma)</option>
                    <option value="CALENDAR">7/24 Kesintisiz Takvim</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sla-first-response" className="text-xs font-medium text-slate-300 block mb-1">İlk Yanıt Hedefi (Dakika)</label>
                  <input
                    id="sla-first-response"
                    type="number"
                    min={5}
                    value={firstResponseTargetMinutes}
                    onChange={(e) => setFirstResponseTargetMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                  />
                </div>

                <div>
                  <label htmlFor="sla-resolution" className="text-xs font-medium text-slate-300 block mb-1">Çözüm Hedefi (Dakika)</label>
                  <input
                    id="sla-resolution"
                    type="number"
                    min={15}
                    value={resolutionTargetMinutes}
                    onChange={(e) => setResolutionTargetMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
                >
                  Politikayı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
