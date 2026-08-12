# language: tr
@smoke @live @mock
Özellik: Profil
  Profil ekranı kullanıcının adını, soyadını ve hesap bilgilerini güvenilir biçimde görüntülemeli ve güncellemeye izin vermelidir.

  Senaryo: Profil ekranı kullanıcı bilgilerini gösterir
    Diyelim ki kullanıcı giriş yapmış durumda
    Ne zaman profil sayfasına giderse
    O zaman profil başlığı görünür
    Ve ad alanı görünür
    Ve soyad alanı görünür
    Ve e-posta alanı salt okunur görünür

  Senaryo: Kullanıcı adını güncellediğinde profil kaydedilir
    Diyelim ki profil sayfası açık
    Ve kullanıcı ad ve soyad alanlarını düzenliyor
    Ne zaman "Değişiklikleri Kaydet" butonuna basarsa
    O zaman güncellenen isimler ekranda görünür
    Ve kullanıcı oturumundaki isim bilgisi yenilenir
