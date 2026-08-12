# language: tr
@requirements @traceability @matrix @p1
Özellik: Gereksinim Yönetimi ve RTM (Requirements Traceability Matrix)
  Kullanıcılar iş kurallarını (Requirements) tanımlayabilmeli, onaylayabilmeli ve testlerle doğrudan bağlayabilmelidir.

  @s1 @workflow
  Senaryo Taslağı: NEXA-UI-4701 - Gereksinim statü geçişleri ve kısıtlamalar
    Diyelim ki sistemde "<mevcut_statu>" durumunda bir "Business Requirement" (İş Gereksinimi) mevcuttur
    Ne zaman kullanıcı gereksinim durumunu "<hedef_statu>" olarak değiştirmek isterse
    O zaman işlem sonucu "<sonuc>" olur

    Örnekler:
      | mevcut_statu | hedef_statu | sonuc      | aciklama                   |
      | DRAFT        | IN_REVIEW   | Başarılı   | İncelemeye gönderim        |
      | IN_REVIEW    | APPROVED    | Başarılı   | Onaylama                   |
      | APPROVED     | DRAFT       | Başarılı   | Revizyon ihtiyacı          |
      | DRAFT        | APPROVED    | Engellendi | İncelemeden geçmeli        |
      | APPROVED     | ARCHIVED    | Başarılı   | Geçerliliğini yitirme      |

  @s0 @traceability
  Senaryo Taslağı: NEXA-UI-4702 - Gereksinim değişiminin (Stale) bağlı öğelere etkisi
    Diyelim ki "REQ-101" kodlu onaylı bir gereksinim, "<bagli_oge>" türündeki bir kayda bağlanmıştır
    Ne zaman REQ-101'in içeriği (açıklaması) güncellenirse
    O zaman bağlı öğenin etki durumu (Impact Status) "<etki_durumu>" olarak değişir

    Örnekler:
      | bagli_oge  | etki_durumu | aciklama                       |
      | Test Case  | STALE       | Test senaryosu eski kalır      |
      | WorkItem   | IMPACTED    | İş öğesinin kapsamı değişir    |
      | Test Run   | CLEAN       | Geçmiş koşular etkilenmez      |

  @s2 @types
  Senaryo: NEXA-UI-4703 - Farklı türde gereksinimlerin (Security, Performance) filtrelenmesi
    Diyelim ki projede "SECURITY" ve "UI" tiplerinde 20'şer gereksinim vardır
    Ne zaman kullanıcı "Sadece Güvenlik (Security) Gereksinimlerini Listele" derse
    O zaman ekranda sadece 20 adet güvenlik maddesi görünür
