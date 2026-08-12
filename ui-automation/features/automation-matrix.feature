# language: tr
@automation @matrix @p1
Özellik: Otomasyon Adımları ve Değişken Kapsamı Matrisi
  Otomasyon senaryoları; sistem, proje ve senaryo düzeyindeki değişkenleri doğru hiyerarşiyle kullanabilmelidir.

  @s2 @variables
  Senaryo Taslağı: NEXA-UI-4301 - Değişken çakışması ve hiyerarşi önceliği
    Diyelim ki "BASE_URL" değişkeni hem "<seviye_1>" hem de "<seviye_2>" düzeyinde tanımlıdır
    Ne zaman otomasyon senaryosu çalıştırılırsa
    O zaman sistem "<oncelikli_deger>" değerini kullanır

    Örnekler:
      | seviye_1 | seviye_2 | oncelikli_deger | aciklama                       |
      | Sistem   | Proje    | Proje Değeri    | Proje sistem değerini ezer     |
      | Proje    | Senaryo  | Senaryo Değeri  | Senaryo proje değerini ezer    |
      | Senaryo  | Ortam    | Ortam Değeri    | Ortam (QA/Prod) en önceliklidir|

  @s1 @step_types
  Senaryo Taslağı: NEXA-UI-4302 - Farklı otomasyon adımı tiplerinin doğrulanması
    Diyelim ki kullanıcı otomasyon kurucusunda bir "<adim_tipi>" eklemiştir
    O zaman bu adım için "<zorunlu_alan>" girişi yapılması gerekir

    Örnekler:
      | adim_tipi     | zorunlu_alan | aciklama                     |
      | Tıklama       | Locator      | Buton/Link seçimi            |
      | Metin Yazma   | Değer (Value)| Input verisi                 |
      | Bekleme       | Süre (ms)    | Statik bekleme               |
      | Kontrol (Assert)| Beklenen Veri| Doğrulama kriteri            |
      | Sayfaya Git   | URL          | Navigasyon                   |

  @s3 @error_handling
  Senaryo Taslağı: NEXA-UI-4303 - Otomasyon hata modları ve kurtarma (Recovery)
    Diyelim ki bir otomasyon adımı "<hata_turu>" nedeniyle başarısız olmuştur
    O zaman sistem "<aksiyon>" tepkisini verir

    Örnekler:
      | hata_turu        | aksiyon                 | aciklama                    |
      | Element Bulunamadı| Senaryoyu Durdur        | Kritik hata                 |
      | Timeout          | Yeniden Dene (Retry 3x) | Ağ/Yüklenme gecikmesi       |
      | Assert Fail      | Hata Logu Kaydet        | Beklenen sonuç uyuşmazlığı  |
