# Nexa API Automation

Bu proje backend ile gerçek HTTP üzerinden konuşan, kök dizinde bulunan API otomasyon paketidir. Stub veya controller içi çağrı kullanmaz.

## Kapsam

- `health.spec.cjs`: liveness, readiness ve legacy health kontrolleri
- `auth.spec.cjs`: login oturumu, refresh davranışı, payload doğrulaması ve parola sıfırlama sözleşmesi
- `security.spec.cjs`: kimlik doğrulama sınırı, UUID doğrulaması, bozuk JSON ve güvenlik header'ları
- `sdlc-e2e.spec.cjs`: proje → suite → test case → test run → result → onaylı requirement → backlog item zincirli iş senaryosu
- `endpoint-smoke.spec.cjs`: `backend/src/routes` içinden üretilen her HTTP operasyonu için gerçek request ve 5xx kontrolü

Route kataloğu `npm run routes` ile üretilir ve `route-catalog.json` içinde kaynak dosya/satır bilgisiyle saklanır. Test başında katalogdaki operasyon sayısı ve benzersizliği doğrulanır. Yeni endpoint eklendiğinde bu dosya değişir ve smoke matrisi otomatik olarak yeni testi üretir.

## Çalıştırma

Backend'in çalışıyor ve veritabanının migrate/seed edilmiş olması gerekir:

```bash
cd api-automation
cp .env.example .env
npm install
npx playwright install chromium
npm test
```

Kök dizinden:

```bash
npm --prefix api-automation test
npm --prefix api-automation run test:e2e
npm --prefix api-automation run test:smoke
```

Kimlik bilgileri repository içinde tutulmaz. `API_EMAIL` ve `API_PASSWORD` veya hazır JWT için `API_AUTH_TOKEN` sağlayın. Mevcut bir projeyi kullanmak ve test sonunda silmemek için `API_PROJECT_ID` ayarlayın; aksi halde E2E akışı benzersiz bir proje oluşturup temizlemeyi dener.

## Ortam değişkenleri

`.env.example` tüm değişkenleri içerir. En önemlileri:

| Değişken | Varsayılan | Amaç |
|---|---|---|
| `API_BASE_URL` | `http://127.0.0.1:1996` | Test edilecek backend |
| `API_EMAIL` | — | Login hesabı (secret) |
| `API_PASSWORD` | `Admin123!` | Login parolası |
| `API_AUTH_TOKEN` | boş | Login'i atlamak için JWT |
| `API_PROJECT_ID` | boş | E2E için mevcut proje |
| `ALLOW_DEPENDENCY_503` | `false` | Altyapı bağımlılığı nedeniyle 503'ü tolere etme seçeneği |

Smoke testleri beklenmeyen tüm 5xx cevaplarında başarısız olur; AI endpointleri de buna dahildir. Yetki/validasyon/kayıp kaynak cevapları (`400`, `401`, `403`, `404`, `409`, `422`) endpoint'in kontrollü cevap verdiği kabul edilerek raporlanır; iş akışı testleri ise başarı sözleşmelerini daha sıkı doğrular. `ALLOW_DEPENDENCY_503` yalnızca zincirli iş akışı testlerinde geçici harici bağımlılık kesintisini tolere eder; release gate olarak kullanılmamalıdır.

Production Compose, `AI_READINESS_REQUIRED=true` ile AI provider/model hazır değilse backend health kontrolünü başarısız bırakır. Ollama seçiliyse backend başlangıcında üretim ve embedding modelleri idempotent şekilde kontrol edilip eksik olanlar indirilir. Gemini/OpenRouter kullanılıyorsa geçerli credential ve model erişimi staging smoke koşusunda doğrulanmalıdır.

## CI önerisi

CI adımlarında backend'i hazırla, `route-catalog.json` üret, ardından `npm test` çalıştır. HTML raporu `playwright-report/` altında, trace ve hata artefact'ları `test-results/` altında oluşur.
