# language: tr
@user_management @rbac @p1
Özellik: Kullanıcı Yönetimi, Roller ve Profil Güvenliği
  Sistem yöneticileri kullanıcıları yönetebilmeli, kullanıcılar ise kendi profillerini güvenli şekilde güncelleyebilmelidir.

  @s0 @admin @invite
  Senaryo: NEXA-UI-1101 - Yeni kullanıcı davet etme ve rol atama
    Diyelim ki bir ADMIN kullanıcı "Kullanıcı Yönetimi" sayfasındadır
    Ne zaman "Yeni Kullanıcı" butonuna basıp e-posta ve "DEVELOPER" rolü girerse
    O zaman sisteme yeni bir kullanıcı kaydı eklenir
    Ve kullanıcıya aktivasyon e-postası gönderildiği bilgisi verilir

  @s1 @admin @status
  Senaryo: NEXA-UI-1102 - Kullanıcıyı pasif duruma çekme (Deactivation)
    Diyelim ki sistemde aktif bir kullanıcı mevcuttur
    Ne zaman admin bu kullanıcının durumunu "Inactive" (Pasif) yaparsa
    O zaman ilgili kullanıcı artık sisteme giriş yapamaz
    Ve "Hesabınız dondurulmuştur" uyarısı alır

  @s1 @profile @avatar
  Senaryo: NEXA-UI-1103 - Profil fotoğrafı güncelleme ve validasyon
    Diyelim ki kullanıcı "Profilim" sayfasındadır
    Ne zaman kullanıcı "Avatar Değiştir" diyerek 5MB'dan büyük bir dosya yüklemeye çalışırsa
    O zaman "Dosya boyutu çok büyük (Maksimum 2MB)" uyarısı alır
    Ve yükleme engellenir

  @s1 @security @password
  Senaryo: NEXA-UI-1104 - Şifre değiştirme: Mevcut şifre doğrulaması
    Diyelim ki kullanıcı şifresini değiştirmek istemektedir
    Ne zaman "Mevcut Şifre" alanına yanlış bir değer girerse
    O zaman "Mevcut şifreniz hatalı" uyarısı görünür
    Ve şifre güncellenmez

  @s2 @notifications
  Senaryo: NEXA-UI-1105 - Bildirim ayarlarını özelleştirme
    Diyelim ki kullanıcı bildirim sayfasındadır
    Ne zaman "E-posta bildirimlerini kapat" seçeneğini işaretleyip kaydederse
    O zaman sistem artık o kullanıcıya kritik olaylarda e-posta göndermez
    Ve sadece uygulama içi (In-app) bildirimler devam eder

  @s0 @rbac @bypass
  Senaryo: NEXA-UI-1106 - Yetkisiz kullanıcının Admin ayarlarına erişim denemesi (URL Injection)
    Diyelim ki giriş yapmış kullanıcı TESTER rolündedir
    Ne zaman kullanıcı tarayıcıya doğrudan "/admin/settings" yazarsa
    O zaman sistem 403 erişim reddedildi hatası gösterir
    Ve admin menüleri yüklenmez

  @s1 @profile @audit_log
  Senaryo: NEXA-UI-1107 - Profil bilgilerinin güncellenmesinin Audit Log'a yansıması
    Diyelim ki kullanıcı ismini "Ahmet"ten "Mehmet"e çevirmiştir
    O zaman "Audit Log" (Denetim Kaydı) sayfasında "Kullanıcı profili güncellendi: Ad Ahmet -> Mehmet" kaydı oluşur

  @s1 @rbac @developer
  Senaryo: NEXA-UI-1108 - DEVELOPER rolü test case okuyabilir ama durumu "APPROVED" yapamaz
    Diyelim ki kullanıcı DEVELOPER rolündedir
    Ne zaman bir test case detay sayfasını açarsa
    O zaman içeriği görebilir
    Ancak "Durumu Değiştir > APPROVED" seçeneği pasif görünür veya hata verir

  @s1 @rbac @product_owner
  Senaryo: NEXA-UI-1109 - PRODUCT_OWNER rolü iş taleplerini onaylayabilir
    Diyelim ki kullanıcı PRODUCT_OWNER rolündedir
    Ne zaman bir "Business Request" detay sayfasını açarsa
    O zaman "Onayla" ve "Analiz Et" butonları aktif olarak görünür
    Ve talebin durumunu "APPROVED" yapabilir

  @s2 @rbac @read_only
  Senaryo: NEXA-UI-1110 - ANALYST rolü sadece raporları izleyebilir (Read-only Access)
    Diyelim ki kullanıcı ANALYST rolündedir
    Ne zaman dashboard veya raporları açarsa verileri görebilir
    Ancak "Projeyi Sil" veya "Yeni Kullanıcı Ekle" gibi aksiyon butonları gizlenir
