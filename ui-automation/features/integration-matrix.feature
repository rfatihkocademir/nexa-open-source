# language: tr
@integrations @notifications @matrix @p1
Özellik: Entegrasyon Olayları ve Bildirim Tetikleme Matrisi
  Sistemdeki her kritik olay (Event), yapılandırılmış olan dış sistemlere (Slack, Jira vb.) doğru formatta iletilmelidir.

  @s1 @slack
  Senaryo Taslağı: NEXA-UI-4201 - Slack kanalına giden anlık bildirimlerin içeriği
    Diyelim ki sistemde bir "<olay>" gerçekleşmiştir
    Ne zaman Slack entegrasyonu tetiklenirse
    O zaman Slack mesajı "<beklenen_anahtar_kelime>" bilgisini mutlaka içermelidir

    Örnekler:
      | olay                 | beklenen_anahtar_kelime | aciklama                     |
      | Test Koşusu Fail     | "FAILED"                | Hata durum bildirimi         |
      | Kritik Bug Açıldı    | "CRITICAL"              | Öncelikli hata bildirimi     |
      | Sürüm Onaylandı      | "READY"                 | Release hazır bildirimi      |
      | Yeni Üye Daveti      | "Davet Edildi"          | Organizasyonel bildirim      |

  @s2 @jira
  Senaryo Taslağı: NEXA-UI-4202 - Jira Issue senkronizasyon matrisi
    Diyelim ki Nexa üzerinde bir "<nexa_tipi>" oluşturulmuştur
    O zaman Jira tarafında oluşan kaydın tipi "<jira_tipi>" olur

    Örnekler:
      | nexa_tipi | jira_tipi | aciklama              |
      | BUG       | Bug       | Hata eşleşmesi        |
      | STORY     | Story     | Hikaye eşleşmesi      |
      | EPIC      | Epic      | Hiyerarşi eşleşmesi   |
      | TASK      | Task      | Görev eşleşmesi       |

  @s1 @email
  Senaryo Taslağı: NEXA-UI-4203 - E-posta bildirimlerinin rol bazlı dağıtımı
    Diyelim ki "<olay>" gerçekleşmiştir
    O zaman sistem "<alici_rolu>" rolündeki kullanıcılara e-posta gönderir

    Örnekler:
      | olay                  | alici_rolu    | aciklama                        |
      | Şifre Sıfırlama       | Kullanıcının Kendisi | Güvenlik akışı            |
      | Yeni Proje Oluşturma  | ADMIN         | Sistem izleme                   |
      | Test Ataması          | TESTER        | Görev ataması                   |
      | Sürüm Onay Bekliyor   | PRODUCT_OWNER | Karar verici bildirimi          |
