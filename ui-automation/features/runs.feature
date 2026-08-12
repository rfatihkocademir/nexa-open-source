# language: tr
@test_execution @p1
Özellik: Gelişmiş Test Koşusu ve Yürütme Yönetimi
  Test koşuları, uygulamanın anlık sağlık durumunu gösterir. Manuel ve otomatik sonuçların senkronizasyonu kritiktir.

  @s1 @manual_execution
  Senaryo: NEXA-UI-0801 - Manuel test koşusu başlatma ve adım bazlı sonuç girme
    Diyelim ki bir test koşusu "OPEN" durumundadır
    Ne zaman kullanıcı bir test vakasını seçip "Koşuyu Başlat"a basarsa
    O zaman adımlar tek tek görünür
    Ve kullanıcı her adım için "Geçti" veya "Kaldı" işaretlemesi yapabilir
    Ve tüm adımlar tamamlandığında testin final durumu otomatik hesaplanır

  @s0 @bug_reporting
  Senaryo: NEXA-UI-0802 - Başarısız test adımından doğrudan "BUG" kaydı oluşturma
    Diyelim ki kullanıcı manuel test koşmaktadır
    Ne zaman bir adımı "FAIL" olarak işaretlerse
    O zaman sistem "Hata Kaydı Oluştur" butonu sunar
    Ve butona basıldığında başlık, açıklama ve adımlar otomatik doldurulmuş bir "BUG" formu açılır

  @s1 @assignment
  Senaryo: NEXA-UI-0803 - Koşu içindeki testlerin farklı kullanıcılara atanması
    Diyelim ki "Haftalık Regresyon" koşusunda 50 test mevcuttur
    Ne zaman Team Leader 10 testi "Tester A"ya, 10 testi "Tester B"ye atarsa
    O zaman ilgili tester'lara bildirim gider
    Ve dashboard'larındaki "Üzerimdeki Testler" listesi güncellenir

  @s2 @retest
  Senaryo: NEXA-UI-0804 - "RETEST" durumu ve testin yeniden aktifleşmesi
    Diyelim ki bir test daha önce "FAIL" almıştır ve bağlı bug kapatılmıştır
    Ne zaman kullanıcı testi "RETEST" durumuna çekerse
    O zaman testin önceki sonuçları arşivlenir
    Ve test tekrar "Koşulmaya Hazır" (Untested) olarak listelenir

  @s1 @automation_sync
  Senaryo: NEXA-UI-0805 - Otomasyon sonucunun manuel sonucu ezmesi/güncellemesi
    Diyelim ki bir test hem manuel hem otomatiktir
    Ne zaman Playwright otomasyonu bu testi "FAIL" olarak tamamlarsa
    O zaman manuel durum ne olursa olsun testin genel durumu "FAIL" olarak güncellenir
    Ve "Kaynak: Otomasyon" etiketi eklenir

  @s2 @environment
  Senaryo: NEXA-UI-0806 - Farklı ortamlarda (QA, PROD) test koşusu varyasyonları
    Diyelim ki kullanıcı yeni bir test koşusu oluşturmaktadır
    Ne zaman "Ortam" olarak "PROD" seçerse
    O zaman sadece "PROD-READY" etiketli test vakaları listeye dahil edilir
    Ve kritik uyarı mesajı ("Dikkat: Canlı Ortam!") gösterilir

  @s1 @time_tracking
  Senaryo: NEXA-UI-0807 - Test koşu süresinin otomatik hesaplanması
    Diyelim ki kullanıcı "Koşuyu Başlat"a basmıştır
    O zaman arka planda bir sayaç başlar
    Ve kullanıcı "Sonucu Kaydet"e bastığında aradaki süre "Execution Duration" olarak veritabanına kaydedilir
    Ve raporlarda "Ortalama Koşu Süresi" metriği güncellenir

  @s3 @ui
  Senaryo: NEXA-UI-0808 - Koşu sırasında "Karanlık Mod" desteği ve göz yorgunluğu
    Diyelim ki kullanıcı gece vardiyasında uzun bir test koşusu yapmaktadır
    Ne zaman kullanıcı "Karanlık Mod"u aktif ederse
    O zaman koşu arayüzü yüksek kontrastlı koyu temaya geçer
    Ve durum renkleri (Yeşil/Kırmızı) okunabilir kalmaya devam eder
