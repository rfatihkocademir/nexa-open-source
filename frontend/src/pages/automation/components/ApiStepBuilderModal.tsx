import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Plus, Trash2, CheckCircle2, XCircle, Network, Clock } from "lucide-react";
import { apiAutomationService } from "@/services/apiAutomation.service";
import type { ApiExecutionResultData } from "@/services/apiAutomation.service";

interface ApiStepBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onSave?: (apiStepData: any) => void;
  initialData?: any;
}

export function ApiStepBuilderModal({ isOpen, onClose, projectId, onSave, initialData }: ApiStepBuilderModalProps) {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>(initialData?.method || 'GET');
  const [url, setUrl] = useState(initialData?.url || '{{baseUrl}}/api/v1/resource');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    initialData?.headers
      ? Object.entries(initialData.headers).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: 'Content-Type', value: 'application/json' }]
  );
  const [bodyJson, setBodyJson] = useState(
    initialData?.body ? JSON.stringify(initialData.body, null, 2) : '{\n  "name": "Nexa Test"\n}'
  );
  const [assertions, setAssertions] = useState<
    Array<{ type: string; target?: string; operator: string; expectedValue: any }>
  >(
    initialData?.assertions || [
      { type: 'STATUS_CODE', expectedValue: 200, operator: 'EQUALS' },
      { type: 'RESPONSE_TIME', expectedValue: 1000, operator: 'LESS_THAN' },
    ]
  );

  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ApiExecutionResultData | null>(null);

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleAddAssertion = () => {
    setAssertions([...assertions, { type: 'JSON_PATH', target: '$.success', operator: 'EQUALS', expectedValue: 'true' }]);
  };

  const handleRemoveAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const handleLiveTest = async () => {
    if (!projectId) {
      toast.error('Önce bir proje seçiniz.');
      return;
    }
    setIsRunning(true);
    setExecutionResult(null);
    try {
      const headerObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim()) headerObj[h.key.trim()] = h.value;
      });

      let parsedBody: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyJson.trim()) {
        try {
          parsedBody = JSON.parse(bodyJson);
        } catch {
          parsedBody = bodyJson;
        }
      }

      const res = await apiAutomationService.executeStep({
        projectId,
        url,
        method,
        headers: headerObj,
        body: parsedBody,
        assertions: assertions as any,
      });

      setExecutionResult(res);
      if (res.success) {
        toast.success(`API İsteği Başarılı (${res.statusCode} ${res.statusText} - ${res.responseTimeMs}ms)`);
      } else {
        toast.error(`API Doğrulamaları Başarısız (${res.statusCode})`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'API İsteği Çalıştırılamadı.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = () => {
    const headerObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) headerObj[h.key.trim()] = h.value;
    });

    let parsedBody: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyJson.trim()) {
      try {
        parsedBody = JSON.parse(bodyJson);
      } catch {
        parsedBody = bodyJson;
      }
    }

    const payload = {
      actionType: 'API_REQUEST',
      url,
      method,
      headers: headerObj,
      body: parsedBody,
      assertions,
    };

    if (onSave) onSave(payload);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Network className="h-5 w-5 text-indigo-500" /> No-Code API İstek & Assertion Düzenleyici
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Method & URL Row */}
          <div className="flex gap-2">
            <Select value={method} onValueChange={(val: any) => setMethod(val)}>
              <SelectTrigger className="w-32 font-bold">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET" className="font-bold text-emerald-600">GET</SelectItem>
                <SelectItem value="POST" className="font-bold text-blue-600">POST</SelectItem>
                <SelectItem value="PUT" className="font-bold text-amber-600">PUT</SelectItem>
                <SelectItem value="DELETE" className="font-bold text-rose-600">DELETE</SelectItem>
                <SelectItem value="PATCH" className="font-bold text-purple-600">PATCH</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.nexa.io/v1/resource veya {{baseUrl}}/users"
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleLiveTest} disabled={isRunning} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Play className="mr-1.5 h-4 w-4" /> {isRunning ? "Çalışıyor..." : "Canlı Test Et"}
            </Button>
          </div>

          <Tabs defaultValue="headers" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="headers">Headers ({headers.length})</TabsTrigger>
              <TabsTrigger value="body" disabled={['GET', 'DELETE'].includes(method)}>JSON Body</TabsTrigger>
              <TabsTrigger value="assertions">Assertions ({assertions.length})</TabsTrigger>
            </TabsList>

            {/* Headers Tab */}
            <TabsContent value="headers" className="space-y-2 mt-3">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Header Key (ör: Authorization)"
                    value={h.key}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i].key = e.target.value;
                      setHeaders(next);
                    }}
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Header Value (ör: Bearer {{token}})"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i].value = e.target.value;
                      setHeaders(next);
                    }}
                    className="font-mono text-xs"
                  />
                  <Button variant="ghost" size="icon" aria-label={`Header ${i + 1} sil`} title={`Header ${i + 1} sil`} onClick={() => handleRemoveHeader(i)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddHeader} className="text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Header Ekle
              </Button>
            </TabsContent>

            {/* Body Tab */}
            <TabsContent value="body" className="mt-3">
              <textarea
                value={bodyJson}
                onChange={(e) => setBodyJson(e.target.value)}
                rows={7}
                className="w-full font-mono text-xs p-3 bg-slate-950 text-slate-100 rounded-md border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder='{\n  "key": "value"\n}'
              />
            </TabsContent>

            {/* Assertions Tab */}
            <TabsContent value="assertions" className="space-y-2 mt-3">
              {assertions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select
                    value={a.type}
                    onValueChange={(val) => {
                      const next = [...assertions];
                      next[i].type = val;
                      setAssertions(next);
                    }}
                  >
                    <SelectTrigger className="w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STATUS_CODE">Status Code</SelectItem>
                      <SelectItem value="RESPONSE_TIME">Response Time (ms)</SelectItem>
                      <SelectItem value="JSON_PATH">JSON Path</SelectItem>
                      <SelectItem value="HEADER">Header Exists</SelectItem>
                    </SelectContent>
                  </Select>

                  {a.type === 'JSON_PATH' && (
                    <Input
                      placeholder="JSONPath ($.data.id)"
                      value={a.target || ''}
                      onChange={(e) => {
                        const next = [...assertions];
                        next[i].target = e.target.value;
                        setAssertions(next);
                      }}
                      className="w-40 font-mono text-xs"
                    />
                  )}

                  <Select
                    value={a.operator}
                    onValueChange={(val) => {
                      const next = [...assertions];
                      next[i].operator = val;
                      setAssertions(next);
                    }}
                  >
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EQUALS">EQUALS</SelectItem>
                      <SelectItem value="CONTAINS">CONTAINS</SelectItem>
                      <SelectItem value="LESS_THAN">LESS THAN</SelectItem>
                      <SelectItem value="EXISTS">EXISTS</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Beklenen Değer"
                    value={a.expectedValue || ''}
                    onChange={(e) => {
                      const next = [...assertions];
                      next[i].expectedValue = e.target.value;
                      setAssertions(next);
                    }}
                    className="flex-1 text-xs"
                  />
                  <Button variant="ghost" size="icon" aria-label={`Assertion ${i + 1} sil`} title={`Assertion ${i + 1} sil`} onClick={() => handleRemoveAssertion(i)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddAssertion} className="text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Assertion Ekle
              </Button>
            </TabsContent>
          </Tabs>

          {/* Live Execution Result Playground */}
          {executionResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={executionResult.statusCode >= 200 && executionResult.statusCode < 300 ? "bg-emerald-600" : "bg-rose-600"}>
                    {executionResult.statusCode} {executionResult.statusText}
                  </Badge>
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {executionResult.responseTimeMs} ms
                  </span>
                </div>
                <Badge variant={executionResult.success ? "outline" : "destructive"}>
                  {executionResult.success ? "Tüm Doğrulamalar Geçerli" : "Hata Oluştu"}
                </Badge>
              </div>

              {/* Assertions output checklist */}
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-slate-400">Assertion Sonuçları:</div>
                {executionResult.assertionResults.map((ar, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 font-mono">
                    {ar.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <span className={ar.passed ? "text-emerald-300" : "text-rose-300"}>{ar.message}</span>
                  </div>
                ))}
              </div>

              {/* Data payload preview */}
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-slate-400">Yanıt JSON Ağacı (Response Data)</summary>
                <pre className="mt-2 p-2 bg-slate-950 rounded text-[11px] font-mono overflow-x-auto text-emerald-400 max-h-40">
                  {JSON.stringify(executionResult.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">Kaydet ve Senaryoya Ekle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
