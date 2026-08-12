# UI Automation

Bu klasör Nexa için ayrı Playwright tabanlı UI otomasyon alanıdır.

## Hedef

- Uygulamanın kullanıcı akışlarını Playwright ile test etmek
- Türkçe, detaylı BDD feature dosyaları ile test kapsamını görünür kılmak
- Hata durumlarında trace, video ve screenshot üretmek
- Mock veri ile hızlı regresyon, canlı backend ile gerçek smoke doğrulaması yapmak

## BDD Kataloğu

BDD kataloğu `features/*.feature` içeriklerinden yerel olarak üretilir ve kaynak kontrolüne eklenmez. Oluşturmak için:

```bash
npm --prefix ui-automation run bdd:catalog
```

Komut tamamlandığında `ui-automation/bdd-katalogu.md` dosyasını açabilirsiniz.

## 5000 Senaryo Programı

Minimum senaryo hedefi 5000'dir. Bu hedef otomatik üretilmiş satırlarla değil, uygulamayı gerçekten kırmaya çalışan, risk bazlı ve elle kürate edilmiş senaryolarla yönetilir.

```bash
npm --prefix ui-automation run bdd:count
npm --prefix ui-automation run bdd:catalog
```

Plan, dağılım ve yazım standardı için [5000-scenario-plan.md](./5000-scenario-plan.md) dosyasına bakın.

## Çalıştırma

```bash
npm run test:ui
```

Bu komut `ui-automation` içindeki Playwright koşumunu başlatır. Geliştirme sırasında frontend dev server otomatik olarak ayağa kalkar.

Canlı backend ile çalışmak için:

```bash
UI_AUTOMATION_MODE=live npm run test:ui
```

Canlı modda backend tarafının da çalışıyor olması gerekir. Varsayılan frontend adresi `http://127.0.0.1:5173` olarak kabul edilir.

## Çıktılar

- `playwright-report/html` - HTML rapor
- `playwright-report/results.json` - JSON rapor
- `test-results` - trace, video ve screenshot çıktıları

## Yapı

- `features/` - Türkçe BDD feature dosyaları
- `tests/specs/` - Çalışan Playwright spec dosyaları
- `tests/support/` - Mock veri, canlı kullanıcı ve ortak yardımcılar
- `coverage-matrix.md` - Feature ve spec eşleme tablosu
- `bdd-katalogu.md` - Yerel olarak üretilen ve Git tarafından yok sayılan BDD görünümü
