# language: tr
@wiki @versioning @matrix @p1
Özellik: Wiki İçerik Versiyonlama ve Veri Yaşam Döngüsü Matrisi
  Wiki sayfaları üzerinde yapılan her değişiklik versiyonlanmalı ve silinen sayfalar güvenli şekilde geri yüklenebilmelidir.

  @s2 @diff
  Senaryo Taslağı: NEXA-UI-4101 - Versiyonlar arası içerik farkı (Diff) analizi
    Diyelim ki bir wiki sayfasının "<v1_icerik>" ve "<v2_icerik>" sürümleri mevcuttur
    Ne zaman kullanıcı "Sürümleri Karşılaştır" butonuna basarsa
    O zaman sistem "<beklenen_fark>" bilgisini vurgulayarak gösterir

    Örnekler:
      | v1_icerik        | v2_icerik          | beklenen_fark       | aciklama               |
      | "Merhaba Dünya"  | "Merhaba Mars"     | "Mars" eklendi      | Tek kelime değişimi    |
      | "Eski Protokol"  | "" (Boş)           | Tüm metin silindi   | Tam içerik temizliği   |
      | "Madde 1"        | "Madde 1\nMadde 2" | "Madde 2" eklendi   | Satır ekleme           |

  @s0 @lifecycle
  Senaryo Taslağı: NEXA-UI-4102 - Wiki sayfası silme ve geri yükleme (Soft-Delete) akışı
    Diyelim ki kullanıcı bir wiki sayfasını "<islem>" yapmıştır
    O zaman sayfanın sistemdeki durumu "<yeni_durum>" olur

    Örnekler:
      | islem               | yeni_durum   | aciklama                        |
      | Arşivle (Soft)      | DELETED      | Listeden kalkar, DB'de durur    |
      | Geri Yükle (Restore)| APPROVED     | Eski haliyle tekrar yayına girer|
      | Kalıcı Sil (Hard)   | YOK          | Veritabanından tamamen temizlenir|

  @s1 @permission
  Senaryo Taslağı: NEXA-UI-4103 - WikiSpace bazlı yetki kısıtlamaları
    Diyelim ki "<rol>" rolündeki kullanıcı bir wiki alanına erişmektedir
    O zaman "<islem>" işlemi için sistem "<yetki_durumu>" sonucunu verir

    Örnekler:
      | rol           | islem           | yetki_durumu |
      | ADMIN         | Alanı Sil       | İzin Verildi |
      | TEAM_LEADER   | Alanı Düzenle   | İzin Verildi |
      | TESTER        | Alanı Sil       | Reddedildi   |
      | DEVELOPER     | Sayfa Onayla    | Reddedildi   |
      | PRODUCT_OWNER | Sayfa Düzenle   | İzin Verildi |
