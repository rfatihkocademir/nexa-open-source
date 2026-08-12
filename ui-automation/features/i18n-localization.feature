# language: tr
@i18n @localization @p1
Özellik: Dil Desteği ve Yerelleştirme (TR/EN) Matrisi
  Uygulama; Türkçe ve İngilizce dillerinde tüm etiketlerin, hata mesajlarının ve tarih formatlarının doğru yerelleştirildiğini garanti etmelidir.

  @s2 @language_switch
  Senaryo: NEXA-UI-3101 - Dil değiştirme işleminin anlık yansıması
    Diyelim ki kullanıcı uygulama içindedir ve varsayılan dil Türkçe'dir
    Ne zaman kullanıcı profil menüsünden "English" seçeneğini seçerse
    O zaman tüm menü başlıkları ("Panel", "Projects", "Test Runs") anında İngilizceye döner
    Ve sayfa yenilemeye gerek kalmadan arayüz güncellenir

  @s1 @validation_i18n
  Senaryo Taslağı: NEXA-UI-3102 - Hata mesajlarının seçili dile göre yerelleştirilmesi
    Diyelim ki uygulamanın seçili dili "<dil>" olarak ayarlanmıştır
    Ne zaman kullanıcı "<islem>" sırasında bir hata yaparsa
    O zaman sistem "<beklenen_mesaj>" uyarısını verir

    Örnekler:
      | dil | islem               | beklenen_mesaj                          | aciklama               |
      | TR  | Boş şifre ile giriş | Şifre alanı boş bırakılamaz             | TR Boş alan hatası     |
      | EN  | Boş şifre ile giriş | Password field cannot be empty          | EN Boş alan hatası     |
      | TR  | Yanlış e-posta      | Geçersiz e-posta formatı                | TR Format hatası       |
      | EN  | Yanlış e-posta      | Invalid email format                    | EN Format hatası       |
      | TR  | Yetkisiz erişim     | Bu işlemi yapmak için yetkiniz yok      | TR Yetki hatası        |
      | EN  | Yetkisiz erişim     | You don't have permission for this task | EN Yetki hatası        |
      | TR  | Kayıt silme onayı   | Bu kaydı silmek istediğinize emin misiniz? | TR Silme onayı      |
      | EN  | Kayıt silme onayı   | Are you sure you want to delete this?   | EN Silme onayı         |

  @s2 @formatting
  Senaryo Taslağı: NEXA-UI-3103 - Tarih ve sayı formatlarının dile göre değişimi
    Diyelim ki uygulamanın seçili dili "<dil>" olarak ayarlanmıştır
    Ne zaman sistem bir tarih veya sayı gösterirse
    O zaman format "<format>" kuralına uygun olur

    Örnekler:
      | dil | format           | aciklama                        |
      | TR  | DD.MM.YYYY       | Türkçe gün.ay.yıl formatı       |
      | EN  | MM/DD/YYYY       | İngilizce ay/gün/yıl formatı    |
      | TR  | 1.234,56         | Türkçe binlik ve ondalık ayracı |
      | EN  | 1,234.56         | İngilizce binlik ve ondalık     |

  @s3 @ui_persistence
  Senaryo: NEXA-UI-3104 - Dil tercihinin oturumlar arası korunması
    Diyelim ki kullanıcı dilini "English" olarak değiştirmiştir
    Ne zaman kullanıcı çıkış yapıp tekrar giriş yaparsa
    O zaman uygulama hala İngilizce olarak açılır
    Ve kullanıcının dil tercihi veritabanındaki profilinde saklanır
