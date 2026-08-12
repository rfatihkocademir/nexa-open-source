# Nexa Frontend — Veri Görüntüleme Test Senaryoları

## Kök Neden

`api.ts` dosyasındaki axios response interceptor, backend yanıtını otomatik unwrap ediyor:

```typescript
api.interceptors.response.use((response) => response.data, ...);
```

Servis katmanında `response.data` yazıldığında `undefined` dönüyor. Bu sorun **tüm `response.data` kullanan servislerde** mevcut.

> `as unknown as ApiResponse<T>` cast yapan servisler bu sorundan **etkilenmez** — backend `{ data: ... }` wrapper döndüğü sürece `.data` geçerli bir property'dir.

---

## Giriş Bilgileri

Test kullanıcı bilgileri repository içinde tutulmaz. Yerel/CI ortamında secret store üzerinden `API_EMAIL` ve `API_PASSWORD` sağlayın.

---

## MODÜL 1: Kimlik Doğrulama — 🔴 Yüksek Risk
**Servis:** `auth.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 1.1 | Login | `/login` > email/şifre gir > Giriş Yap | Dashboard'a yönlendirilmeli |
| 1.2 | Hatalı giriş | Yanlış şifre ile dene | Hata mesajı gösterilmeli |

---

## MODÜL 2: Kullanıcı Yönetimi — 🔴 Yüksek Risk
**Servis:** `user.service.ts` — düz `response.data` (6 metot)

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 2.1 | Kullanıcı listesi | Admin Panel > Kullanıcı Yönetimi | Tüm kullanıcılar listelenmeli |
| 2.2 | Kullanıcı detayı | Listeden bir kullanıcıya tıkla | Detay bilgileri gösterilmeli |
| 2.3 | Kullanıcı oluştur | "Yeni Kullanıcı" > Formu doldur > Kaydet | Listede görünmeli |
| 2.4 | Kullanıcı güncelle | Detay dialogunda değiştir > Kaydet | Güncel bilgiler yansımalı |
| 2.5 | Profil (getMe) | Profil sayfasına git | Kullanıcı bilgileri gösterilmeli |
| 2.6 | Profil güncelle | İsim değiştir > Kaydet | Değişiklikler yansımalı |

---

## MODÜL 3: Proje Yönetimi — 🟡 Orta Risk
**Servis:** `project.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 3.1 | Proje listesi | Dashboard'a git | Aktif projeler listelenmeli |
| 3.2 | Proje detayı | Bir projeye tıkla | Proje bilgileri, sekmeler görünmeli |
| 3.3 | Proje oluşturma | "Yeni Proje" > Doldur > Kaydet | Listede görünmeli |
| 3.4 | Proje güncelleme | Ayarlar > adı değiştir > Kaydet | Güncel ad görünmeli |
| 3.5 | Arşivleme | Ayarlar > "Arşivle" | Aktif listeden kalkmalı |
| 3.6 | Uyarılar | Dashboard'da uyarı banner kontrol | Zombie proje uyarıları gösterilmeli |
| 3.7 | Üye ekleme | Üyeler sekmesi > Yeni üye ekle | Üye listesine eklenmeli |

---

## MODÜL 4: Backlog (Epic/Story/Sprint) — ✅ Düzeltildi
**Servisler:** `epic`, `story`, `sprint` — **fix uygulandı**

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 4.1 | Epic listesi | Backlog sayfası > sol panel | Epic'ler listelenmeli |
| 4.2 | Story listesi | Backlog > ana alan | Story'ler görünmeli |
| 4.3 | Sprint listesi | Backlog > sprint bölümü | Sprint'ler görünmeli |
| 4.4 | Epic filtreleme | Sol panelden epic seç | İlgili story'ler filtrelenmeli |
| 4.5 | Drag & Drop | Story'yi sprint'e sürükle | Sprint'e atanmalı |
| 4.6 | Story detay | Bir story'ye tıkla | Detay dialog açılmalı |
| 4.7 | Sprint başlatma | Planlı sprint > "Başlat" | Status ACTIVE olmalı |
| 4.8 | Silinmişleri göster | Toggle butonu aç | Silinmiş story'ler görünmeli |

---

## MODÜL 5: Kanban Board — 🟡 Orta Risk
**Servis:** `agile.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 5.1 | Board görünümü | Proje > Board sekmesi | Kolonlar ve kartlar görünmeli |
| 5.2 | Sürükle-bırak | Kartı başka kolona taşı | Yeni kolonda olmalı |
| 5.3 | Sprint filtresi | Farklı sprint seç | O sprint'in öğeleri gösterilmeli |
| 5.4 | Kişi filtresi | Kullanıcı seç | Sadece o kişinin öğeleri görünmeli |

---

## MODÜL 6: Board Kolonları — 🔴 Yüksek Risk
**Servis:** `boardColumn.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 6.1 | Kolon listesi | Board sayfasını aç | Dinamik kolonlar görünmeli |
| 6.2 | Kolon oluşturma | Yeni kolon ekle | Board'da görünmeli |
| 6.3 | Kolon güncelleme | Kolon adını değiştir | Güncel ad gösterilmeli |
| 6.4 | Kolon sıralama | Sırayı değiştir | Yeni sırada gösterilmeli |

