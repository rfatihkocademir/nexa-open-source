# language: tr
@agile @matrix @p1
Özellik: Agile İş Öğeleri Statü Geçiş ve Hiyerarşi Matrisi
  Sistemdeki tüm iş öğesi türleri (Epic, Story, Task, Bug vb.) kendilerine özel izin verilen statü yollarını izlemelidir.

  @s1 @workflow
  Senaryo Taslağı: NEXA-UI-4001 - İş öğesi türüne göre izin verilen statü geçişleri
    Diyelim ki sistemde bir "<is_ogesi_turu>" mevcuttur ve durumu "<mevcut_statu>" halindedir
    Ne zaman kullanıcı durumu "<hedef_statu>" olarak değiştirmeye çalışırsa
    O zaman sistem bu işleme "<sonuc>" yanıtını verir

    Örnekler:
      | is_ogesi_turu | mevcut_statu | hedef_statu   | sonuc     | aciklama                    |
      | STORY         | TODO         | IN_PROGRESS   | Başarılı  | Standart akış               |
      | STORY         | TODO         | DONE          | Engellendi| Geliştirme yapılmadan bitmez|
      | BUG           | OPEN         | FIXED         | Başarılı  | Hata düzeltme               |
      | BUG           | OPEN         | CLOSED        | Engellendi| Önce fixed olmalı           |
      | EPIC          | DRAFT        | APPROVED      | Başarılı  | Planlama onayı              |
      | TASK          | TODO         | IN_PROGRESS   | Başarılı  | Görev başlangıcı            |
      | STORY         | IN_PROGRESS  | READY_FOR_QA  | Başarılı  | Teste gönderim              |
      | STORY         | QA           | DONE          | Başarılı  | Test onayı sonrası bitiş    |
      | BUG           | FIXED        | REOPENED      | Başarılı  | Hata tekrar ederse          |
      | TASK          | DONE         | TODO          | Başarılı  | Görev başa dönebilir        |

  @s2 @hierarchy
  Senaryo Taslağı: NEXA-UI-4002 - Hiyerarşik bağ kısıtlamaları matrisi
    Diyelim ki kullanıcı bir "<ust_oge>" altına "<alt_oge>" eklemek istemektedir
    O zaman sistem bu hiyerarşik bağı "<gecerlilik>" olarak değerlendirir

    Örnekler:
      | ust_oge | alt_oge | gecerlilik | aciklama                     |
      | EPIC    | STORY   | Gecerli    | Standart hiyerarşi           |
      | EPIC    | BUG     | Gecerli    | Epic bazlı hata takibi       |
      | STORY   | TASK    | Gecerli    | Hikaye detaylandırma         |
      | STORY   | BUG     | Gecerli    | Hikaye geliştirme hataları   |
      | TASK    | EPIC    | Gecersiz   | Ters hiyerarşi engellenmeli  |
      | STORY   | EPIC    | Gecersiz   | Ters hiyerarşi engellenmeli  |
      | BUG     | STORY   | Gecersiz   | Hata altına hikaye açılmaz   |
      | EPIC    | EPIC    | Gecersiz   | İç içe epic desteği yok      |

  @s1 @board
  Senaryo Taslağı: NEXA-UI-4003 - Kanban Board görünümünde kart renkleri ve öncelik yansıması
    Diyelim ki board üzerinde "<oncelik>" önceliğine sahip bir kart mevcuttur
    O zaman kartın yanındaki görsel gösterge "<renk>" renginde olur

    Örnekler:
      | oncelik  | renk    |
      | CRITICAL | Kırmızı |
      | HIGH     | Turuncu |
      | MEDIUM   | Mavi    |
      | LOW      | Gri     |
      | BLOCKER  | Siyah   |
