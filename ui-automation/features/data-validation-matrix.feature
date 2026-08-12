# language: tr
@data_validation @matrix @p1
Özellik: Kapsamlı Veri Doğrulama ve Sınır Değer Matrisi
  Uygulamanın tüm giriş alanları (input), farklı karakter setleri, uzunluklar ve geçersiz veri türlerine karşı dayanıklı olmalıdır.

  @s2 @boundary
  Senaryo Taslağı: NEXA-UI-2701 - Proje ismi için sınır değer ve karakter seti testi
    Diyelim ki kullanıcı yeni proje oluşturma ekranındadır
    Ne zaman kullanıcı proje ismi alanına "<deger>" yazar
    Ve "Oluştur"a basarsa
    O zaman sistem "<beklenen_sonuc>" şeklinde tepki verir

    Örnekler:
      | deger                         | beklenen_sonuc                         | aciklama               |
      | A                             | Proje ismi en az 3 karakter olmalıdır | Alt sınır ihlali       |
      | AB                            | Proje ismi en az 3 karakter olmalıdır | Alt sınır ihlali       |
      | ABC                           | Başarılı                              | Alt sınır tam değer    |
      | Proje_İsmi_123_!@#            | Başarılı                              | Özel karakter desteği  |
      | 🚀 Proje                      | Başarılı                              | Emoji desteği          |
      | 日本語のプロジェクト           | Başarılı                              | Japonca karakterler    |
      | المشروع                       | Başarılı                              | Arapça (RTL) desteği   |
      | <script>alert(1)</script>     | Geçersiz karakter veya Engellendi     | XSS koruması           |
      | SELECT * FROM Users           | Geçersiz karakter veya Engellendi     | SQL Injection koruması |
      | A(255 karakterlik uzun metin) | Başarılı                              | Üst sınır tam değer    |
      | B(256 karakterlik uzun metin) | En fazla 255 karakter olabilir        | Üst sınır ihlali       |

  @s1 @validation
  Senaryo Taslağı: NEXA-UI-2702 - E-posta alanı format doğruluğu matrisi
    Diyelim ki kullanıcı kullanıcı davet etme ekranındadır
    Ne zaman kullanıcı e-posta alanına "<email>" yazar
    O zaman sistem durumu "<gecerlilik>" olarak işaretler

    Örnekler:
      | email                 | gecerlilik | aciklama                     |
      | test@nexa.com         | Gecerli    | Standart format              |
      | test.user@nexa.com.tr | Gecerli    | Uzun uzantı                  |
      | test+label@nexa.com   | Gecerli    | Alias desteği                |
      | plainaddress          | Gecersiz   | @ işareti yok                |
      | #@%^%#$@#$@#.com      | Gecersiz   | Sadece özel karakterler      |
      | @example.com          | Gecersiz   | Kullanıcı adı yok            |
      | Joe Smith <email@ex.com> | Gecersiz| İsim etiketi içeriyor        |
      | email.example.com     | Gecersiz   | @ işareti eksik              |
      | email@example@ex.com  | Gecersiz   | Çift @ işareti               |
      | .email@example.com    | Gecersiz   | Nokta ile başlıyor           |
      | email.@example.com    | Gecersiz   | Nokta ile bitiyor            |

  @s2 @file_upload
  Senaryo Taslağı: NEXA-UI-2703 - Dosya yükleme (Attachment) güvenlik ve tip matrisi
    Diyelim ki kullanıcı bir test sonucuna kanıt yüklemektedir
    Ne zaman kullanıcı "<dosya_adi>" isimli ve "<boyut>" boyutunda bir dosya yüklerse
    O zaman sistem "<sonuc>" mesajını verir

    Örnekler:
      | dosya_adi         | boyut | sonuc                                | aciklama              |
      | ekran_goruntusu.png| 1MB   | Başarılı                             | Standart resim        |
      | rapor.pdf         | 5MB   | Başarılı                             | Standart döküman      |
      | virus.exe         | 10KB  | Geçersiz dosya formatı               | Yasaklı uzantı        |
      | script.js         | 1KB   | Geçersiz dosya formatı               | Yasaklı uzantı        |
      | database.sql      | 20MB  | Geçersiz dosya formatı               | Yasaklı uzantı        |
      | buyuk_video.mp4   | 200MB | Dosya boyutu sınırı aşıldı (Max 50MB)| Boyut ihlali          |
      | bos_dosya.txt     | 0KB   | Dosya içeriği boş olamaz             | Boş dosya             |
      | .hidden_file      | 1KB   | Başarısız veya Geçersiz              | Gizli dosya denemesi  |

  @s1 @numeric
  Senaryo Taslağı: NEXA-UI-2704 - Sayısal alanlar (Story Point, Duration) doğrulama
    Diyelim ki kullanıcı bir Story için "Puan" girmektedir
    Ne zaman kullanıcı puan alanına "<deger>" girerse
    O zaman sonuç "<durum>" olur

    Örnekler:
      | deger | durum    | aciklama            |
      | 0     | Başarılı | Alt sınır           |
      | 1     | Başarılı | Geçerli             |
      | 8     | Başarılı | Fibonacci (Standart)|
      | 100   | Başarılı | Üst sınır           |
      | -1    | Geçersiz | Negatif değer       |
      | 101   | Geçersiz | Üst sınır ihlali    |
      | abc   | Geçersiz | Metin girişi        |
      | 1.5   | Geçersiz | Ondalıklı sayı      |
      | ,     | Geçersiz | Sadece virgül       |
