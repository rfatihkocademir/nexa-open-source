# language: tr
@rbac @security @matrix @p1
Özellik: Rol Bazlı Erişim Denetimi (RBAC) Yetki Matrisi
  Sistemdeki her rolün sadece kendi yetki alanındaki işlemleri yapabildiği, diğer işlemleri ise yapamadığı garanti edilmelidir.

  @s0 @critical
  Senaryo Taslağı: NEXA-UI-2801 - Rol bazlı kritik aksiyon yetki matrisi
    Diyelim ki sisteme "<rol>" rolündeki kullanıcı ile giriş yapılmıştır
    Ne zaman kullanıcı "<islem>" işlemini yapmaya çalışırsa
    O zaman sistem bu işleme "<sonuc>" verir

    Örnekler:
      | rol           | islem                        | sonuc     | aciklama                        |
      | ADMIN         | Projeyi Sil                  | Başarılı  | Admin her şeyi yapabilir        |
      | ADMIN         | Kullanıcı Davet Et           | Başarılı  | Admin her şeyi yapabilir        |
      | TEAM_LEADER   | Projeyi Sil                  | Engellendi| Proje silme sadece Admin yetkisi|
      | TEAM_LEADER   | Test Case Onayla             | Başarılı  | TL testleri onaylayabilir       |
      | TESTER        | Test Case Onayla             | Engellendi| Tester sadece PENDING yapabilir |
      | TESTER        | Test Koşusu Başlat           | Başarılı  | Tester'ın ana görevi            |
      | DEVELOPER     | Test Case Düzenle            | Engellendi| Dev sadece okuma yetkisine sahip|
      | DEVELOPER     | Bug Kapat                    | Başarılı  | Dev hatayı düzeltebilir         |
      | PRODUCT_OWNER | Sürüm Onayla (Release)       | Başarılı  | PO sürümden sorumludur          |
      | PRODUCT_OWNER | Test Adımı Ekle              | Engellendi| PO içerik detayına girmez       |
      | ANALYST       | Raporları Görüntüle          | Başarılı  | Analyst verileri izler          |
      | ANALYST       | Yeni Proje Oluştur           | Engellendi| Analyst proje yaratamaz         |
      | SCRUM_MASTER  | Sprint Başlat                | Başarılı  | SM süreçten sorumludur          |
      | SCRUM_MASTER  | Otomasyon Scripti Yaz        | Engellendi| SM teknik kod yazmaz            |

  @s1 @visibility
  Senaryo Taslağı: NEXA-UI-2802 - Rol bazlı menü ve buton görünürlük matrisi
    Diyelim ki "<rol>" rolündeki kullanıcı ana sayfayı açmıştır
    O zaman kullanıcı arayüzünde "<eleman>" öğesi "<gorunurluk>" durumundadır

    Örnekler:
      | rol           | eleman                   | gorunurluk | aciklama                       |
      | ADMIN         | Admin Paneli Menüsü      | Görünür    | Admin girişi                   |
      | TESTER        | Admin Paneli Menüsü      | Gizli      | Tester admin menüsünü görmez   |
      | PRODUCT_OWNER | Sürüm Onay Butonu        | Görünür    | PO yetkisi                     |
      | DEVELOPER     | Sürüm Onay Butonu        | Gizli      | Dev yetkisi yok                |
      | ANALYST       | Raporlar Menüsü          | Görünür    | Analiz yetkisi                 |
      | TEAM_LEADER   | Üye Ekle Butonu          | Görünür    | TL üye yönetebilir             |
      | TESTER        | Üye Ekle Butonu          | Gizli      | Tester üye yönetemez           |
      | ADMIN         | Tüm Projeler Portfolyosu | Görünür    | Global izleme                  |

  @s0 @cross_project
  Senaryo Taslağı: NEXA-UI-2803 - Proje bazlı izolasyon (Cross-Project) matrisi
    Diyelim ki kullanıcı "Proje A" üyesidir ancak "Proje B" üyesi değildir
    Ne zaman kullanıcı "Proje B" altındaki "<kaynak>" kaynağına erişmeye çalışırsa
    O zaman sistem "<hata_kodu>" döndürür

    Örnekler:
      | kaynak            | hata_kodu    | aciklama                       |
      | /test-cases       | 403 Forbidden| Başka projenin testlerini görme|
      | /test-runs        | 403 Forbidden| Başka projenin koşularını görme|
      | /wiki             | 403 Forbidden| Başka projenin wikisini görme  |
      | /agile-board      | 403 Forbidden| Başka projenin boardunu görme  |
      | /settings         | 403 Forbidden| Başka projenin ayarlarını görme|
      | /audit-logs       | 403 Forbidden| Başka projenin loglarını görme |
