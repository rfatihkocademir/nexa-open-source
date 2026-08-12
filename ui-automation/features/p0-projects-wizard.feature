# language: tr
@p0 @projects @wizard @dashboard @manual
Özellik: P0 proje, dashboard ve sihirbaz hata avı
  Bu dosya proje portföyü, proje detayları, dashboard ve AI destekli sihirbaz için kritik hata yakalama senaryolarını içerir.

  @s1 @dashboard @empty-state @live @mock
  Senaryo: NEXA-UI-0041 - Yeni kullanıcının dashboard sayacı sıfır proje ile tutarlı görünür
    Diyelim ki kullanıcının hiçbir projesi yoktur
    Ne zaman dashboard sayfası açılır
    O zaman toplam proje sayacı 0 görünür
    Ve son aktivite alanında yanıltıcı eski aktivite görünmez

  @s1 @dashboard @metrics @mock
  Senaryo: NEXA-UI-0042 - Dashboard KPI değerleri proje listesindeki veriyle çelişmez
    Diyelim ki takım liderinin iki projesi vardır
    Ne zaman dashboard KPI kartları yüklenir
    O zaman toplam proje, açık koşu ve hata sayacı mock veriyle eşleşir
    Ve kartlardan herhangi biri "NaN" veya boş değer göstermez

  @s2 @dashboard @navigation @mock
  Senaryo: NEXA-UI-0043 - Dashboard proje kartı doğru proje detayına gider
    Diyelim ki dashboard üzerinde "Satış Portalı" proje kartı görünür
    Ne zaman kullanıcı kartı açar
    O zaman "/projects/project-sales" adresi açılır
    Ve detay başlığında aynı proje adı görünür

  @s1 @dashboard @stale-data @mock
  Senaryo: NEXA-UI-0044 - Dashboard yenilemede eski kullanıcının proje kartı kalmaz
    Diyelim ki takım lideri çıkış yapıp test uzmanı aynı tarayıcıda giriş yapmıştır
    Ne zaman dashboard yüklenir
    O zaman takım liderine ait proje kartları görünmez
    Ve test uzmanının boş dashboard durumu görünür

  @s2 @projects @empty-state @live @mock
  Senaryo: NEXA-UI-0045 - Boş proje portföyü yeni proje aksiyonunu açık bırakır
    Diyelim ki kullanıcının aktif projesi yoktur
    Ne zaman proje portföyü açılır
    O zaman "Aktif proje bulunamadı" mesajı görünür
    Ve yetkili kullanıcı için "Proje Oluştur" aksiyonu kullanılabilir kalır

  @s1 @projects @filter @mock
  Senaryo: NEXA-UI-0046 - Aktif proje filtresi arşivli projeyi liste dışı bırakır
    Diyelim ki portföyde aktif ve arşivli projeler vardır
    Ne zaman "Aktif Projeler" sekmesi seçilir
    O zaman arşivli proje satırı görünmez
    Ve aktif proje satırı tıklanabilir kalır

  @s1 @projects @archive @mock
  Senaryo: NEXA-UI-0047 - Arşiv sekmesi aktif proje aksiyonlarını devre dışı bırakır
    Diyelim ki arşivli proje listelenmiştir
    Ne zaman kullanıcı arşivli proje satırını görüntüler
    O zaman aktif projeye özel düzenleme veya koşu başlatma aksiyonları görünmez
    Ve arşiv etiketi satırda açıkça görünür

  @s2 @projects @search @mock
  Senaryo: NEXA-UI-0048 - Proje araması Türkçe karakterli adları bulur
    Diyelim ki portföyde "Satış Portalı" projesi vardır
    Ne zaman kullanıcı arama alanına "Satış" yazar
    O zaman ilgili proje satırı görünür
    Ve eşleşmeyen proje satırları görünmez

  @s2 @projects @search @mock
  Senaryo: NEXA-UI-0049 - Proje araması sonuç bulamazsa güvenli boş durum gösterir
    Diyelim ki portföyde en az bir proje vardır
    Ne zaman kullanıcı arama alanına eşleşmeyen uzun bir değer yazar
    O zaman boş sonuç mesajı görünür
    Ve tablo başlıkları veya önceki sonuçlar yanıltıcı şekilde kalmaz

  @s1 @projects @pagination @mock
  Senaryo: NEXA-UI-0050 - Proje sayfalaması filtreyi kaybetmez
    Diyelim ki proje listesi birden fazla sayfaya bölünmüştür
    Ve kullanıcı aktif proje filtresi uygulamıştır
    Ne zaman kullanıcı ikinci sayfaya geçer
    O zaman aktif filtre korunur
    Ve arşivli kayıtlar ikinci sayfada görünmez

  @s1 @projects @direct-url @mock
  Senaryo: NEXA-UI-0051 - Var olmayan proje adresi bulunamadı ekranı gösterir
    Diyelim ki kullanıcı giriş yapmıştır
    Ne zaman "/projects/olmayan-proje" adresini açar
    O zaman proje bulunamadı ekranı görünür
    Ve önceki proje detayından kalan veri ekranda kalmaz

  @s0 @project-detail @data-leak @mock
  Senaryo: NEXA-UI-0052 - Yetkisiz proje detayında eski proje sekmesi sızmaz
    Diyelim ki kullanıcı yetkili olduğu bir proje detayını görmüştür
    Ne zaman yetkisiz bir proje adresine gider
    O zaman yetki engeli veya bulunamadı ekranı görünür
    Ve önceki projenin test koşuları veya wiki içeriği görünmez

  @s1 @project-detail @tabs @mock
  Senaryo: NEXA-UI-0053 - Proje detay sekmeleri URL parametresine göre doğru açılır
    Diyelim ki kullanıcı proje detayına erişebilir
    Ne zaman "/projects/project-sales?tab=test-cases" adresini açar
    O zaman test senaryoları sekmesi aktif görünür
    Ve genel bakış içeriği aktif sekme gibi işaretlenmez

  @s1 @project-detail @refresh @mock
  Senaryo: NEXA-UI-0054 - Proje detay yenileme aktif sekmeyi korur
    Diyelim ki kullanıcı proje detayında "Test Koşuları" sekmesindedir
    Ne zaman sayfa yenilenir
    O zaman aynı sekme tekrar açılır
    Ve kullanıcı genel bakışa sessizce döndürülmez

  @s2 @project-detail @counts @mock
  Senaryo: NEXA-UI-0055 - Proje kalite sayacı alt listelerle tutarlı kalır
    Diyelim ki proje detayında kalite özeti görünür
    Ne zaman kullanıcı test koşuları sekmesine geçer
    O zaman açık koşu sayısı listedeki açık koşularla uyumludur
    Ve negatif veya "NaN" değer görünmez

  @s1 @project-detail @board-link @mock
  Senaryo: NEXA-UI-0056 - Board bağlantısı geçersiz sprintte zararsız davranır
    Diyelim ki proje detayında aktif sprint bilgisi eksiktir
    Ne zaman kullanıcı "Board'a Git" aksiyonunu görür veya tıklar
    O zaman kullanıcı bozuk rota veya boş beyaz sayfa görmez
    Ve uygun boş durum veya pasif aksiyon görünür

  @s1 @wizard @validation @mock
  Senaryo: NEXA-UI-0057 - Proje adı yalnızca boşluklardan oluşursa ilerleme engellenir
    Diyelim ki proje sihirbazı ilk adımdadır
    Ne zaman kullanıcı proje adı alanına yalnızca boşluk yazar
    Ve sonraki adıma geçmeye çalışır
    O zaman zorunlu alan doğrulaması görünür
    Ve kapsam analizi adımına geçilmez

  @s1 @wizard @validation @mock
  Senaryo: NEXA-UI-0058 - Çok uzun proje adı taşma ve kayıt hatası üretmeden reddedilir
    Diyelim ki proje sihirbazı ilk adımdadır
    Ne zaman kullanıcı izin verilen sınırı aşan uzun proje adı girer
    O zaman alan veya form doğrulama mesajı görünür
    Ve başlık metni modal dışına taşmaz

  @s1 @wizard @duplicate @mock
  Senaryo: NEXA-UI-0059 - Aynı isimli proje oluşturma kullanıcıya açık hata verir
    Diyelim ki "Satış Portalı" adlı proje zaten vardır
    Ne zaman kullanıcı aynı adla proje oluşturmayı dener
    O zaman yinelenen proje adı hatası görünür
    Ve kullanıcı proje listesine başarılı oluşturulmuş gibi yönlendirilmez

  @s1 @wizard @ai @mock
  Senaryo: NEXA-UI-0060 - AI kapsam soruları yüklenemezse kullanıcı manuel devam edebilir
    Diyelim ki proje sihirbazında AI kapsam endpointi hata dönecektir
    Ne zaman kullanıcı proje adıyla sonraki adıma geçer
    O zaman AI hata mesajı görünür
    Ve kullanıcı analizi atlayarak doküman adımına geçebilir

  @s1 @wizard @ai @mock
  Senaryo: NEXA-UI-0061 - AI kapsam yanıtı boşsa doküman editorü güvenli varsayılan gösterir
    Diyelim ki AI doküman servisi boş kapsam yanıtı dönecektir
    Ne zaman kullanıcı kapsam analizini tamamlar
    O zaman editor boş beyaz sayfa yerine düzenlenebilir varsayılan içerik gösterir
    Ve proje oluşturma akışı kilitlenmez

  @s0 @wizard @data-loss @mock
  Senaryo: NEXA-UI-0062 - Sihirbaz adımları arasında geri dönünce girilen kapsam kaybolmaz
    Diyelim ki kullanıcı kapsam dokümanını düzenlemiştir
    Ne zaman kullanıcı önceki adıma dönüp tekrar doküman adımına gelir
    O zaman düzenlenen kapsam metni korunur
    Ve AI varsayılanı kullanıcı değişikliğini ezmez

  @s1 @wizard @members @mock
  Senaryo: NEXA-UI-0063 - Üye arama sonucu sadece eşleşen kullanıcıları gösterir
    Diyelim ki sihirbaz takım üyeleri adımındadır
    Ne zaman kullanıcı arama alanına "Deniz" yazar
    O zaman Deniz Kaya kullanıcı seçeneği görünür
    Ve eşleşmeyen kullanıcı seçenekleri görünmez

  @s1 @wizard @members @mock
  Senaryo: NEXA-UI-0064 - Aynı takım üyesi iki kez eklenemez
    Diyelim ki sihirbaz takım üyeleri adımındadır
    Ve "Deniz Kaya" kullanıcı olarak seçilmiştir
    Ne zaman kullanıcı aynı kişiyi tekrar eklemeye çalışır
    O zaman ikinci kopya oluşmaz
    Ve üye sayacı tek üyeyi gösterir

  @s0 @wizard @permissions @mock
  Senaryo: NEXA-UI-0065 - Test uzmanı proje oluşturma sihirbazını başlatamaz
    Diyelim ki TESTER rolündeki kullanıcı giriş yapmıştır
    Ne zaman kullanıcı "/projects/new" adresini doğrudan açar
    O zaman yetki engeli görünür
    Ve proje oluşturma formu render edilmez

  @s1 @wizard @submit @mock
  Senaryo: NEXA-UI-0066 - Proje oluşturma isteği sırasında buton tekrar tıklanamaz
    Diyelim ki sihirbaz son adımdadır
    Ve proje oluşturma endpointi gecikmeli dönecektir
    Ne zaman kullanıcı "Proje Oluştur" butonuna iki kez basar
    O zaman tek proje oluşturma isteği işlenir
    Ve kullanıcıya yüklenme durumu gösterilir

  @s1 @wizard @server-error @mock
  Senaryo: NEXA-UI-0067 - Proje oluşturma 500 hatasında form verisi korunur
    Diyelim ki sihirbaz son adımdadır
    Ve proje oluşturma endpointi 500 yanıtı dönecektir
    Ne zaman kullanıcı projeyi oluşturur
    O zaman hata mesajı görünür
    Ve proje adı, açıklama ve seçili üyeler silinmez

  @s0 @wizard @authorization @mock
  Senaryo: NEXA-UI-0068 - Proje oluşturma 403 dönerse başarılı proje satırı eklenmez
    Diyelim ki kullanıcı sihirbaz son adımındadır
    Ve proje oluşturma endpointi 403 yanıtı dönecektir
    Ne zaman kullanıcı oluşturma aksiyonunu çalıştırır
    O zaman proje portföyünde yeni proje satırı görünmez
    Ve kullanıcı yetki hatasını açıkça görür

  @s2 @wizard @responsive @mock
  Senaryo: NEXA-UI-0069 - Mobil görünümde sihirbaz adım başlıkları taşmaz
    Diyelim ki kullanıcı mobil görünümde proje sihirbazını açmıştır
    Ne zaman kapsam ve mimari adımları arasında geçer
    O zaman adım başlıkları görünür ve tıklanabilir kalır
    Ve birincil aksiyon butonu ekran dışında kalmaz

  @s2 @wizard @keyboard @mock
  Senaryo: NEXA-UI-0070 - Sihirbaz klavye ile adım ilerletmeyi destekler
    Diyelim ki kullanıcı sihirbaz ilk adımındadır
    Ne zaman kullanıcı proje adı alanını klavye ile doldurur
    Ve Tab ile "Sonraki Adım" butonuna gelir
    O zaman odak görünür kalır
    Ve Enter ile sonraki adıma geçilebilir

  @s1 @project-detail @stale-request @mock
  Senaryo: NEXA-UI-0071 - Hızlı proje değiştirme eski detay isteğini ekrana yazmaz
    Diyelim ki kullanıcı proje listesindedir
    Ve ilk proje detay isteği gecikmeli dönecektir
    Ne zaman kullanıcı hızlıca ikinci proje detayına geçer
    O zaman ekranda yalnızca son seçilen projenin başlığı görünür
    Ve geciken ilk yanıt UI state'ini ezmez

  @s1 @projects @sort @mock
  Senaryo: NEXA-UI-0072 - Proje sıralaması tarih alanı eksik kayıtta bozulmaz
    Diyelim ki proje listesinde güncellenme tarihi eksik bir kayıt vardır
    Ne zaman kullanıcı tarihe göre sıralama yapar
    O zaman tablo hata vermeden sıralanır
    Ve eksik tarihli kayıt güvenli varsayılanla gösterilir

  @s2 @projects @long-text @mock
  Senaryo: NEXA-UI-0073 - Çok uzun proje açıklaması kart düzenini bozmaz
    Diyelim ki proje açıklaması çok uzun tek kelime içerir
    Ne zaman proje kartı veya tablo satırı render edilir
    O zaman metin satır içinde taşmadan kırılır veya kısaltılır
    Ve aksiyon butonları tıklanabilir kalır

  @s1 @dashboard @activity @mock
  Senaryo: NEXA-UI-0074 - Son aktivite listesi tarihe göre ters kronolojik görünür
    Diyelim ki dashboard için farklı tarihlerde aktiviteler vardır
    Ne zaman son aktivite listesi yüklenir
    O zaman en yeni aktivite ilk sırada görünür
    Ve tarih formatı kullanıcı zaman dilimiyle tutarlıdır

  @s1 @dashboard @activity @mock
  Senaryo: NEXA-UI-0075 - Yetkisiz proje aktivitesi dashboard'a düşmez
    Diyelim ki kullanıcı yalnızca bir projeye üyedir
    Ve sistemde başka projelere ait aktiviteler vardır
    Ne zaman dashboard yüklenir
    O zaman kullanıcı yetkisiz proje aktivitelerini görmez
    Ve aktivite sayacı sadece izinli veriyle hesaplanır

  @s2 @projects @bulk-state @mock
  Senaryo: NEXA-UI-0076 - Arama temizlenince proje listesi eski tam haline döner
    Diyelim ki kullanıcı proje aramasıyla listeyi daraltmıştır
    Ne zaman kullanıcı arama alanını temizler
    O zaman tüm erişilebilir proje satırları geri gelir
    Ve seçili arşiv veya aktif sekme korunur

  @s1 @project-detail @api-404 @mock
  Senaryo: NEXA-UI-0077 - Proje detay API 404 dönerse kullanıcı bulunamadı ekranı görür
    Diyelim ki proje detay endpointi 404 yanıtı dönecektir
    Ne zaman kullanıcı proje adresini açar
    O zaman proje bulunamadı ekranı görünür
    Ve uygulama konsol hatasıyla boş sayfada kalmaz

  @s1 @project-detail @api-500 @mock
  Senaryo: NEXA-UI-0078 - Proje detay API 500 dönerse tekrar deneme durumu görünür
    Diyelim ki proje detay endpointi 500 yanıtı dönecektir
    Ne zaman kullanıcı proje adresini açar
    O zaman kullanıcıya geçici hata mesajı görünür
    Ve önceki projenin verisi yeni hata ekranında kalmaz

  @s0 @wizard @sensitive-data @mock
  Senaryo: NEXA-UI-0079 - AI doküman hatası backend stack trace göstermez
    Diyelim ki AI doküman servisi hata ayrıntısı içeren 500 yanıtı dönecektir
    Ne zaman kullanıcı kapsam dokümanı üretmeye çalışır
    O zaman teknik stack trace veya gizli ortam değeri ekranda görünmez
    Ve kullanıcı güvenli hata mesajı görür

  @s1 @projects @create-navigation @mock
  Senaryo: NEXA-UI-0080 - Başarılı proje oluşturma doğru yeni proje kaydına bağlanır
    Diyelim ki takım lideri geçerli proje bilgilerini tamamlamıştır
    Ne zaman proje oluşturma başarılı olur
    O zaman portföyde yeni proje adı görünür
    Ve satıra tıklanınca aynı projenin detay sayfası açılır

