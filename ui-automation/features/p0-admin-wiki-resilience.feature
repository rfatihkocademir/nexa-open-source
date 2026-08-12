# language: tr
@p0 @admin @wiki @resilience @accessibility @manual
Özellik: P0 admin, wiki, profil, dayanıklılık ve erişilebilirlik hata avı
  Bu dosya admin, profil, wiki, bildirim, hata dayanıklılığı ve erişilebilirlik için kritik P0 senaryolarını içerir.

  @s0 @admin @rbac @mock
  Senaryo: NEXA-UI-0161 - Admin kullanıcı listesi sadece ADMIN rolüne açılır
    Diyelim ki ADMIN rolündeki kullanıcı giriş yapmıştır
    Ne zaman kullanıcı yönetimi sayfasını açar
    O zaman kullanıcı listesi ve özet metrikler görünür
    Ve aynı rota TESTER rolünde 403 davranışı verir

  @s1 @admin @create-user @mock
  Senaryo: NEXA-UI-0162 - Yeni kullanıcı oluşturma e-posta tekrarını reddeder
    Diyelim ki admin kullanıcı oluşturma formundadır
    Ve girilen e-posta sistemde zaten vardır
    Ne zaman admin kullanıcıyı kaydetmeye çalışır
    O zaman yinelenen e-posta uyarısı görünür
    Ve kullanıcı listesine ikinci kayıt eklenmez

  @s0 @admin @deactivate @mock
  Senaryo: NEXA-UI-0163 - Kullanıcı pasife alınca aktif oturum sonraki istekte kapanır
    Diyelim ki admin bir TESTER kullanıcısını pasife almıştır
    Ne zaman pasife alınan kullanıcı başka sekmede dashboard yeniler
    O zaman kullanıcı login ekranına yönlendirilir
    Ve proje verisi görüntülenmez

  @s0 @admin @role-change @mock
  Senaryo: NEXA-UI-0164 - Rol düşürme sonrası admin menüsü anında kalkar
    Diyelim ki admin kendi dışında bir kullanıcının rolünü TESTER yapmıştır
    Ne zaman ilgili kullanıcı sayfayı yeniler
    O zaman admin menüleri görünmez
    Ve eski rol cache'iyle admin ekranına erişilemez

  @s1 @admin @project-membership @mock
  Senaryo: NEXA-UI-0165 - Proje üyeliği ekleme doğru projeye yazılır
    Diyelim ki admin kullanıcı detayındadır
    Ne zaman kullanıcıyı "Satış Portalı" projesine üye yapar
    O zaman üyelik ilgili proje altında görünür
    Ve başka projeye üyelik eklenmez

  @s1 @profile @save @live @mock
  Senaryo: NEXA-UI-0166 - Profil ad soyad güncellemesi yenileme sonrası korunur
    Diyelim ki kullanıcı profil ekranındadır
    Ne zaman ad ve soyad alanlarını değiştirip kaydeder
    O zaman profil başlığında yeni ad soyad görünür
    Ve sayfa yenilenince aynı değerler korunur

  @s1 @profile @server-error @mock
  Senaryo: NEXA-UI-0167 - Profil kayıt hatası formu eski değere sessizce döndürmez
    Diyelim ki profil güncelleme endpointi 500 yanıtı dönecektir
    Ne zaman kullanıcı profil bilgilerini kaydeder
    O zaman hata bildirimi görünür
    Ve kullanıcının girdiği değerler formda kalır

  @s0 @profile @avatar @mock
  Senaryo: NEXA-UI-0168 - Zararlı avatar URL'i script olarak çalışmaz
    Diyelim ki kullanıcı profil avatar alanına script içeren URL girer
    Ne zaman profil kaydedilir veya önizlenir
    O zaman script çalıştırılmaz
    Ve kullanıcıya geçersiz URL uyarısı gösterilir

  @s1 @wiki @tree @mock
  Senaryo: NEXA-UI-0169 - Wiki alan değişimi doğru sayfa ağacını yükler
    Diyelim ki projede iki wiki alanı vardır
    Ne zaman kullanıcı ikinci wiki alanına geçer
    O zaman ikinci alana ait sayfa ağacı görünür
    Ve ilk alanın sayfaları listede kalmaz

  @s0 @wiki @data-loss @mock
  Senaryo: NEXA-UI-0170 - Wiki sayfası kayıt hatasında editor içeriği kaybolmaz
    Diyelim ki kullanıcı wiki sayfası içeriğini düzenlemiştir
    Ve kayıt endpointi hata dönecektir
    Ne zaman kullanıcı kaydet aksiyonuna basar
    O zaman hata bildirimi görünür
    Ve editor içeriği kullanıcı değişiklikleriyle korunur

  @s1 @wiki @create-page @mock
  Senaryo: NEXA-UI-0171 - Alt sayfa doğru ebeveyn altında oluşturulur
    Diyelim ki kullanıcı wiki ağacında bir ebeveyn sayfa seçmiştir
    Ne zaman kullanıcı alt sayfa oluşturur
    O zaman yeni sayfa seçili ebeveynin altında görünür
    Ve wiki köküne yanlışlıkla eklenmez

  @s0 @wiki @xss @mock
  Senaryo: NEXA-UI-0172 - Wiki markdown içindeki script çalıştırılmaz
    Diyelim ki wiki içeriğinde script etiketi bulunan markdown vardır
    Ne zaman sayfa önizlemesi render edilir
    O zaman script çalışmaz
    Ve içerik güvenli biçimde escape edilir veya temizlenir

  @s1 @attachments @upload @mock
  Senaryo: NEXA-UI-0173 - Desteklenmeyen ek dosya türü yüklenmez
    Diyelim ki kullanıcı wiki veya test senaryosu ek alanındadır
    Ne zaman desteklenmeyen dosya türü seçer
    O zaman dosya türü uyarısı görünür
    Ve dosya ek listesine eklenmez

  @s1 @attachments @large-file @mock
  Senaryo: NEXA-UI-0174 - Büyük ek dosya sınır hatasıyla reddedilir
    Diyelim ki kullanıcı izin verilen boyutu aşan dosya seçmiştir
    Ne zaman yükleme başlar
    O zaman dosya boyutu uyarısı görünür
    Ve yarım kalan dosya başarılı ek gibi gösterilmez

  @s1 @notifications @mock
  Senaryo: NEXA-UI-0175 - Bildirimden ilgili koşu detayına güvenli geçilir
    Diyelim ki kullanıcıya koşu tamamlanma bildirimi gelmiştir
    Ne zaman kullanıcı bildirime tıklar
    O zaman ilgili koşu detay sayfası açılır
    Ve bildirim okundu olarak işaretlenir

  @s1 @notifications @rbac @mock
  Senaryo: NEXA-UI-0176 - Yetkisiz proje bildirimi içerik sızdırmaz
    Diyelim ki kullanıcı yetkisi kaldırılmış projeye ait eski bildirime sahiptir
    Ne zaman kullanıcı bildirimi açar
    O zaman yetki engeli görünür
    Ve proje adı dışında hassas detay gösterilmez

  @s1 @resilience @api-timeout @mock
  Senaryo: NEXA-UI-0177 - Liste API timeout olduğunda tekrar deneme aksiyonu görünür
    Diyelim ki proje listesi endpointi timeout olacaktır
    Ne zaman kullanıcı proje portföyünü açar
    O zaman zaman aşımı mesajı görünür
    Ve kullanıcı tekrar deneme aksiyonunu kullanabilir

  @s1 @resilience @malformed-response @mock
  Senaryo: NEXA-UI-0178 - Bozuk API yanıtı uygulamayı beyaz sayfaya düşürmez
    Diyelim ki dashboard endpointi beklenmeyen veri yapısı dönecektir
    Ne zaman dashboard yüklenir
    O zaman güvenli hata veya boş durum görünür
    Ve uygulama render hatasıyla tamamen kırılmaz

  @s1 @resilience @slow-network @mock
  Senaryo: NEXA-UI-0179 - Yavaş ağda ana aksiyonlar yüklenme durumunu açık gösterir
    Diyelim ki proje detay API yanıtları gecikmelidir
    Ne zaman kullanıcı proje detayını açar
    O zaman iskelet veya yüklenme durumu görünür
    Ve kullanıcı tamamlanmamış veriye göre karar aksiyonu alamaz

  @s2 @responsive @mobile @mock
  Senaryo: NEXA-UI-0180 - Mobil navigasyon çalışma alanı menülerini erişilebilir gösterir
    Diyelim ki kullanıcı mobil görünümde giriş yapmıştır
    Ne zaman çalışma alanı menüsünü açar
    O zaman test koşuları, raporlar ve kilometre taşları menüleri görünür
    Ve menü ekran dışına taşmaz

  @s2 @a11y @keyboard @mock
  Senaryo: NEXA-UI-0181 - Modal açıldığında klavye odağı modal içinde kalır
    Diyelim ki kullanıcı onay modalı açan bir aksiyon başlatmıştır
    Ne zaman kullanıcı Tab tuşuyla ilerler
    O zaman odak modal dışındaki sayfa kontrollerine kaçmaz
    Ve Escape ile modal kapatılabilir

  @s2 @a11y @forms @mock
  Senaryo: NEXA-UI-0182 - Zorunlu alan hataları ekran okuyucuya duyurulur
    Diyelim ki kullanıcı zorunlu alanları boş bırakmıştır
    Ne zaman formu göndermeye çalışır
    O zaman hata mesajları alanlarla ilişkilidir
    Ve hata bölgesi erişilebilir uyarı olarak duyurulur

  @s2 @a11y @contrast @mock
  Senaryo: NEXA-UI-0183 - Kritik hata mesajı renk dışında metinle de anlaşılır
    Diyelim ki kullanıcı FAIL veya kritik hata durumunu görüntüler
    Ne zaman hata satırı render edilir
    O zaman durum yalnızca renkle anlatılmaz
    Ve metin veya ikon etiketiyle anlaşılır

  @s1 @offline @recovery @mock
  Senaryo: NEXA-UI-0184 - Ağ geri geldiğinde tekrar deneme mevcut sayfa bağlamını korur
    Diyelim ki kullanıcı koşu detayındayken ağ hatası almıştır
    Ne zaman ağ geri gelir ve kullanıcı tekrar dener
    O zaman aynı koşu detayı yeniden yüklenir
    Ve kullanıcı proje listesine veya dashboard'a istemsiz dönmez

