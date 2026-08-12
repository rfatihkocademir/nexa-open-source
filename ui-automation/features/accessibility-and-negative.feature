# language: tr
@accessibility @negative @live @mock @p1
Özellik: Erişilebilirlik ve negatif senaryolar
  Kritik ekranlarda form etiketleri, gezinme bağlantıları ve hata/boş durum mesajları erişilebilir ve açık olmalıdır.
  Bu özellik ayrıca uygulama güvenliği ve veri girişi sınırlarını (boundary) test eder.

  @s3 @a11y
  Senaryo: NEXA-UI-0501 - Giriş formu erişilebilir etiketler sunar
    Diyelim ki kullanıcı giriş sayfasını açtı
    Ne zaman form alanlarına bakarsa
    O zaman e-posta alanı etiketlidir
    Ve şifre alanı etiketlidir
    Ve giriş butonu anlaşılır bir ad taşır

  @s2 @rbac
  Senaryo: NEXA-UI-0502 - Ana gezinme bağlantıları rol bazlı olarak görünür
    Diyelim ki kullanıcı giriş yaptı
    Ne zaman ana uygulama kabuğu yüklenirse
    O zaman "Panel", "Projeler", "Test Koşuları" ve "Raporlar" bağlantıları görünür
    Ve kullanıcı rolüne göre yönetim bağlantıları ayrıca kontrol edilir

  @s0 @security
  Senaryo: NEXA-UI-0503 - Yetkisiz yönetim erişimi 403 sayfası gösterir
    Diyelim ki kullanıcı yönetici değil
    Ne zaman yönetim alanına gitmeye çalışırsa
    O zaman 403 sayfası açılır
    Ve "Ana Sayfaya Dön" butonu görünür

  @s1 @negative
  Senaryo: NEXA-UI-0504 - Olmayan proje adresi kullanıldığında bulunamadı ekranı görünür
    Diyelim ki kullanıcı geçersiz bir proje kimliği açıyor
    Ne zaman sayfa yüklenirse
    O zaman proje bulunamadı mesajı görünür
    Ve kullanıcı geçerli projelere geri dönebilir

  @s0 @rbac @security
  Senaryo: NEXA-UI-0505 - Yetkisiz kullanıcı doğrudan URL ile başka projenin detaylarına erişemez
    Diyelim ki "Kullanıcı A" sisteme giriş yapmıştır
    Ve "Kullanıcı A" sadece "Proje Alfa" projesine üyedir
    Ne zaman "Kullanıcı A" tarayıcıdan "/projects/beta-proje-uuid" adresine gitmeye çalışır
    O zaman "Erişim Reddedildi" veya 404 sayfası görüntülenir
    Ve başka bir projeye ait özel veriler yüklenmez

  @s0 @rbac @ai
  Senaryo: NEXA-UI-0506 - Proje üyesi olmayan kullanıcı AI servislerini tetikleyemez
    Diyelim ki "Kullanıcı B" sisteme giriş yapmıştır
    Ve "Kullanıcı B" "Proje Gamma" projesinde tanımlı değildir
    Ne zaman "Kullanıcı B" backend API üzerinden "/api/ai/generate-stories" endpoint'ine "Proje Gamma" ID'si ile istek gönderir
    O zaman sistem 403 Yasaklı (Forbidden) cevabı döndürür
    Ve AI hikaye üretimi başlatılmaz

  @s1 @validation @form
  Senaryo: NEXA-UI-0507 - Proje ismi minimum karakter sınırına uymalıdır
    Diyelim ki kullanıcı proje oluşturma ekranındadır
    Ne zaman kullanıcı proje ismi alanına "X" yazar ve "Oluştur"a basarsa
    O zaman "Proje ismi en az 3 karakter olmalıdır" uyarısı görünür

  @s2 @validation @file
  Senaryo: NEXA-UI-0508 - Güvenlik: Geçersiz dosya formatı yüklenemez
    Diyelim ki kullanıcı bir test sonucuna kanıt eklemek istemektedir
    Ne zaman kullanıcı "tehlikeli_dosya.exe" dosyasını seçerse
    O zaman "Sadece resim ve PDF dosyaları kabul edilir" uyarısı görünür

  @s1 @session @timeout
  Senaryo: NEXA-UI-0509 - Oturum süresi dolduğunda kullanıcı login sayfasına yönlendirilir
    Diyelim ki kullanıcının oturum süresi (session) arka planda sona ermiştir
    Ne zaman kullanıcı bir sayfayı yeniler veya veri göndermeye çalışırsa
    O zaman kullanıcı otomatik olarak giriş (login) sayfasına yönlendirilir
    Ve bir bilgilendirme mesajı gösterilir

  @s2 @ui @error_boundary
  Senaryo: NEXA-UI-0510 - API çökmesi durumunda hata arayüzü (Error Boundary) gösterilir
    Diyelim ki proje listesini getiren servis sunucu hatası (500) veriyor
    Ne zaman kullanıcı projeler sayfasını açarsa
    O zaman beyaz ekran yerine "Veriler yüklenemedi" hata arayüzü görüntülenir
    Ve "Yeniden Dene" butonu aktif olur
