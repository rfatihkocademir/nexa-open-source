import React, { useState } from 'react';
import { api } from '@/services/api';
import { Upload, Link, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface JiraImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess?: () => void;
}

export const JiraImportModal: React.FC<JiraImportModalProps> = ({
    isOpen,
    onClose,
    projectId,
    onSuccess,
}) => {
    const [mode, setMode] = useState<'api' | 'json'>('api');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Form fields for API import
    const [hostUrl, setHostUrl] = useState('');
    const [email, setEmail] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [jiraProjectKey, setJiraProjectKey] = useState('');

    // JSON payload state
    const [jsonFile, setJsonFile] = useState<File | null>(null);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setJsonFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        setResult(null);

        try {
            if (mode === 'api') {
                if (!hostUrl || !email || !apiToken || !jiraProjectKey) {
                    toast.error('Lütfen tüm Jira API alanlarını doldurun.');
                    setLoading(false);
                    return;
                }

                const res: any = await api.post('/jira-migration/import-api', {
                    projectId,
                    hostUrl,
                    email,
                    apiToken,
                    jiraProjectKey,
                });

                const data = res?.data || res;
                setResult(data);
                toast.success('Jira aktarımı başarıyla tamamlandı!');
                if (onSuccess) onSuccess();
            } else {
                if (!jsonFile) {
                    toast.error('Lütfen bir Jira JSON dosyası seçin.');
                    setLoading(false);
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const content = event.target?.result as string;
                        const parsed = JSON.parse(content);
                        const issues = Array.isArray(parsed) ? parsed : (parsed.issues || []);

                        const res: any = await api.post('/jira-migration/import-json', {
                            projectId,
                            issues,
                        });

                        const data = res?.data || res;
                        setResult(data);
                        toast.success('Jira JSON aktarımı başarıyla tamamlandı!');
                        if (onSuccess) onSuccess();
                    } catch (err: any) {
                        toast.error('Geçersiz JSON dosyası: ' + err.message);
                    } finally {
                        setLoading(false);
                    }
                };
                reader.readAsText(jsonFile);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Jira aktarımı sırasında bir hata oluştu.');
        } finally {
            if (mode === 'api') setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Jira Hızlı Aktarım Sihirbazı</h3>
                            <p className="text-xs text-slate-400">Jira Epics, Stories, Bugs ve Görevlerinizi Nexa'ya tek tıkla aktarın.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
                    <button
                        onClick={() => setMode('api')}
                        className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 rounded-lg ${
                            mode === 'api'
                                ? 'bg-slate-800 text-blue-400 border border-slate-700'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Link className="w-4 h-4" />
                        Jira Cloud / Server API
                    </button>
                    <button
                        onClick={() => setMode('json')}
                        className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 rounded-lg ${
                            mode === 'json'
                                ? 'bg-slate-800 text-blue-400 border border-slate-700'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Upload className="w-4 h-4" />
                        Jira JSON Yükle
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {mode === 'api' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Jira Sunucu URL'i</label>
                                <input
                                    type="text"
                                    placeholder="https://kurumunuz.atlassian.net"
                                    value={hostUrl}
                                    onChange={(e) => setHostUrl(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Jira E-Posta</label>
                                    <input
                                        type="email"
                                        placeholder="kullanici@kurum.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">API Token / Şifre</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••••••••••"
                                        value={apiToken}
                                        onChange={(e) => setApiToken(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Jira Proje Anahtarı (Key)</label>
                                <input
                                    type="text"
                                    placeholder="Örn: PROJ veya PROJ-1"
                                    value={jiraProjectKey}
                                    onChange={(e) => setJiraProjectKey(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-8 text-center transition-all bg-slate-950/50">
                                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                <p className="text-sm font-medium text-slate-200">Jira Export JSON Dosyasını Seçin</p>
                                <p className="text-xs text-slate-500 mt-1">Jira'dan dışa aktardığınız `.json` formatındaki iş öğeleri dosyasını yükleyin.</p>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="jira-json-input"
                                />
                                <label
                                    htmlFor="jira-json-input"
                                    className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                                >
                                    Dosya Seç
                                </label>
                                {jsonFile && (
                                    <p className="text-xs text-emerald-400 font-medium mt-3">Seçilen Dosya: {jsonFile.name}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Result Summary View */}
                    {result && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2 text-xs">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Aktarım Başarıyla Tamamlandı
                            </div>
                            <div className="grid grid-cols-4 gap-2 pt-1 text-slate-300">
                                <div>Toplam: <span className="font-bold text-white">{result.totalParsed}</span></div>
                                <div>Epics: <span className="font-bold text-white">{result.epicsImported}</span></div>
                                <div>Stories: <span className="font-bold text-white">{result.storiesImported}</span></div>
                                <div>Bugs: <span className="font-bold text-white">{result.bugsImported}</span></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                    >
                        Kapat
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Aktarılıyor...' : 'Aktarımı Başlat'}
                    </button>
                </div>
            </div>
        </div>
    );
};