---

## MODÜL 7: Bug Yönetimi — 🔴 Yüksek Risk
**Servis:** `bug.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 7.1 | Bug oluşturma | Story detay > "Bug Ekle" > Doldur > Kaydet | Bug oluşturulmalı |
| 7.2 | Bug listesi | Proje içinde bug'ları listele | Bug'lar görünmeli |

---

## MODÜL 8: İş Talepleri — 🔴 Yüksek Risk
**Servis:** `business-request.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 8.1 | Talep listesi | Proje > İş Talepleri sekmesi | Talepler listelenmeli |
| 8.2 | Talep oluşturma | "Yeni Talep" > Doldur > Kaydet | Listede görünmeli |
| 8.3 | Talep detayı | Bir talebe tıkla | Detay gösterilmeli |
| 8.4 | AI Analizi | Detay > "Analiz Et" | Sonuçlar gösterilmeli |
| 8.5 | Onaylama | Analiz sonrası "Onayla" | Epic'ler oluşturulmalı |
| 8.6 | Rehberlik | Detayda rehberlik bilgisini kontrol et | Kılavuz gösterilmeli |

---

## MODÜL 9: Yorumlar — 🔴 Yüksek Risk
**Servis:** `comment.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 9.1 | Yorum listesi | Story detay > Yorumlar sekmesi | Yorumlar listelenmeli |
| 9.2 | Yorum ekleme | Yorum yaz > Gönder | Listede görünmeli |

---

## MODÜL 10: Test Yönetimi — 🟡 Orta Risk
**Servisler:** `testSuite`, `testCase`, `testRun` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 10.1 | Suite listesi | Proje > Test Suites | Suite'ler listelenmeli |
| 10.2 | Suite oluşturma | "Yeni Suite" > Kaydet | Listede görünmeli |
| 10.3 | Case listesi | Bir suite'e tıkla | Case'ler listelenmeli |
| 10.4 | Case detayı | Bir case'e tıkla | Adımlar gösterilmeli |
| 10.5 | Case oluşturma | "Yeni Case" > Kaydet | Listede görünmeli |
| 10.6 | Case onaylama | Case'i onayla | Status APPROVED olmalı |
| 10.7 | Case geçmişi | Versiyon geçmişi | Eski versiyonlar listelenmeli |
| 10.8 | Case taşıma | Başka suite'e taşı | Yeni suite'de görünmeli |
| 10.9 | Run listesi | Test Runs sekmesi | Run'lar listelenmeli |
| 10.10 | Run oluşturma | "Yeni Run" > Case seç > Kaydet | Listede görünmeli |
| 10.11 | Run detayı | Bir run'a tıkla | Item'lar gösterilmeli |
| 10.12 | Sonuç ekleme | Item'a sonuç ekle (Pass/Fail) | Kaydedilmeli |
| 10.13 | Çakışma raporu | Run detay > çakışmalar | Çakışmalar gösterilmeli |
| 10.14 | Toplu silme | Birden fazla case seç > Sil | Seçilenler silinmeli |

---

## MODÜL 11: Dashboard — 🟡 Orta Risk
**Servis:** `dashboard.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 11.1 | Proje istatistikleri | Proje detay sayfası | Sprint, story, bug sayıları gösterilmeli |
| 11.2 | Yönetim metrikleri | Dashboard > Metrikler | QGI, pass rate, velocity gösterilmeli |
| 11.3 | Son aktiviteler | Dashboard > Son aktiviteler | İşlemler listelenmeli |
| 11.4 | Global arama | Üst menü arama çubuğu | Sonuçlar listelenmeli |

---

## MODÜL 12: Milestone — 🟡 Orta Risk
**Servis:** `milestone.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 12.1 | Milestone listesi | Milestones sayfası | Listelenmeli |
| 12.2 | Milestone oluştur | Yeni milestone oluştur | Listede görünmeli |
| 12.3 | Milestone detay | Bir milestone'a tıkla | Detay gösterilmeli |

---

## MODÜL 13: Release Yönetimi — 🟡 Orta Risk
**Servis:** `release.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 13.1 | Release listesi | Proje > Release Hub | Adaylar listelenmeli |
| 13.2 | Release oluşturma | Yeni aday oluştur | Listede görünmeli |
| 13.3 | Release detayı | Bir release'e tıkla | Detay yüklenmeli |
| 13.4 | Karar ekleme | Release'e karar ekle | Listede görünmeli |
| 13.5 | Durum güncelleme | Durumu değiştir | Yeni durum yansımalı |

---

