# language: tr
@reports @analytics @p1
Özellik: Gelişmiş Raporlama ve Verimlilik Analizi
  Ekip liderleri ve yöneticiler test süreçlerinin dar boğazlarını ve iyileştirme alanlarını raporlar üzerinden analiz eder.

  @s1 @efficiency
  Senaryo: NEXA-UI-1501 - Kullanıcı bazlı test koşu verimliliği raporu
    Diyelim ki kullanıcı "Raporlar > Verimlilik" sayfasındadır
    Ne zaman bir tarih aralığı seçerse
    O zaman sistem her bir test uzmanının "Günlük Koşulan Test Sayısı" ve "Ortalama Hata Bulma Oranı"nı tablo olarak sunar

  @s2 @trends
  Senaryo: NEXA-UI-1502 - Hata Yoğunluk Haritası (Bug Heatmap)
    Diyelim ki projede farklı modüller (Giriş, Ödeme, Profil) mevcuttur
    Ne zaman kullanıcı "Hata Trendleri" raporunu açarsa
    O zaman sistem en çok hata çıkan modülleri "Isı Haritası" (Heatmap) üzerinde görselleştirir
    Ve en riskli modülü (örn: Ödeme) kırmızı ile işaretler

  @s1 @coverage
  Senaryo: NEXA-UI-1503 - Gereksinim Karşılama Oranı (Requirements Coverage) Raporu
    Diyelim ki projede 10 adet iş gereksinimi mevcuttur
    Ne zaman kullanıcı "Kapsam Raporu"nu açarsa
    O zaman kaç gereksinimin en az bir "PASS" almış testi olduğunu yüzde olarak görür
    Ve "Kapsanmayan Gereksinimler" listesini PDF olarak indirebilir

  @s2 @automation_roi
  Senaryo: NEXA-UI-1504 - Otomasyon ROI (Yatırım Getirisi) Raporu
    Diyelim ki sistemde hem manuel hem otomatik testler mevcuttur
    Ne zaman kullanıcı "Otomasyon Tasarrufu" raporunu açarsa
    O zaman otomasyon sayesinde manuelden tasarruf edilen tahmini "Adam-Saat" değerini görür
    Ve bu veri "Manuel Koşu Süresi" ortalaması baz alınarak hesaplanır

  @s1 @comparison
  Senaryo: NEXA-UI-1505 - Farklı sürümler (Releases) arası kalite karşılaştırması
    Diyelim ki "Release 1.0" ve "Release 2.0" tamamlanmıştır
    Ne zaman kullanıcı "Karşılaştırma Raporu"nda bu iki sürümü seçerse
    O zaman sürüm bazlı hata sayılarını ve test geçme oranlarını yan yana (Side-by-side) görür

  @s3 @scheduled_reports
  Senaryo: NEXA-UI-1506 - Haftalık özet raporun e-posta ile zamanlanması
    Diyelim ki kullanıcı Team Leader rolündedir
    Ne zaman "Rapor Zamanla" diyerek "Her Pazartesi saat 09:00" seçeneğini işaretlerse
    O zaman sistem her hafta başında projenin genel sağlık özetini e-posta ile gönderir
