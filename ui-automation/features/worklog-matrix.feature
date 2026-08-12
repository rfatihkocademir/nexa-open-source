# language: tr
@worklog @time_tracking @matrix @p1
Özellik: İş Öğelerinde Zaman Takibi ve Efor (Worklog) Yönetimi
  Kullanıcılar iş kalemleri üzerinde harcadıkları zamanı dakika bazında girebilmeli ve yöneticiler efor raporu alabilmelidir.

  @s1 @logging
  Senaryo Taslağı: NEXA-UI-4401 - Farklı zaman formatlarında efor girişi
    Diyelim ki kullanıcı bir WorkItem detay sayfasındadır
    Ne zaman "Efor Gir" butonuna basıp süre olarak "<zaman_girdisi>" yazarsa
    O zaman sistem bu süreyi "<kaydedilen_dakika>" dakika olarak veritabanına kaydeder

    Örnekler:
      | zaman_girdisi | kaydedilen_dakika | aciklama                     |
      | 2h 30m        | 150               | Saat ve dakika birleşik      |
      | 1d            | 480               | 1 İş Günü (8 saat = 480m)    |
      | 45m           | 45                | Sadece dakika                |
      | 1w 2d         | 2880              | 1 Hafta (5G) + 2 Gün         |
      | -1h           | Hata              | Negatif değer girilemez      |
      | abc           | Hata              | Geçersiz format              |

  @s2 @edit_delete
  Senaryo Taslağı: NEXA-UI-4402 - Worklog güncelleme ve silme (Soft Delete) yetkisi
    Diyelim ki sistemde "User A" tarafından girilmiş bir Worklog mevcuttur
    O zaman "<rol>" rolündeki "<aktif_kullanici>", bu Worklog üzerinde "<islem>" işlemi yaptığında "<sonuc>" alır

    Örnekler:
      | rol           | aktif_kullanici | islem        | sonuc     |
      | DEVELOPER     | User A          | Kendi logunu Düzenle | Başarılı  |
      | DEVELOPER     | User A          | Kendi logunu Sil     | Başarılı  |
      | DEVELOPER     | User B          | Başkasının logunu Düzenle | Reddedildi|
      | TEAM_LEADER   | User B          | Başkasının logunu Sil     | Başarılı  |

  @s1 @reporting
  Senaryo: NEXA-UI-4403 - Bir Sprint içindeki toplam eforun hesaplanması
    Diyelim ki bir Sprint içinde toplam 10 farklı Worklog girilmiştir
    Ne zaman Team Leader "Sprint Raporu"nu açarsa
    O zaman "Gerçekleşen Efor" (Time Spent) alanı, girilen tüm logların toplamını saat bazında hatasız gösterir
