# language: tr
@agile @work_items @p1
Özellik: Agile İş Yönetimi ve Sprint Planlama
  İş kalemleri (Epic, Story, Bug) hiyerarşik olarak yönetilmeli ve board üzerinde doğru statü geçişleri yapmalıdır.

  @s1 @hierarchy
  Senaryo: NEXA-UI-1001 - Epic altında yeni bir Story oluşturma ve hiyerarşi bağı
    Diyelim ki "Mobil Uygulama Revizyonu" isimli bir Epic mevcuttur
    Ne zaman kullanıcı Epic detay sayfasında "Alt Öğe Ekle > Story" butonuna basarsa
    O zaman yeni Story "Parent" olarak bu Epic'e otomatik bağlanır
    Ve Epic sayfasındaki "Çocuk Öğeler" listesinde bu Story görünür

  @s0 @board @drag_drop
  Senaryo: NEXA-UI-1002 - Kanban Board üzerinde sürükle-bırak ile statü değişikliği
    Diyelim ki "Story-01" kartı "TODO" kolonundadır
    Ne zaman kullanıcı kartı tutup "IN PROGRESS" kolonuna bırakırsa
    O zaman iş öğesinin statüsü veritabanında "IN_PROGRESS" olarak güncellenir
    Ve aktivite günlüğüne (Audit Log) "Statü TODO -> IN PROGRESS olarak değişti" kaydı düşer

  @s1 @sprint_planning
  Senaryo: NEXA-UI-1003 - Sprint planlama: Work Item'ı sprint'e atama
    Diyelim ki "Sprint 5" isimli bir planlanmış sprint mevcuttur
    Ne zaman kullanıcı Backlog'daki bir işi "Sprint 5" alanına sürüklerse
    O zaman işin "sprintId" bilgisi güncellenir
    Ve sprint toplam "Story Point" değeri otomatik artar

  @s1 @ai @generation
  Senaryo: NEXA-UI-1004 - AI İş Talebi analizinden otomatik Story'ler üretme
    Diyelim ki bir "Business Request" (İş Talebi) AI tarafından analiz edilmiştir
    Ne zaman kullanıcı "Önerilen Story'leri Oluştur" butonuna basarsa
    O zaman AI'nın önerdiği başlık ve açıklamalarla 3-5 adet yeni Story taslak olarak oluşur
    Ve her Story orijinal iş talebine "sourceRequestId" ile bağlanır

  @s2 @estimation
  Senaryo: NEXA-UI-1005 - Story Point (Tahminleme) validasyonu
    Diyelim ki kullanıcı bir Story düzenlemektedir
    Ne zaman "Story Point" alanına "999" veya negatif bir değer girerse
    O zaman sistem "Mantıklı bir tahmin puanı giriniz (0-100)" uyarısı verir

  @s0 @traceability
  Senaryo: NEXA-UI-1006 - Work Item silindiğinde bağlı Test Case'lerin yetim kalmaması
    Diyelim ki "Story-X"e bağlı 3 adet Test Case mevcuttur
    Ne zaman "Story-X" silinirse
    O zaman bağlı Test Case'lerin "workItemId" alanı temizlenir
    Ve Test Case'ler "Bağlantısız" (Unlinked) olarak korunmaya devam eder

  @s2 @comments
  Senaryo: NEXA-UI-1007 - İş öğesine yorum yapma ve @mention bildirimi
    Diyelim ki kullanıcı "Bug-12" detay sayfasındadır
    Ne zaman "@Ahmet Bu hata kritik, bakar mısın?" şeklinde yorum yaparsa
    O zaman yorum kaydedilir
    Ve "Ahmet" isimli kullanıcıya anlık bildirim gider

  @s2 @filters
  Senaryo: NEXA-UI-1008 - Board üzerinde kullanıcıya göre filtreleme (Quick Filter)
    Diyelim ki board üzerinde 20 farklı kart mevcuttur
    Ne zaman kullanıcı "Sadece Benim İşlerim" butonuna basarsa
    O zaman sadece o kullanıcıya atanmış kartlar gösterilir
    Ve diğer kartlar gizlenir
