import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { serviceDeskService } from '../../services/service-desk.service';
import { projectService } from '../../services/project.service';
import type { Project } from '../../types/project';
import type { TicketCategory, Priority } from '../../types/service-desk';
import { LifeBuoy, Send, CheckCircle2, HelpCircle, Bug, Wrench, CreditCard, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const CustomerPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId') || '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('TECHNICAL_SUPPORT');
  const [priority] = useState<Priority>('MEDIUM');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    projectService.getAll(1, 100, 'name', 'asc').then((result) => {
      if (!active) return;
      setProjects(result.data);
      if (!requestedProjectId && result.data[0]) setProjectId(result.data[0].id);
    }).catch(() => {
      if (active) toast.error('Projeler yüklenemedi', { description: 'Ticket oluşturmak için proje erişiminizi kontrol edin.' });
    });
    return () => { active = false; };
  }, [requestedProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !title || !requesterEmail) {
      toast.error('Zorunlu alanlar eksik', { description: 'E-posta ve konu alanlarını doldurun.' });
      return;
    }

    try {
      setSubmitting(true);
      const ticket = await serviceDeskService.createTicket({
        projectId,
        title,
        description,
        category,
        priority,
        requesterEmail,
        requesterName,
      });

      setSubmittedKey(ticket.key);
    } catch (err: unknown) {
      toast.error('Bilet oluşturulamadı', { description: err instanceof Error ? err.message : 'Lütfen yeniden deneyin.' });
    } finally {
      setSubmitting(false);
    }
  };

  const categories: { type: TicketCategory; label: string; icon: any; desc: string }[] = [
    { type: 'TECHNICAL_SUPPORT', label: 'Teknik Destek', icon: Wrench, desc: 'Sistem veya uygulama sorunları hakkında yardım alın' },
    { type: 'BUG_REPORT', label: 'Hata Bildirimi (Bug)', icon: Bug, desc: 'Karşılaştığınız bir hatayı geliştirme ekibine iletin' },
    { type: 'FEATURE_REQUEST', label: 'Yeni Özellik Talebi', icon: HelpCircle, desc: 'Platforma eklenmesini istediğiniz bir özelliği önerin' },
    { type: 'BILLING', label: 'Faturalandırma & Ödeme', icon: CreditCard, desc: 'Abonelik ve fatura sorularınız için başvuruda bulunun' },
    { type: 'ACCESS_REQUEST', label: 'Erişim ve Yetki Talebi', icon: Lock, desc: 'Proje veya sistem yetkisi talepleri' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 mb-2">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Nexa Müşteri Destek Portalı</h1>
          <p className="text-sm text-slate-400">
            Karşılaştığınız sorunları veya taleplerinizi bize bildirin. Temsilcilerimiz SLA süresi içinde size yanıt verecektir.
          </p>
        </div>

        {submittedKey ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-semibold text-emerald-300">Talebiniz Alındı!</h3>
            <p className="text-sm text-slate-300">
              Bilet Numaranız: <span className="font-mono font-bold text-emerald-400 text-base">{submittedKey}</span>
            </p>
            <p className="text-xs text-slate-400">
              Talebinizin durumunu ve verilen yanıtları <span className="text-slate-200 font-medium">{requesterEmail}</span> e-posta adresiniz üzerinden takip edebilirsiniz.
            </p>
            <button
              onClick={() => {
                setSubmittedKey(null);
                setTitle('');
                setDescription('');
              }}
              className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors"
            >
              Yeni Talep Oluştur
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label htmlFor="portal-project" className="text-xs font-medium text-slate-300">Proje *</label>
              <select
                data-testid="customer-portal-project-select"
                id="portal-project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
              >
                <option value="">Proje seçin</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.key} — {project.name}</option>)}
              </select>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Talep Kategorisi
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.type;
                  return (
                    <button
                      data-testid={`customer-portal-category-${cat.type}`}
                      type="button"
                      aria-pressed={isSelected}
                      key={cat.type}
                      onClick={() => setCategory(cat.type)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-semibold text-xs text-slate-200">{cat.label}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{cat.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="portal-email" className="text-xs font-medium text-slate-300">E-Posta Adresiniz *</label>
                <input
                  data-testid="customer-portal-email-input"
                  id="portal-email"
                  type="email"
                  required
                  placeholder="ornek@sirket.com"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="portal-name" className="text-xs font-medium text-slate-300">Adınız Soyadınız</label>
                <input
                  data-testid="customer-portal-name-input"
                  id="portal-name"
                  type="text"
                  placeholder="Ahmet Yılmaz"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label htmlFor="portal-title" className="text-xs font-medium text-slate-300">Konu / Başlık *</label>
              <input
                data-testid="customer-portal-title-input"
                id="portal-title"
                type="text"
                required
                placeholder="Talebinizi özetleyen kısa başlık"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label htmlFor="portal-description" className="text-xs font-medium text-slate-300">Detaylı Açıklama</label>
              <textarea
                data-testid="customer-portal-description-input"
                id="portal-description"
                rows={4}
                placeholder="Yaşadığınız sorunu veya talebinizi detaylandırın..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
              />
            </div>

            {/* Submit Button */}
            <button
              data-testid="customer-portal-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Talebi Gönder
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