## MODÜL 14: Otomasyon — 🟡 Orta Risk
**Servis:** `automation.service.ts` — ApiResponse cast

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 14.1 | Step listesi | Otomasyon > Steps | Adımlar listelenmeli |
| 14.2 | Step oluşturma | Yeni adım oluştur | Listede görünmeli |
| 14.3 | Senaryo builder | Test case > Otomasyon sekmesi | Builder açılmalı |
| 14.4 | Senaryo oluşturma | Adımları ekle > Kaydet | Kaydedilmeli |
| 14.5 | Dry Run | "Çalıştır" butonu | Sonuç gösterilmeli |

---

## MODÜL 15: AI Servisleri — 🔴 Yüksek Risk
**Servis:** `ai.service.ts` — `response.data.data` (çift seviye unwrap)

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 15.1 | Adım üretme | Case oluştururken "AI ile üret" | Adımlar üretilmeli |
| 15.2 | Story'den test üret | Story > "AI ile Test Üret" | Case'ler oluşturulmalı |
| 15.3 | Hata analizi | Başarısız sonuç > "Analiz Et" | Rapor gösterilmeli |
| 15.4 | Proje asistanı | AI Asistan sekmesi > Soru sor | Yanıt gösterilmeli |

---

## MODÜL 16: POM Generator — 🔴 Yüksek Risk
**Servis:** `aiPom.service.ts` — `response.data.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 16.1 | Element listesi | Proje > POM sekmesi | Elementler listelenmeli |
| 16.2 | HTML'den çıkarma | HTML yapıştır > "Çıkar" | Elementler listede görünmeli |
| 16.3 | Element kaydetme | Çıkarılan elementi kaydet | Listede görünmeli |

---

## MODÜL 17: Bildirimler — 🔴 Yüksek Risk
**Servis:** `notification.service.ts` — `response.data.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 17.1 | Bildirim listesi | Sağ üst bildirim ikonu | Bildirimler listelenmeli |
| 17.2 | Okundu işaretle | Bir bildirime tıkla | Okunmuş olarak işaretlenmeli |
| 17.3 | Tümünü oku | "Tümünü Oku" butonu | Hepsi okunmuş olmalı |

---

## MODÜL 18: Entegrasyonlar — 🔴 Yüksek Risk
**Servis:** `integration.service.ts` — düz `response.data`

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 18.1 | Entegrasyon listesi | Proje > Entegrasyonlar | Listelenmeli |
| 18.2 | Oluşturma | Yeni entegrasyon ekle | Görünmeli |
| 18.3 | Güncelleme | Düzenle > Kaydet | Yansımalı |

---

## MODÜL 19: Dosya Yükleme — 🔴 Yüksek Risk
**Servis:** `upload.service.ts` — düz `response.data` (MinIO bağımlı)

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 19.1 | Medya yükleme | Wiki/Story'de resim yükle | Görüntülenmeli |
| 19.2 | Ek dosya listesi | Story/Wiki > ekler | Listelenmeli |
| 19.3 | Dosya silme | Bir eki sil | Listeden kalkmalı |

---

## MODÜL 20: Import/Export — 🔴 Yüksek Risk
**Servisler:** `import` (`response.data.data`), `export` (blob `response.data`)

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 20.1 | Excel import | Import > Excel seç | Sonuç gösterilmeli |
| 20.2 | Sonuç dışa aktarma | Test Run > "Excel'e Aktar" | .xlsx indirilmeli |
| 20.3 | Case dışa aktarma | Proje > "Test Cases Dışa Aktar" | .xlsx indirilmeli |

---

## MODÜL 21: Wiki — 🟡 Orta Risk

| # | Test | Adımlar | Beklenen |
|---|------|---------|----------|
| 21.1 | Wiki alanları | Proje > Wiki sekmesi | Alanlar listelenmeli |
| 21.2 | Sayfa ağacı | Bir alana tıkla | Ağaç gösterilmeli |
| 21.3 | Sayfa görüntüleme | Bir sayfaya tıkla | İçerik gösterilmeli |
| 21.4 | Sayfa oluşturma | "Yeni Sayfa" > Yaz > Kaydet | Ağaçta görünmeli |
| 21.5 | Sayfa düzenleme | Düzenle > Kaydet | Güncel içerik gösterilmeli |

---

## Öncelik Sıralaması (En Riskli İlk)

1. 🔴 **Auth** — Giriş yapılamazsa hiçbir şey çalışmaz
2. 🔴 **Users** — Profil ve kullanıcı yönetimi
3. 🔴 **Comments** — Story yorumları
4. 🔴 **Bug** — Bug oluşturma/listeleme
5. 🔴 **Board Columns** — Kanban kolon yönetimi
6. 🔴 **Business Requests** — İş talepleri
7. 🔴 **Integrations** — Entegrasyon yönetimi
8. 🔴 **Upload/Storage** — Dosya yükleme
9. 🔴 **AI Service** — AI özellikleri (çift unwrap)
10. 🔴 **Notifications** — Bildirim sistemi (çift unwrap)
11. 🔴 **Import/Export** — Veri aktarımı
12. 🟡 **Project/Dashboard/TestCase/Run/Suite/Milestone/Release/Automation** — ApiResponse cast (backend formatına bağlı)
