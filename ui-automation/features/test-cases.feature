# language: tr
@test_design @p1
Özellik: Gelişmiş Test Tasarımı ve Yaşam Döngüsü Yönetimi
  Test vakaları projenin en değerli varlıklarıdır. Versiyonlama, onay mekanizması ve toplu işlemler hatasız çalışmalıdır.

  @s1 @versioning
  Senaryo: NEXA-UI-0701 - Onaylı bir test case güncellendiğinde yeni versiyon oluşması
    Diyelim ki "TC-101" kodlu test case "APPROVED" durumundadır ve versiyonu "1"dir
    Ne zaman kullanıcı başlığı güncelleyip kaydederse
    O zaman sistem "Yeni versiyon oluşturulacak, onaylı sürüm arşivlenecek" uyarısı verir
    Ve yeni versiyon "2" olarak "DRAFT" durumunda oluşur
    Ve "Geçmiş" sekmesinde versiyon "1"in kilitli kopyası görünür

  @s0 @bulk_actions
  Senaryo: NEXA-UI-0702 - Çoklu test case seçimi ve toplu durum değişikliği
    Diyelim ki bir test paketinde (suite) 10 adet "DRAFT" durumunda test case mevcuttur
    Ne zaman kullanıcı 5 tanesini seçip "Toplu İşlemler > Durumu Değiştir > PENDING" yaparsa
    O zaman seçilen 5 testin durumu aynı anda "PENDING" olur
    Ve seçilmeyen diğer 5 test "DRAFT" kalmaya devam eder

  @s1 @suite_management
  Senaryo: NEXA-UI-0703 - Sürükle-bırak ile test paketleri arası case taşıma
    Diyelim ki "Giriş Testleri" ve "Profil Testleri" adında iki farklı paket mevcuttur
    Ne zaman kullanıcı "TC-01"i "Giriş"ten "Profil" paketine sürükleyip bırakırsa
    O zaman TC-01'in paket bilgisi güncellenir
    Ve kullanıcıya "1 test başarıyla taşındı" onayı gösterilir

  @s2 @step_library
  Senaryo: NEXA-UI-0704 - Adım kütüphanesinden tekrar kullanılabilir adım ekleme
    Diyelim ki sistemde "Giriş Yapılır" adında ortak bir test adımı mevcuttur
    Ne zaman kullanıcı yeni bir test case oluştururken "Kütüphaneden Ekle" butonuna basarsa
    O zaman arama kutusunda "Giriş" kelimesiyle ortak adımı bulup ekleyebilir
    Ve adımın açıklaması/beklenen sonucu otomatik dolar

  @s1 @search_filter
  Senaryo: NEXA-UI-0705 - Gelişmiş filtreleme: Öncelik ve Durum kombinasyonu
    Diyelim ki projede 100+ test case mevcuttur
    Ne zaman kullanıcı "Kritik" (CRITICAL) öncelikli VE "Hata Almış" (FAIL) durumdaki testleri filtrelerse
    O zaman ekranda sadece bu iki kriteri sağlayan test vakaları listelenir
    Ve liste üzerinde "2 kriter uygulandı" etiketi görünür

  @s2 @attachments
  Senaryo: NEXA-UI-0706 - Test adımına özel ekran görüntüsü ekleme
    Diyelim ki kullanıcı bir test case'in 3. adımını düzenlemektedir
    Ne zaman kullanıcı "Adım Kanıtı Ekle" butonuna basıp bir görsel yüklerse
    O zaman görsel sadece o adım ile ilişkilendirilir
    Ve test koşusu sırasında o adımın yanında küçük resim önizlemesi belirir

  @s0 @data_integrity
  Senaryo: NEXA-UI-0707 - Test case silindiğinde bağlı koşu sonuçlarının korunması
    Diyelim ki "TC-50" testi daha önce bir koşuda "PASS" almıştır
    Ne zaman admin "TC-50" testini sistemden silerse
    O zaman geçmiş test koşularındaki "TC-50" sonucu silinmez
    Ve raporlarda "Silinmiş Kayıt" etiketiyle veri bütünlüğü korunur

  @s1 @traceability
  Senaryo: NEXA-UI-0708 - Gereksinim ile Test Case bağlama (Traceability Matrix)
    Diyelim ki "REQ-01" isimli bir iş gereksinimi mevcuttur
    Ne zaman kullanıcı test case düzenleme ekranında "İlgili Gereksinim" alanından "REQ-01"i seçerse
    O zaman "İzlenebilirlik Matrisi"nde bu iki kayıt arasında bağlantı kurulur
    Ve gereksinim sayfasında "Kapsanan Testler" altında bu case görünür
