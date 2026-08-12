# language: tr
@automation @p1
Özellik: Otomasyon Kurucu ve Değişken Yönetimi
  Kullanıcılar manuel test adımlarını otomatize edebilmeli ve dinamik değişkenler kullanarak esnek senaryolar oluşturabilmelidir.

  @s1 @builder
  Senaryo: NEXA-UI-1301 - Sürükle-bırak ile otomasyon adımı ekleme
    Diyelim ki kullanıcı "Otomasyon Kurucu" ekranındadır
    Ne zaman "Adım Kütüphanesi"nden "Tıklama" (Click) işlemini senaryo alanına sürüklerse
    O zaman yeni bir otomasyon adımı oluşur
    Ve locator (konumlandırıcı) giriş alanı aktifleşir

  @s1 @variables
  Senaryo: NEXA-UI-1302 - Senaryo düzeyinde değişken tanımlama ve kullanma
    Diyelim ki kullanıcı bir otomasyon senaryosu düzenlemektedir
    Ne zaman "Değişkenler" sekmesinde "APP_URL" isminde bir değer tanımlarsa
    O zaman otomasyon adımlarında bu değeri "${APP_URL}" formatında kullanabilir
    Ve sistem bu kullanımı geçerli (valid) olarak işaretler

  @s0 @dry_run
  Senaryo: NEXA-UI-1303 - Otomasyon senaryosunu "Dry-Run" (Ön İzleme) ile test etme
    Diyelim ki kullanıcı bir otomasyon senaryosu hazırlamıştır
    Ne zaman "Dry-Run" butonuna basarsa
    O zaman sistem arka planda bir tarayıcı başlatır
    Ve adımları tek tek denerken kullanıcıya anlık durum (Başarılı/Hata) raporu sunar

  @s2 @step_library
  Senaryo: NEXA-UI-1304 - Özel otomasyon adımı (Custom Step) oluşturma
    Diyelim ki projede sık tekrarlanan bir "Giriş Yap" akışı mevcuttur
    Ne zaman kullanıcı 3 adımı seçip "Grup Olarak Kaydet" derse
    O zaman bu grup "Özel Adım" olarak kütüphaneye eklenir
    Ve diğer senaryolarda tek bir adım gibi çağrılabilir

  @s1 @selectors
  Senaryo: NEXA-UI-1305 - Akıllı Seçici (Smart Selector) ile element doğrulama
    Diyelim ki kullanıcı bir element için CSS selector girmiştir
    Ne zaman "Elementi Doğrula" butonuna basarsa
    O zaman sistem hedef sayfada o elementi bulup yeşil çerçeve içine alır
    Ve element bulunamazsa "Hata: Element görünür değil" uyarısı verir

  @s2 @versioning
  Senaryo: NEXA-UI-1306 - Otomasyon senaryosu versiyonlama ve geri dönme
    Diyelim ki bir otomasyon senaryosu güncellenmiştir
    Ne zaman yeni hali hatalı çalışırsa
    O zaman kullanıcı "Geçmiş" sekmesinden önceki çalışan versiyonu seçip "Geri Yükle" diyebilir
    Ve senaryo eski haline başarıyla döner

  @s1 @parameters
  Senaryo: NEXA-UI-1307 - Veri Odaklı Test (Data-Driven Test): CSV ile toplu koşu
    Diyelim ki kullanıcı bir otomasyon senaryosu hazırlamıştır
    Ne zaman "Veri Kaynağı" olarak bir CSV dosyası (50 satırlık kullanıcı verisi) yüklerse
    O zaman sistem her bir satır için senaryoyu farklı verilerle tekrar koşturur
    Ve toplu bir sonuç raporu üretir

  @s0 @security
  Senaryo: NEXA-UI-1308 - Gizli değişkenlerin (Secrets) maskelenmesi
    Diyelim ki kullanıcı "DB_PASSWORD" isminde bir değişken tanımlamıştır
    Ne zaman bu değişkenin türünü "Secret" (Gizli) olarak işaretlerse
    O zaman değer ekranda "****" olarak maskelenir
    Ve loglarda veya raporlarda açık metin olarak asla görünmez
