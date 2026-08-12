# language: tr
@environments @p1
Özellik: Test Ortamları ve Konfigürasyon Yönetimi
  Testler farklı sunucu ve ortamlarda koşulur. Her ortamın kendine has değişkenleri ve güvenlik politikaları olmalıdır.

  @s1 @setup
  Senaryo: NEXA-UI-1701 - Yeni bir test ortamı (QA-02) tanımlama
    Diyelim ki kullanıcı "Ortam Yönetimi" sayfasındadır
    Ne zaman "Yeni Ortam" ekleyip adını "QA-02" ve türünü "QA" seçerse
    O zaman sistem bu ortamı listeye ekler
    Ve test koşusu oluşturulurken bu ortam seçilebilir hale gelir

  @s0 @security
  Senaryo: NEXA-UI-1702 - Üretim ortamı (PROD) için koruma kilidi
    Diyelim ki sistemde "PROD" isimli ve "isProduction: true" işaretli bir ortam mevcuttur
    Ne zaman kullanıcı bu ortamda bir test koşusu başlatmak isterse
    O zaman sistem "Bu bir canlı ortamdır! Onaylıyor musunuz?" uyarısı verir
    Ve ikinci bir şifre doğrulaması veya onay kutusu ister

  @s1 @variables
  Senaryo: NEXA-UI-1703 - Ortama özel değişken (Environment Variable) atama
    Diyelim ki "Staging" ortamı seçilidir
    Ne zaman kullanıcı bu ortama "BASE_URL = https://staging.nexa.com" değişkenini eklerse
    O zaman bu ortamda koşan tüm otomasyon senaryoları otomatik olarak bu URL'i kullanır

  @s2 @status
  Senaryo: NEXA-UI-1704 - Ortamın bakım moduna (Maintenance) alınması
    Diyelim ki "QA-01" sunucusu bakımdadır
    Ne zaman admin ortam durumunu "MAINTENANCE" olarak işaretlerse
    O zaman bu ortamda yeni test koşusu başlatılamaz
    Ve kullanıcılar "Bu ortam şu an kullanıma kapalıdır" uyarısı alır

  @s2 @history
  Senaryo: NEXA-UI-1705 - Ortam bazlı test geçmişi analizi
    Diyelim ki projede hem QA hem PROD ortamları mevcuttur
    Ne zaman kullanıcı "Ortam Karşılaştırma" raporunu açarsa
    O zaman "QA'de geçen ama PROD'da kalan" testlerin listesini görebilir
    Ve ortamlar arası kararlılık (Stability) oranını izleyebilir
