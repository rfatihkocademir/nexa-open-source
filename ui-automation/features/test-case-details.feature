# language: tr
@regression @mock @p1
Özellik: Test Senaryosu Detayları ve Gelişmiş Düzenleme
  Test vakalarının detaylı içerik yönetimi, adım sıralaması ve durum geçişleri titizlikle test edilmelidir.

  Arka Plan:
    Diyelim ki kullanıcı TEAM_LEADER olarak giriş yapmıştır
    Ve bir test senaryosu detay sayfasını açmıştır

  @s1 @steps
  Senaryo: NEXA-UI-2301 - Test adımlarının yerini değiştirme (Reordering)
    Diyelim ki test vakasında 3 adet adım mevcuttur
    Ne zaman kullanıcı 3. adımı tutup 1. sıraya sürüklerse
    O zaman adım numaraları otomatik olarak 1, 2, 3 şeklinde yeniden düzenlenir
    Ve "Kaydet"e basıldığında yeni sıra kalıcı olur

  @s2 @prerequisites
  Senaryo: NEXA-UI-2302 - Ön koşul (Prerequisite) alanında Markdown kullanımı
    Ne zaman kullanıcı ön koşul alanına "**Kalın Yazı**" ve "- Liste Öğesi" yazarsa
    O zaman önizleme modunda metin zengin formatta (Markdown) doğru render edilir

  @s1 @status
  Senaryo: NEXA-UI-2303 - Test vaka durumunun "PENDING" durumuna çekilmesi
    Diyelim ki test vaka durumu "DRAFT" halindedir
    Ne zaman kullanıcı durumu "PENDING" (Onay Bekliyor) olarak güncellerse
    O zaman proje yöneticilerine onay bildirimi gider
    Ve düzenleme alanları (başlık hariç) kilitlenir

  @s0 @approval
  Senaryo: NEXA-UI-2304 - Onaylı test vaka içeriğinin değiştirilememesi (Locking)
    Diyelim ki test vaka durumu "APPROVED" (Onaylanmış) halindedir
    Ne zaman kullanıcı adımları silmeye çalışırsa
    O zaman "Onaylanmış testler doğrudan düzenlenemez, yeni versiyon oluşturun" uyarısı alınır
    Ve silme butonu pasif görünür

  @s2 @tags
  Senaryo: NEXA-UI-2305 - Test vakasına birden fazla etiket (Tag) ekleme
    Ne zaman kullanıcı etiket alanından "Regresyon", "P1" ve "UI" etiketlerini seçerse
    O zaman her üç etiket de case başlığının altında renkli çipler olarak görünür
    Ve etiketlerin üzerindeki "X"e basarak etiket silinebilir

  @s1 @history
  Senaryo: NEXA-UI-2306 - Test vaka bazlı değişiklik günlüğü (Change Log)
    Ne zaman kullanıcı "Geçmiş" sekmesine geçerse
    O zaman "Kim, hangi tarihte, hangi alanı (ör: Başlık) değiştirdi" listesini görür
    Ve eski bir versiyonu seçerek şimdiki haliyle farkını (Diff) inceleyebilir

  @s3 @duplication
  Senaryo: NEXA-UI-2307 - Mevcut test vakasını kopyalayarak yeni bir vaka oluşturma
    Ne zaman kullanıcı "Kopyasını Oluştur" butonuna basarsa
    O zaman tüm adımlar ve ön koşullar kopyalanarak yeni bir form açılır
    Ve başlık otomatik olarak "KOPYA - [Orijinal Başlık]" şeklinde dolar

  @s2 @links
  Senaryo: NEXA-UI-2308 - Test vakası detayından bağlı olduğu iş öğesine (Work Item) gitme
    Diyelim ki test vakası "STORY-45" kodlu iş öğesine bağlıdır
    Ne zaman kullanıcı "STORY-45" linkine tıklarsa
    O zaman sistem "Agile Board" veya "İş Öğesi Detay" sayfasını yeni sekmede açar
