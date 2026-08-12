# language: tr
@integrations @p1
Özellik: Dış Sistem Entegrasyonları ve Webhook Yönetimi
  Nexa; Jira, Slack ve GitHub gibi araçlarla senkronize çalışarak SDLC sürecini bütünleştirir.

  @s1 @slack
  Senaryo: NEXA-UI-1401 - Test hatası durumunda Slack kanalına bildirim gönderilmesi
    Diyelim ki bir Slack entegrasyonu "Kritik Hatalar" kanalı için aktiftir
    Ne zaman bir test koşusu "FAIL" sonucuyla tamamlanırsa
    O zaman ilgili Slack kanalına test ismi, hata mesajı ve rapor linkini içeren bir mesaj düşer

  @s1 @jira
  Senaryo: NEXA-UI-1402 - Nexa üzerinde oluşturulan Bug'ın Jira'ya aktarılması
    Diyelim ki Jira entegrasyonu kurulmuştur
    Ne zaman kullanıcı Nexa üzerinde bir "Bug" oluşturursa
    O zaman Jira üzerinde otomatik olarak yeni bir "Issue" açılır
    Ve Jira linki Nexa'daki iş öğesi detayına eklenir

  @s0 @github @traceability
  Senaryo: NEXA-UI-1403 - GitHub Commit mesajı ile Work Item bağlantısı
    Diyelim ki bir geliştirici GitHub'a "fix: resolved NEXA-123 login issue" mesajıyla commit atmıştır
    Ne zaman Nexa bu commit'i webhook üzerinden yakalarsa
    O zaman "NEXA-123" id'li iş öğesinin "Commits" sekmesinde bu kayıt görünür
    Ve iş öğesi durumu otomatik olarak "FIXED" (Düzeltildi) olur

  @s2 @webhooks
  Senaryo: NEXA-UI-1404 - Özel Webhook (Custom Webhook) tanımlama ve test etme
    Diyelim ki kullanıcı sistem ayarlarındadır
    Ne zaman bir URL ve "Test Koşusu Tamamlandı" event'ini seçip "Test Gönder" derse
    O zaman hedef URL'e JSON formatında bir test paketi gönderilir
    Ve sistem 200 OK cevabı aldığını doğrular

  @s1 @github @pr
  Senaryo: NEXA-UI-1405 - GitHub Pull Request durumunun Nexa üzerinde izlenmesi
    Diyelim ki bir iş öğesine bağlı aktif bir Pull Request mevcuttur
    Ne zaman PR GitHub üzerinde "Merged" (Birleştirildi) durumuna geçerse
    O zaman Nexa'daki iş öğesi otomatik olarak "READY_FOR_TEST" durumuna çekilir
    Ve ilgili test uzmanına bildirim gider

  @s2 @sync_failure
  Senaryo: NEXA-UI-1406 - Entegrasyon hatası durumunda retry (yeniden deneme) mekanizması
    Diyelim ki Jira servisi geçici olarak ulaşılamaz durumdadır
    Ne zaman Nexa bir veri senkronize etmeye çalışırsa
    O zaman sistem hatayı günlüğe kaydeder
    Ve 5 dakika sonra işlemi otomatik olarak tekrar dener
