# language: tr
@milestones @release @p1
Özellik: Kilometre Taşları (Milestones) ve Sürüm Planlama
  Büyük teslimatlar kilometre taşları ile takip edilir. Sürüm adayları bu hedeflere bağlıdır.

  @s1 @happy_path
  Senaryo: NEXA-UI-1201 - Yeni bir Milestone oluşturma ve bitiş tarihi atama
    Diyelim ki kullanıcı proje detaylarındadır
    Ne zaman "Yeni Kilometre Taşı" ekleyip "Q2 Teslimatı" adını verirse
    O zaman Milestone takvimde ve listede görünür

  @s1 @relationship
  Senaryo: NEXA-UI-1202 - Test koşusunu bir Milestone'a bağlama
    Diyelim ki "Versiyon 1.1" isimli bir Milestone mevcuttur
    Ne zaman kullanıcı yeni bir test koşusu oluştururken "İlgili Milestone" olarak bunu seçerse
    O zaman Milestone sayfasındaki "İlgili Test Koşuları" listesi güncellenir

  @s0 @readiness
  Senaryo: NEXA-UI-1203 - Milestone bazlı ilerleme raporu (Progress Bar)
    Diyelim ki "Q2 Teslimatı"na bağlı 10 test case mevcuttur
    Ve 5 tanesi "PASS", 2 tanesi "FAIL" almıştır
    Ne zaman kullanıcı Milestone listesine bakarsa
    O zaman ilerleme çubuğu %50 oranını doğru şekilde gösterir
    Ve kalan iş yükü (3 Untested) bilgisini verir

  @s2 @status
  Senaryo: NEXA-UI-1204 - Milestone tamamlandığında otomatik arşivleme
    Diyelim ki bir Milestone'a bağlı tüm test koşuları "COMPLETED" durumundadır
    Ne zaman kullanıcı Milestone durumunu "CLOSED" yaparsa
    O zaman bu Milestone aktif seçim listelerinden gizlenir
    Ve "Arşiv" sekmesine taşınır

  @s1 @release_candidate
  Senaryo: NEXA-UI-1205 - Sürüm Adayı (RC) oluşturma ve kapsam belirleme
    Diyelim ki "Q2" Milestone'u bitmek üzeredir
    Ne zaman kullanıcı "Yeni Sürüm Adayı" oluşturup "RC-01" adını verirse
    O zaman sistem o Milestone'a bağlı tüm onaylı testleri ve çözülmüş bugları kapsama dahil eder

  @s2 @audit
  Senaryo: NEXA-UI-1206 - Milestone silindiğinde bağlı verilerin durum koruması
    Diyelim ki bir Milestone silinmiştir
    O zaman ona bağlı test koşuları "Yetim" (Unlinked) kalır ama silinmez
    Ve veritabanı bütünlüğü korunur
