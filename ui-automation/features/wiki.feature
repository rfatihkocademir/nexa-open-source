# language: tr
@wiki @p1
Özellik: Bilgi Tabanı ve Wiki Yönetimi
  Wiki sayfaları projenin kurumsal hafızasını oluşturur. AI asistanı sadece onaylı sayfaları kaynak almalıdır.

  @s1 @happy_path
  Senaryo: NEXA-UI-0601 - Yeni bir wiki alanı (space) oluşturma
    Diyelim ki kullanıcı proje detay sayfasındadır
    Ne zaman "Yeni Wiki Alanı" butonuna basar ve "Teknik Dökümanlar" ismini verir
    O zaman yeni bir wiki alanı oluşturulur ve boş durum ekranı görünür

  @s1 @happy_path
  Senaryo: NEXA-UI-0602 - Wiki alanı içinde yeni sayfa oluşturma ve kaydetme
    Diyelim ki "Teknik Dökümanlar" isimli bir wiki alanı mevcuttur
    Ne zaman kullanıcı "Yeni Sayfa"ya basıp içerik girer ve "Taslak Olarak Kaydet"e basarsa
    O zaman sayfa "DRAFT" durumunda listelenir

  @s0 @governance
  Senaryo: NEXA-UI-0603 - Wiki sayfasının onaya gönderilmesi ve onaylanması
    Diyelim ki "DRAFT" durumunda bir wiki sayfası mevcuttur
    Ve kullanıcı TEAM_LEADER rolündedir
    Ne zaman kullanıcı sayfayı "Onayla" butonuna basarak onaylarsa
    O zaman sayfa durumu "APPROVED" olur
    Ve sayfa içeriği bilgi tabanına (Knowledge Base) senkronize edilir

  @s1 @ai @leakage
  Senaryo: NEXA-UI-0604 - Reddedilen wiki sayfası AI cevaplarında kaynak olarak kullanılamaz
    Diyelim ki "Eski Güvenlik Protokolü" sayfası "REVISE" (revizyon bekliyor) durumundadır
    Ne zaman kullanıcı AI'ya bu sayfa içeriğiyle ilgili soru sorarsa
    O zaman AI "Bu bilgi onaylanmamış veya güncelliğini yitirmiş olabilir, bu yüzden cevap veremiyorum" der
    Ve yanlış/eski bilgi asistan tarafından sunulmaz

  @s2 @traceability
  Senaryo: NEXA-UI-0605 - Wiki sayfası güncellendiğinde sürüm geçmişi (Artifact Revision) oluşur
    Diyelim ki "APPROVED" durumunda bir sayfa mevcuttur
    Ne zaman kullanıcı içeriği değiştirip tekrar kaydederse
    O zaman sayfa sürümü (version) artar
    Ve "Geçmiş" sekmesinde eski içeriklere erişim sağlanabilir

  @s1 @rbac
  Senaryo: NEXA-UI-0606 - TESTER rolündeki kullanıcı onaylı wiki sayfasını silemez
    Diyelim ki kullanıcı TESTER rolündedir
    Ve "Genel Kurallar" sayfası "APPROVED" durumundadır
    Ne zaman kullanıcı sayfa ayarlarına bakar
    O zaman "Sayfayı Sil" butonu görünmez veya pasif durumdadır

  @s2 @editor
  Senaryo: NEXA-UI-0607 - Wiki sayfasında Markdown editörü ve önizleme
    Diyelim ki kullanıcı sayfa düzenleme ekranındadır
    Ne zaman içerik alanına "# Başlık" yazar ve "Önizleme"ye basarsa
    O zaman metin H1 başlık formatında doğru şekilde render edilir

  @s2 @search
  Senaryo: NEXA-UI-0608 - Wiki sayfaları içinde anahtar kelime ile arama
    Diyelim ki içinde "Deployment" kelimesi geçen bir wiki sayfası mevcuttur
    Ne zaman kullanıcı wiki arama kutusuna "deploy" yazarsa
    O zaman ilgili sayfa sonuçlar arasında en üstte listelenir
