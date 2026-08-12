# language: tr
@concurrency @p1
Özellik: Aynı Anda Düzenleme ve Veri Çakışma Yönetimi
  Birden fazla kullanıcı aynı kayıt üzerinde işlem yaptığında sistem veri kaybını önlemeli ve kullanıcıyı uyarmalıdır.

  @s0 @conflict
  Senaryo: NEXA-UI-3301 - İki kullanıcının aynı test case'i aynı anda düzenlemesi (Optimistic Locking)
    Diyelim ki "Kullanıcı A" ve "Kullanıcı B" aynı anda "TC-10" detay sayfasını açmıştır
    Ne zaman "Kullanıcı A" başlığı değiştirip kaydederse
    Ve hemen ardından "Kullanıcı B" açıklamayı değiştirip "Kaydet"e basarsa
    O zaman sistem "Bu kayıt başka bir kullanıcı tarafından güncellendi. Lütfen sayfa verilerini yenileyin" uyarısı verir
    Ve "Kullanıcı B"nin değişikliği "Kullanıcı A"nın verisini sessizce ezmez

  @s1 @locking
  Senaryo: NEXA-UI-3302 - Bir kullanıcı düzenleme yaparken öğenin başkasına kilitlenmesi
    Diyelim ki "Kullanıcı A" bir otomasyon senaryosunu düzenlemeye başlamıştır
    Ne zaman "Kullanıcı B" aynı senaryoyu açarsa
    O zaman ekranda "Bu sayfa şu an Kullanıcı A tarafından düzenleniyor (Salt Okunur)" uyarısı görünür
    Ve "Kaydet" butonu "Kullanıcı B" için pasif olur

  @s1 @real_time
  Senaryo: NEXA-UI-3303 - İş öğesi durumunun anlık (Real-time) güncellenmesi
    Diyelim ki "Kullanıcı A" ve "Kullanıcı B" aynı Agile Board sayfasını izlemektedir
    Ne zaman "Kullanıcı A" bir kartı "DONE" kolonuna çekerse
    O zaman "Kullanıcı B"nin ekranında sayfa yenilemeden kart otomatik olarak "DONE" kolonuna kayar
    Ve bir bildirim sesi/görseli ile değişiklik vurgulanır
