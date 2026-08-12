# language: tr
@fault_injection @robustness @p1
Özellik: Hata Enjeksiyonu ve Sistem Dayanıklılığı
  Uygulama, backend hataları veya ağ kesintileri durumunda kullanıcıyı doğru bilgilendirmeli ve veri kaybını önlemelidir.

  @s1 @network
  Senaryo: NEXA-UI-1901 - İnternet kesintisi durumunda "Çevrimdışı" uyarısı
    Diyelim ki kullanıcı uygulama içinde aktif bir işlem yapmaktadır
    Ne zaman ağ bağlantısı kesilirse
    O zaman ekranın üst kısmında "Bağlantı kesildi, çevrimdışı moddasınız" uyarısı belirir
    Ve veri gönderen butonlar (Kaydet, Gönder) geçici olarak pasifleşir

  @s1 @api_error
  Senaryo: NEXA-UI-1902 - API 503 (Service Unavailable) durumunda Retry butonu
    Diyelim ki backend sunucusu bakım modundadır ve 503 hatası döndürmektedir
    Ne zaman kullanıcı bir sayfayı açmaya çalışırsa
    O zaman "Sistem şu an meşgul, lütfen birazdan tekrar deneyin" mesajı gösterilir
    Ve kullanıcıya "Yeniden Dene" (Retry) butonu sunulur

  @s2 @api_error
  Senaryo: NEXA-UI-1903 - API 429 (Too Many Requests) - Rate Limit uyarısı
    Diyelim ki kullanıcı çok kısa sürede çok fazla istek atmıştır
    Ne zaman API 429 hatası döndürürse
    O zaman kullanıcıya "Çok fazla istek gönderdiniz, lütfen 1 dakika bekleyin" uyarısı verilir
    Ve sistem geçici olarak işlemleri durdurur

  @s0 @data_loss
  Senaryo: NEXA-UI-1904 - Form doldururken sayfa yenilenirse verilerin korunması (Draft Persistence)
    Diyelim ki kullanıcı uzun bir test case açıklaması yazmaktadır
    Ne zaman kullanıcı yanlışlıkla sayfayı yenilerse
    O zaman sistem "Kaydedilmemiş değişiklikleriniz var, ayrılmak istediğinize emin misiniz?" uyarısı verir
    Veya veriyi yerel hafızadan (Local Storage) geri yükler

  @s1 @api_error
  Senaryo: NEXA-UI-1905 - API 413 (Payload Too Large) - Dosya boyutu sınırı
    Diyelim ki kullanıcı 100MB'lık bir video yüklemeye çalışmaktadır
    Ne zaman sunucu "Payload Too Large" hatası döndürürse
    O zaman UI bu teknik hatayı "Yüklediğiniz dosya sistem sınırlarını aşıyor" şeklinde kullanıcıya açıklar

  @s2 @slow_network
  Senaryo: NEXA-UI-1906 - Yavaş ağ (Slow Network) durumunda yükleme göstergeleri
    Diyelim ki ağ hızı 3G seviyesine düşürülmüştür
    Ne zaman kullanıcı raporlar sayfasını açarsa
    O zaman grafik alanlarında "Skeleton Loader" veya "Spinner" sürekli görünür
    Ve kullanıcı verinin hala yüklendiğini anlar (Ekran donmaz)

  @s1 @auth_failure
  Senaryo: NEXA-UI-1907 - Yetki token'ı çalınırsa veya geçersiz kılınırsa anında çıkış
    Diyelim ki kullanıcının JWT token'ı backend tarafından iptal edilmiştir
    Ne zaman kullanıcı bir API isteği atarsa (401 Unauthorized)
    O zaman kullanıcı "Oturumunuz geçersiz" uyarısı ile anında giriş sayfasına yönlendirilir
    Ve bellekteki (Redux/Context) kullanıcı verileri temizlenir
