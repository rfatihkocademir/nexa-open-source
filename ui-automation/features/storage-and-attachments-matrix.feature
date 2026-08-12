# language: tr
@storage @attachments @matrix @p1
Özellik: Güvenli Dosya Depolama (MinIO) ve Ek Yönetimi (Attachments)
  Kullanıcıların yüklediği her türlü görsel, rapor ve kanıt dosyası sistemde güvenli ve erişilebilir şekilde depolanmalıdır.

  @s1 @upload_types
  Senaryo Taslağı: NEXA-UI-5001 - Desteklenen dosya kategorilerine (Category) göre yükleme
    Diyelim ki kullanıcı bir "Dosya Yükle" penceresindedir
    Ne zaman yükleme tipi "<kategori>" olarak seçilirse
    O zaman sistem bu dosyanın "<maksimum_boyut>" limitini uygular ve veritabanına bu türle kaydeder

    Örnekler:
      | kategori         | maksimum_boyut | aciklama                       |
      | PROJECT_LOGO     | 2 MB           | Proje ayarlarında kullanılır   |
      | AVATAR           | 2 MB           | Profil resminde kullanılır     |
      | TEST_EVIDENCE    | 50 MB          | Koşu sonuçlarındaki kanıtlar   |
      | AUTOMATION_VIDEO | 500 MB         | Otomasyonun ekran kayıtları    |
      | WIKI_IMAGE       | 10 MB          | Dokümantasyon içi görseller    |

  @s0 @security
  Senaryo Taslağı: NEXA-UI-5002 - Dosya indirme (Download) yetki denetimi
    Diyelim ki sistemde "MinIO" üzerinde saklanan bir "Gizli Proje Sözleşmesi.pdf" mevcuttur
    Ne zaman "<rol>" rolündeki bir kullanıcı "Download" API'sine istek atarsa
    O zaman sistem "<sonuc>" yanıtını döndürür

    Örnekler:
      | rol         | sonuc     | aciklama                        |
      | ADMIN       | Dosya     | Sistem yetkisi                  |
      | PROJE_UYESI | Dosya     | Üye kendi projesindeki dosyayı görür |
      | DIS_KULLANICI| 403 Hata  | Başka projenin dosyasına erişemez |
      | ANONIM      | 401 Hata  | Giriş yapmayan kullanıcı dosya indiremez|
