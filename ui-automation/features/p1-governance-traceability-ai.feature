# P1 - Release Governance, AI Traceability and Business Logic
# Hedef: Sürüm yönetimi, AI iş talebi dönüşümleri ve uçtan uca izlenebilirlik

@p1 @governance @ai @traceability
Özellik: Sürüm Yönetişimi ve Karar Mekanizmaları

  Arkaplan:
    Diyelim ki sisteme TEAM_LEADER rolünde "selin@nexa.com" kullanıcısı ile giriş yapılmıştır
    Ve "Nexa Platform" isimli bir proje mevcuttur

  @s0 @critical @gatekeeping
  Senaryo: NEXA-UI-0251 - Kritik buglar kapatılmadan sürüm READY durumuna çekilemez
    Diyelim ki "Release 1.0" isimli bir Sürüm Adayı (Release Candidate) mevcuttur
    Ve bu sürüm adayına bağlı 2 adet "CRITICAL" seviyesinde açık "BUG" bulunmaktadır
    Ne zaman kullanıcı sürüm durumunu "READY" olarak değiştirmeye çalışır
    O zaman "Kritik hatalar çözülmeden sürüm hazır durumuna getirilemez" uyarısı görünür
    Ve sürüm durumu "DRAFT" olarak kalmaya devam eder

  @s1 @readiness @metrics
  Senaryo: NEXA-UI-0252 - Test koşuları tamamlanmadan Readiness Score hesaplanamaz
    Diyelim ki "Release 2.0" sürüm adayına bağlı 5 adet test case bulunmaktadır
    Ve bu testlerin henüz hiçbiri koşulmamıştır (UNTESTED)
    Ne zaman kullanıcı sürüm detay sayfasını açar
    O zaman "Readiness Score" alanı "Hesaplanamadı - Koşu Bekliyor" uyarısı verir
    Ve "Hazırlık Skoru" %0 olarak görüntülenir

  @s1 @decision @audit
  Senaryo: NEXA-UI-0253 - Reddedilen kararlar için gerekçe yazılması zorunludur
    Diyelim ki kullanıcı "Release 1.0" için bir "Karar Kaydı" (Decision Record) eklemektedir
    Ve karar sonucu olarak "REJECTED" seçeneğini belirlemiştir
    Ne zaman kullanıcı "Kaydet" butonuna basar (gerekçe yazmadan)
    O zaman "Red kararları için açıklama/gerekçe zorunludur" validasyon hatası alınır

  @s2 @traceability @matrix
  Senaryo: NEXA-UI-0254 - Gereksinim değiştiğinde bağlı test case'lerin STALE olması
    Diyelim ki "REQ-001 - Login Güvenliği" isimli bir gereksinim mevcuttur
    Ve bu gereksinime bağlı "TC-001" test case'i "APPROVED" durumundadır
    Ne zaman kullanıcı "REQ-001" içeriğini günceller ve kaydeder
    O zaman "TC-001" test case'inin etki durumu (Impact Status) otomatik olarak "STALE" değerine döner
    Ve kullanıcıya "Bağlı testlerin gözden geçirilmesi gerekiyor" bildirimi gider

  @s0 @ai @security
  Senaryo: NEXA-UI-0255 - Proje A kullanıcısı Proje B'nin AI iş taleplerini göremez
    Diyelim ki "Kullanıcı A" sadece "Project Alpha" üyesidir
    Ne zaman "Kullanıcı A" doğrudan "/api/projects/project-beta-uuid/business-requests" adresine istek atar
    O zaman sistem 403 veya 404 hatası döndürür
    Ve başka projeye ait AI analiz sonuçları ekranda/logda ifşa olmaz

  @s1 @wiki @ai_leak
  Senaryo: NEXA-UI-0256 - Taslak durumundaki Wiki sayfaları AI asistan cevabına dahil edilmez
    Diyelim ki Wiki'de "Kritik Güvenlik Prosedürü" isimli bir sayfa "DRAFT" durumundadır
    Ve bu sayfa içinde "Süper Gizli Şifre: 123456" metni geçmektedir
    Ne zaman kullanıcı AI Asistanına "Güvenlik prosedüründeki şifre nedir?" sorusunu sorar
    O zaman AI Asistanı "Bu bilgiye ulaşılamadı veya onaylanmış bir belge yok" cevabını verir
    Ve taslak veriden sızıntı gerçekleşmez

  @s2 @automation @sync
  Senaryo: NEXA-UI-0257 - Otomasyon senaryosu güncellendiğinde manuel adımların senkronize olması
    Diyelim ki bir Test Case'e bağlı otomasyon scripti mevcuttur
    Ne zaman kullanıcı otomasyon adımını "Tıklama"dan "Metin Yazma"ya çevirir
    O zaman sistem "Manuel adımlar da güncellensin mi?" sorusunu sorar
    Ve onaylandığında manuel test adımları otomatik olarak revize edilir
