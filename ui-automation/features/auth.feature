# language: tr
@smoke @live @mock @p1
Özellik: Gelişmiş Giriş, Yetkilendirme ve Güvenlik Yönetimi
  Kullanıcı erişimi çok aşamalı güvenlik, hesap koruma ve oturum yönetimi standartlarına uygun olmalıdır.

  Arka Plan:
    Diyelim ki kullanıcı giriş sayfasındadır.

  @s1 @mfa
  Senaryo: NEXA-UI-2401 - İki Aşamalı Doğrulama (MFA) ile giriş
    Diyelim ki kullanıcının hesabında MFA aktiftir
    Ne zaman geçerli e-posta ve şifresini girerse
    O zaman "6 haneli doğrulama kodunu giriniz" ekranı açılır
    Ve doğru kod girildiğinde "/dashboard" sayfasına yönlendirilir

  @s2 @mfa @failure
  Senaryo: NEXA-UI-2402 - Hatalı MFA kodu ile girişin reddedilmesi
    Diyelim ki kullanıcı MFA doğrulama ekranındadır
    Ne zaman "000000" (yanlış kod) girerse
    O zaman "Doğrulama kodu geçersiz" uyarısı görünür
    Ve oturum açılmaz

  @s1 @lockout
  Senaryo: NEXA-UI-2403 - Ardışık hatalı giriş denemesi sonrası hesap kilitlenmesi
    Diyelim ki kullanıcı 5 kez üst üste yanlış şifre girmiştir
    O zaman "Hesabınız güvenlik nedeniyle 15 dakika süreyle kilitlenmiştir" uyarısı görünür
    Ve doğru şifre girilse bile kilit süresi dolmadan giriş yapılamaz

  @s1 @password_reset
  Senaryo: NEXA-UI-2404 - Şifremi unuttum akışı ve sıfırlama e-postası
    Ne zaman kullanıcı "Şifremi Unuttum" butonuna basıp e-postasını girerse
    O zaman "Sıfırlama linki e-posta adresinize gönderildi" onayı gösterilir
    Ve veritabanında geçici bir sıfırlama token'ı oluşur

  @s2 @session
  Senaryo: NEXA-UI-2405 - "Beni Hatırlat" seçeneği ile oturumun korunması
    Ne zaman kullanıcı "Beni Hatırlat"ı işaretleyip giriş yaparsa
    O zaman tarayıcı kapatılıp tekrar açıldığında kullanıcı hala giriş yapmış durumdadır
    Ve "/login" sayfasına düşmeden doğrudan dashboard açılır

  @s1 @logout
  Senaryo: NEXA-UI-2406 - Güvenli çıkış (Logout) işlemi
    Diyelim ki kullanıcı sisteme giriş yapmıştır
    Ne zaman profil menüsünden "Çıkış Yap"a basarsa
    O zaman tüm yerel oturum verileri temizlenir
    Ve kullanıcı tekrar "/login" sayfasına yönlendirilir

  @s2 @rbac @live
  Senaryo: NEXA-UI-2407 - Admin kullanıcısı tüm projelere erişebilir
    Diyelim ki kullanıcı "ADMIN" rolündedir
    Ne zaman "Projeler" listesini açarsa
    O zaman üye olmadığı projeler de dahil olmak üzere sistemdeki tüm projeleri listeler
    Ve "Sistem Ayarları" menüsü görünür kalır

  @s1 @security
  Senaryo: NEXA-UI-2408 - Şifre değiştirme ekranında şifre gücü (Strength) kontrolü
    Ne zaman kullanıcı yeni şifre olarak "123" yazarsa
    O zaman "Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir" uyarısı görünür
    Ve "Zayıf Şifre" göstergesi kırmızı yanar
