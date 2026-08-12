# language: tr
@notifications @p1
Özellik: Bildirim Sistemi ve Anlık Uyarılar
  Kullanıcılar kendilerini ilgilendiren önemli olaylardan (atama, hata, onay) anında haberdar edilmelidir.

  Arka Plan:
    Diyelim ki kullanıcı giriş yapmıştır ve uygulama içindedir

  @s1 @real_time
  Senaryo: NEXA-UI-2601 - Bir test vakası atandığında anlık bildirim alma
    Ne zaman başka bir kullanıcı bu kullanıcıya bir test vakası atarsa
    O zaman ekranın sağ üst köşesinde "Size yeni bir test vakası atandı" bildirimi belirir
    Ve bildirim zili üzerinde kırmızı bir nokta oluşur

  @s2 @read_status
  Senaryo: NEXA-UI-2602 - Bildirimleri okundu olarak işaretleme
    Diyelim ki kullanıcının 3 okunmamış bildirimi vardır
    Ne zaman kullanıcı bildirim panelini açıp "Hepsini Okundu Yap" derse
    O zaman tüm bildirimler silikleşir
    Ve okunmamış bildirim sayısı "0" olur

  @s1 @navigation
  Senaryo: NEXA-UI-2603 - Bildirime tıklayarak ilgili kayda gitme
    Diyelim ki "Release 1.0 yayına hazır" bildirimi mevcuttur
    Ne zaman kullanıcı bu bildirime tıklarsa
    O zaman sistem otomatik olarak ilgili sürüm detayı sayfasına yönlendirir
    Ve bildirim paneli kapanır

  @s2 @preferences
  Senaryo: NEXA-UI-2604 - Bildirim türlerine göre filtreleme (Hata, Onay, Atama)
    Diyelim ki kullanıcının çok sayıda bildirimi vardır
    Ne zaman kullanıcı "Sadece Hatalar" (Errors) filtresini seçerse
    O zaman sadece test başarısızlıkları veya sistem hatalarıyla ilgili uyarılar listelenir

  @s3 @toast
  Senaryo: NEXA-UI-2605 - Arka arkaya gelen bildirimlerin üst üste binmemesi (Toast Stacking)
    Ne zaman 5 saniye içinde 10 farklı bildirim gelirse
    O zaman bildirimler (toast) ekranı kaplamayacak şekilde gruplanır
    Veya en fazla 3 tanesi aynı anda gösterilip diğerleri kuyruğa alınır
