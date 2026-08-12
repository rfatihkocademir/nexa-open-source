# language: tr
@ai @quality @matrix @p1
Özellik: AI Yanıt Kalitesi ve İçerik Üretim Matrisi
  AI motoru; iş taleplerinden (Business Request) anlamlı ve test edilebilir hikayeler/adımlar üretebilmelidir.

  @s1 @generation
  Senaryo Taslağı: NEXA-UI-3001 - İş talebinden Story üretim kalitesi
    Diyelim ki kullanıcı "<talep_turu>" içeriğine sahip bir iş talebi girmiştir
    Ne zaman AI analiz butonuna basarsa
    O zaman AI "<beklenen_epic_sayisi>" adet Epic ve "<beklenen_story_sayisi>" adet Story önerir

    Örnekler:
      | talep_turu           | beklenen_epic_sayisi | beklenen_story_sayisi | aciklama                 |
      | "Login ekranı yap"   | 1                    | 3-5                   | Basit talep              |
      | "E-ticaret sistemi"  | 5+                   | 20+                   | Karmaşık kurumsal talep  |
      | "Şifremi unuttum"    | 1                    | 2                     | Spesifik fonksiyon       |
      | "asdfghjkl" (Anlamsız)| 0                   | 0                     | Geçersiz/Anlamsız girdi  |
      | "" (Boş)             | 0                    | 0                     | Boş girdi                |

  @s1 @test_design
  Senaryo Taslağı: NEXA-UI-3002 - Story'den test case üretimi ve adım doğruluğu
    Diyelim ki AI'ya "<story_basligi>" içeriği verilmiştir
    Ne zaman "Test Case Üret" denirse
    O zaman üretilen test adımları "<kritik_adim>" işlemini mutlaka içermelidir

    Örnekler:
      | story_basligi       | kritik_adim                | aciklama               |
      | Kullanıcı girişi    | "Şifre girilir"            | Temel akış doğruluğu   |
      | Profil güncelleme   | "Kaydet butonuna basılır"  | Aksiyon doğruluğu      |
      | Ürün arama          | "Arama sonuçları listelenir"| Beklenen sonuç kontrolü|
      | Sepete ekleme       | "Sepet sayacı artar"       | Durum kontrolü         |

  @s2 @summarization
  Senaryo Taslağı: NEXA-UI-3003 - Bug raporu özetleme ve AI analiz güven oranı
    Diyelim ki sistemde karmaşık bir hata logu (Stack Trace) mevcuttur
    Ne zaman AI bu hatayı analiz ederse
    O zaman kullanıcıya sunulan "Güven Oranı" (Confidence Score) %<min_score> üzerinde olmalıdır

    Örnekler:
      | hata_turu            | min_score | aciklama                       |
      | Database Connection  | 90        | Net hata kaynağı               |
      | Null Pointer         | 80        | Kod bazlı hata                 |
      | UI Rendering Error   | 70        | Görsel/CSS hatası              |
      | Unknown Network      | 50        | Belirsiz/Karmaşık dış kaynak   |
