import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Network, Sparkles, Terminal, FileCode, ArrowRight } from "lucide-react";
import { apiAutomationService } from "@/services/apiAutomation.service";
import { ApiStepBuilderModal } from "./ApiStepBuilderModal";

export function ApiTestingStudio({ projectId }: { projectId?: string }) {
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [isSwaggerModalOpen, setIsSwaggerModalOpen] = useState(false);
  const [swaggerText, setSwaggerText] = useState("");
  const [aiPromptText, setAiPromptText] = useState("");

  const [activeBuilderModal, setActiveBuilderModal] = useState(false);
  const [builderInitialData, setBuilderInitialData] = useState<any>(null);

  const handleParseCurl = async () => {
    if (!curlText.trim()) {
      toast.error("cURL komutu giriniz.");
      return;
    }
    try {
      const parsed = await apiAutomationService.parseCurl(curlText);
      setBuilderInitialData(parsed);
      setIsCurlModalOpen(false);
      setCurlText("");
      setActiveBuilderModal(true);
      toast.success("cURL komutu başarıyla No-Code API adımına dönüştürüldü!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "cURL dönüştürülemedi.");
    }
  };

  const handleImportSwagger = async () => {
    if (!swaggerText.trim()) {
      toast.error("OpenAPI / Swagger JSON metni giriniz.");
      return;
    }
    try {
      const json = JSON.parse(swaggerText);
      if (!projectId) {
        toast.error("Önce bir proje seçiniz.");
        return;
      }
      const res = await apiAutomationService.importSwagger(projectId, json);
      setIsSwaggerModalOpen(false);
      setSwaggerText("");
      toast.success(`OpenAPI Spec Aktarıldı! ${res.totalEndpoints} uç nokta otomasyona çevrildi.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Geçersiz Swagger JSON verisi.");
    }
  };

  const handleGenerateAiApi = async () => {
    if (!aiPromptText.trim()) {
      toast.error("Yapay zeka istemi giriniz.");
      return;
    }
    try {
      const generated = await apiAutomationService.generateAiApi(aiPromptText);
      setBuilderInitialData(generated);
      setAiPromptText("");
      setActiveBuilderModal(true);
      toast.success("AI ile API senaryosu oluşturuldu!");
    } catch {
      toast.error("AI API oluşturma hatası.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border-indigo-500/30 hover:border-indigo-500/60 transition-all cursor-pointer" onClick={() => setIsCurlModalOpen(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-indigo-300">
              <span className="flex items-center gap-2"><Terminal className="h-4 w-4" /> cURL Yapıştır & Çevir</span>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Postman veya geliştirici konsolundan kopyaladığınız cURL komutunu 1-tıkla No-Code adıma dönüştürün.</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-900/40 to-slate-900 border-violet-500/30 hover:border-violet-500/60 transition-all cursor-pointer" onClick={() => setIsSwaggerModalOpen(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-violet-300">
              <span className="flex items-center gap-2"><FileCode className="h-4 w-4" /> OpenAPI / Swagger Aktar</span>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Projenize ait Swagger JSON/YAML dokümanını aktararak tüm uç noktalar için otomasyon paketleri türetin.</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/40 to-slate-900 border-purple-500/30 hover:border-purple-500/60 transition-all cursor-pointer" onClick={() => { setBuilderInitialData(null); setActiveBuilderModal(true); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-purple-300">
              <span className="flex items-center gap-2"><Network className="h-4 w-4" /> Yeni No-Code API İstegi</span>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Sıfırdan özel HTTP isteği, dinamik header ve JSONPath doğrulamaları oluşturun.</p>
          </CardContent>
        </Card>
      </div>

      {/* AI API Generator Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" /> AI İstemcisi ile API Testi Oluştur
          </CardTitle>
          <CardDescription className="text-xs">
            Test etmek istediğiniz API davranışını doğal dille tarif edin (ör: "Stripe ödeme endpoint'ine POST yap, tutar 100 ver, status 200 ve paid: true doğrula").
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={aiPromptText}
              onChange={(e) => setAiPromptText(e.target.value)}
              placeholder="Ör: User login API'sini test et, Bearer token döndüğünü doğrula..."
              className="bg-slate-950 border-slate-800 font-sans text-xs"
            />
            <Button onClick={handleGenerateAiApi} className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 text-xs">
              <Sparkles className="mr-1.5 h-4 w-4" /> Yapay Zeka ile Üret
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* cURL Modal */}
      <Dialog open={isCurlModalOpen} onOpenChange={setIsCurlModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-5 w-5 text-indigo-400" /> cURL Komutunu No-Code Adıma Çevir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 my-2">
            <Textarea
              rows={6}
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              placeholder={'curl -X POST https://api.example.com/v1/auth/login -H \'Content-Type: application/json\' -d \'{"username":"admin"}\''}
              className="font-mono text-xs bg-slate-950 border-slate-800"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCurlModalOpen(false)}>İptal</Button>
            <Button onClick={handleParseCurl} className="bg-indigo-600 hover:bg-indigo-700 text-white">Dönüştür ve Düzenle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swagger Modal */}
      <Dialog open={isSwaggerModalOpen} onOpenChange={setIsSwaggerModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileCode className="h-5 w-5 text-violet-400" /> OpenAPI / Swagger JSON Aktar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 my-2">
            <Textarea
              rows={8}
              value={swaggerText}
              onChange={(e) => setSwaggerText(e.target.value)}
              placeholder='{\n  "openapi": "3.0.0",\n  "info": { "title": "Sample API" },\n  "paths": { ... }\n}'
              className="font-mono text-xs bg-slate-950 border-slate-800"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSwaggerModalOpen(false)}>İptal</Button>
            <Button onClick={handleImportSwagger} className="bg-violet-600 hover:bg-violet-700 text-white">Paket Olarak Aktar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Step Builder Modal */}
      {activeBuilderModal && (
        <ApiStepBuilderModal
          isOpen={activeBuilderModal}
          onClose={() => setActiveBuilderModal(false)}
          projectId={projectId}
          initialData={builderInitialData}
          onSave={() => {
            toast.success("API Adımı Senaryoya Eklendi!");
          }}
        />
      )}
    </div>
  );
}
