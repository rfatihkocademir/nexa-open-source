# language: tr
@prompt_engineering @ai @matrix @p1
Özellik: AI Prompt Şablonları (Templates) ve Versiyonlama Matrisi
  Admin kullanıcılar, AI motoruna gönderilen prompt şablonlarını güncelleyebilmeli ve geçmiş versiyonlara dönebilmelidir.

  @s0 @prompt
  Senaryo Taslağı: NEXA-UI-4601 - Prompt şablonu (PromptTemplate) güncelleme ve test etme
    Diyelim ki sistemde "<hedef_tip>" için bir prompt şablonu mevcuttur
    Ne zaman admin "Ayarlar > AI Promptlar" sayfasında şablonu "<yeni_icerik>" olarak güncellerse
    O zaman sistem bu güncellemeyi "<sonuc>" olarak kaydeder

    Örnekler:
      | hedef_tip        | yeni_icerik                | sonuc       | aciklama                    |
      | Test Case Uretimi| "Lütfen BDD formatında yaz"| Başarılı    | Geçerli içerik güncellenir  |
      | Bug Raporu Ozeti | "" (Boş bırakıldı)         | Hata        | Şablon boş olamaz           |
      | Release Analizi  | "Sadece JSON dön: {}"      | Başarılı    | JSON çıktı formatı zorlama  |

  @s1 @versioning
  Senaryo: NEXA-UI-4602 - Prompt şablonunda önceki versiyona dönme (Rollback)
    Diyelim ki "Test Case Üretimi" şablonunun 3 farklı versiyonu (V1, V2, V3) mevcuttur
    Ve şu anki aktif versiyon V3'tür
    Ne zaman admin V1'i seçip "Aktif Yap" butonuna basarsa
    O zaman sistemin AI motoru artık yeni işlemlerde V1 içeriğini kullanır
    Ve V3 arşivlenir
