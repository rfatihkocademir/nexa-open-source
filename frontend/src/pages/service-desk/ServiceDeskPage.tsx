import React, { useState, useEffect, useCallback } from 'react';
import { serviceDeskService } from '../../services/service-desk.service';
import type { ServiceTicket, TicketStatus, Priority } from '../../types/service-desk';
import {
  LifeBuoy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Pause,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
interface ServiceDeskAnalytics {
  slaComplianceRate: number;
  csatScore: number;
  breachedCount: number;
}

export const ServiceDeskPage: React.FC = () => {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [analytics, setAnalytics] = useState<ServiceDeskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [converting, setConverting] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const [data, stats] = await Promise.all([
        serviceDeskService.getTickets({
          status: statusFilter !== 'ALL' ? (statusFilter as TicketStatus) : undefined,
          search: search || undefined,
        }),
        serviceDeskService.getAnalytics(),
      ]);
      setTickets(data);
      setAnalytics(stats);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    } catch (err) {
      setTickets([]);
      toast.error('Biletler yüklenemedi', { description: errorMessage(err, 'Lütfen yeniden deneyin.') });
    } finally {
      setLoading(false);
    }
  }, [search, selectedTicket, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSelectTicket = async (ticket: ServiceTicket) => {
    try {
      const fullTicket = await serviceDeskService.getTicket(ticket.id);
      setSelectedTicket(fullTicket);
    } catch (_err) {
      setSelectedTicket(ticket);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;
    try {
      const updated = await serviceDeskService.updateTicket(selectedTicket.id, { status: newStatus });
      setSelectedTicket(updated);
      fetchTickets();
    } catch (err) {
      toast.error('Durum güncellenemedi', { description: errorMessage(err, 'Lütfen yeniden deneyin.') });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;
    try {
      await serviceDeskService.addComment(selectedTicket.id, newComment, isInternalComment);
      setNewComment('');
      handleSelectTicket(selectedTicket);
    } catch (err) {
      toast.error('Yorum eklenemedi', { description: errorMessage(err, 'Lütfen yeniden deneyin.') });
    }
  };

  const handleConvertToWorkItem = async () => {
    if (!selectedTicket) return;
    try {
      setConverting(true);
      const workItem = await serviceDeskService.convertToWorkItem(selectedTicket.id, 'BUG');
      toast.success('Bilet iş öğesine dönüştürüldü', { description: `${workItem.key} oluşturuldu.` });
      handleSelectTicket(selectedTicket);
      fetchTickets();
    } catch (err: unknown) {
      toast.error('Dönüştürme başarısız', { description: errorMessage(err, 'Lütfen yeniden deneyin.') });
    } finally {
      setConverting(false);
    }
  };

  const getSlaBadge = (ticket: ServiceTicket) => {
    const sla = ticket.slaTracker;
    if (!sla) return null;

    if (sla.status === 'BREACHED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
          <AlertTriangle className="w-3.5 h-3.5" /> SLA İhlali
        </span>
      );
    }
    if (sla.status === 'NEEDS_ATTENTION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" /> Riskli (&lt;1 saat)
        </span>
      );
    }
    if (sla.status === 'PAUSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Pause className="w-3.5 h-3.5" /> Duraklatıldı
        </span>
      );
    }
    if (sla.status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> SLA Tamamlandı
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Clock className="w-3.5 h-3.5" /> Zamanında
      </span>
    );
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white rounded">KRİTİK</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-400 rounded">YÜKSEK</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded">ORTA</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold bg-slate-700 text-slate-300 rounded">DÜŞÜK</span>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-950 text-slate-100 overflow-hidden lg:flex-row">
      {/* Sidebar / Ticket List */}
      <div className={`${selectedTicket ? 'hidden lg:flex' : 'flex'} w-full border-r border-slate-800 flex-col bg-slate-900/50 lg:w-1/3`}>
        {/* Header & Filter */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-indigo-400" />
              <h1 className="font-bold text-lg text-slate-100">Service Desk</h1>
            </div>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-semibold">
              {tickets.length} Bilet
            </span>
          </div>

          {/* Quick Metrics Bar */}
          {analytics && (
            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-medium">SLA Uyum</span>
                <span className="font-mono text-sm font-bold text-emerald-400">%{analytics.slaComplianceRate}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-medium">CSAT Puanı</span>
                <span className="font-mono text-sm font-bold text-amber-400">★ {analytics.csatScore}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-medium">SLA İhlali</span>
                <span className={`font-mono text-sm font-bold ${analytics.breachedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {analytics.breachedCount}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              aria-label="Biletlerde ara"
              type="text"
              placeholder="Bilet başlığı, key veya e-posta ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-500"
            />
            <select
              aria-label="Bilet durumuna göre filtrele"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="OPEN">Açık (Open)</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="WAITING_FOR_CUSTOMER">Müşteri Bekleniyor</option>
              <option value="RESOLVED">Çözüldü</option>
            </select>
          </div>
        </div>

        {/* Ticket List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Biletler yükleniyor...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Kriterlere uygun bilet bulunamadı.</div>
          ) : (
            tickets.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') void handleSelectTicket(ticket); }}
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-indigo-400">{ticket.key}</span>
                    {getSlaBadge(ticket)}
                  </div>

                  <h3 className="font-medium text-sm text-slate-200 line-clamp-1 mb-2">{ticket.title}</h3>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(ticket.priority)}
                      <span className="text-slate-500">{ticket.category}</span>
                    </div>
                    <span>{new Date(ticket.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Ticket Detail View */}
      <div className={`${selectedTicket ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col bg-slate-950`}>
        {selectedTicket ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Action Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
              <div className="flex items-center gap-3">
                <button type="button" className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs lg:hidden" onClick={() => setSelectedTicket(null)}>Biletlere dön</button>
                <span className="font-mono text-sm font-bold text-indigo-400">{selectedTicket.key}</span>
                <div className="h-4 w-px bg-slate-800" />
                <select
                  data-testid="service-desk-status-select"
                  aria-label="Bilet durumu"
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="OPEN">AÇIK (OPEN)</option>
                  <option value="IN_PROGRESS">DEVAM EDİYOR</option>
                  <option value="WAITING_FOR_CUSTOMER">MÜŞTERİ BEKLENİYOR (SLA PAUSED)</option>
                  <option value="RESOLVED">ÇÖZÜLDÜ</option>
                  <option value="CLOSED">KAPATILDI</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {selectedTicket.linkedWorkItem ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Bağlı İş Ödevi: {selectedTicket.linkedWorkItem.key}
                  </div>
                ) : (
                  <button
                    data-testid="service-desk-convert-btn"
                    onClick={handleConvertToWorkItem}
                    disabled={converting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Bug/İş Ödevine Dönüştür
                  </button>
                )}
              </div>
            </div>

            {/* Ticket Body & Comments */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Details */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100 mb-1">{selectedTicket.title}</h2>
                    <p className="text-xs text-slate-400">
                      Talep Eden: <span className="text-indigo-300 font-medium">{selectedTicket.requesterEmail}</span> (
                      {selectedTicket.requesterName || 'İsimsiz'})
                    </p>
                  </div>
                  {getSlaBadge(selectedTicket)}
                </div>

                <div className="text-sm text-slate-300 bg-slate-950/50 p-4 rounded-lg border border-slate-800 whitespace-pre-wrap">
                  {selectedTicket.description || 'Açıklama belirtilmedi.'}
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <div>
                    <span className="block text-slate-500">Öncelik</span>
                    <span className="font-semibold text-slate-200">{selectedTicket.priority}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Kategori</span>
                    <span className="font-semibold text-slate-200">{selectedTicket.category}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Atanan Temsilci</span>
                    <span className="font-semibold text-indigo-300">
                      {selectedTicket.assignee
                        ? `${selectedTicket.assignee.firstName} ${selectedTicket.assignee.lastName}`
                        : 'Atanmadı'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SLA Target Breakdown */}
              {selectedTicket.slaTracker && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" /> SLA Hedef Süreleri & Metrikleri
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block mb-1">İlk Yanıt Hedefi</span>
                      <span className="font-mono text-slate-200">
                        {selectedTicket.slaTracker.firstResponseDue
                          ? new Date(selectedTicket.slaTracker.firstResponseDue).toLocaleString('tr-TR')
                          : '-'}
                      </span>
                      {selectedTicket.slaTracker.firstResponseCompletedAt && (
                        <span className="block text-emerald-400 text-[10px] mt-1">
                          ✓ Tamamlandı ({new Date(selectedTicket.slaTracker.firstResponseCompletedAt).toLocaleTimeString('tr-TR')})
                        </span>
                      )}
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block mb-1">Çözüm Hedefi</span>
                      <span className="font-mono text-slate-200">
                        {selectedTicket.slaTracker.resolutionDue
                          ? new Date(selectedTicket.slaTracker.resolutionDue).toLocaleString('tr-TR')
                          : '-'}
                      </span>
                      {selectedTicket.slaTracker.totalPausedMinutes > 0 && (
                        <span className="block text-amber-400 text-[10px] mt-1">
                          (Toplam {selectedTicket.slaTracker.totalPausedMinutes} dk donduruldu)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comments Timeline */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" /> İletişim Geçmişi & Yorumlar
                </h3>

                <div className="space-y-3">
                  {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                    selectedTicket.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-xl border text-sm ${
                          comment.isInternal
                            ? 'bg-amber-950/20 border-amber-800/40 text-amber-100'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                          <span className="font-medium text-slate-300">
                            {comment.author
                              ? `${comment.author.firstName} ${comment.author.lastName}`
                              : 'Müşteri / Sistem'}
                            {comment.isInternal && (
                              <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-semibold text-[10px]">
                                ÖZEL İÇ NOT
                              </span>
                            )}
                          </span>
                          <span>{new Date(comment.createdAt).toLocaleString('tr-TR')}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">Henüz yorum eklenmemiş.</div>
                  )}
                </div>

                {/* New Comment Input */}
                <form onSubmit={handleAddComment} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <textarea
                    data-testid="service-desk-comment-input"
                    aria-label="Yeni yorum"
                    rows={3}
                    placeholder="Yanıtınızı veya dahili notunuzu yazın..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-500"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
                      <input
                        data-testid="service-desk-internal-checkbox"
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                      />
                      Dahili Not (Müşteriye görünmez, sadece temsilciler görür)
                    </label>

                    <button
                      data-testid="service-desk-submit-comment-btn"
                      type="submit"
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Yanıt Gönder
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Detaylarını görüntülemek için soldan bir bilet seçin.
          </div>
        )}
      </div>
    </div>
  );
};
