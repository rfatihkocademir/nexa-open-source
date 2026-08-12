# language: tr
@p0 @security @rbac @session @manual
Özellik: P0 kimlik, oturum ve yetki hata avı
  Bu dosya kritik oturum ve yetki hatalarını bulmaya yönelik elle yazılmış P0 senaryolarını içerir.

  @s0 @anonymous @negative @live @mock
  Senaryo: NEXA-UI-0001 - Anonim kullanıcı admin listesine doğrudan URL ile erişemez
    Diyelim ki tarayıcıda geçerli oturum yoktur
    Ne zaman kullanıcı "/admin/users" adresini doğrudan açar
    O zaman kullanıcı "/login" sayfasına yönlendirilir
    Ve admin kullanıcı listesine ait ad, e-posta veya rol verisi ekranda görünmez

  @s0 @anonymous @negative @live @mock
  Senaryo: NEXA-UI-0002 - Anonim kullanıcı proje detayına doğrudan URL ile erişemez
    Diyelim ki tarayıcıda geçerli oturum yoktur
    Ne zaman kullanıcı "/projects/project-sales" adresini doğrudan açar
    O zaman giriş ekranı görünür
    Ve proje adı, sprint bilgisi veya test koşusu verisi render edilmez

  @s0 @rbac @tester @mock
  Senaryo: NEXA-UI-0003 - Test uzmanı yönetim menüsünü göremez
    Diyelim ki TESTER rolündeki kullanıcı giriş yapmıştır
    Ne zaman ana navigasyon menüsü açılır
    O zaman "Kullanıcı Yönetimi" menü öğesi görünmez
    Ve kullanıcı yalnızca kendi rolüne açık çalışma alanlarını görür

  @s0 @rbac @tester @mock
  Senaryo: NEXA-UI-0004 - Test uzmanı admin kullanıcı listesine URL ile giremez
    Diyelim ki TESTER rolündeki kullanıcı giriş yapmıştır
    Ne zaman kullanıcı "/admin/users" adresini doğrudan açar
    O zaman 403 erişim engellendi sayfası görünür
    Ve kullanıcı listesi API yanıtından gelen hassas veri ekranda görünmez

  @s0 @rbac @team-leader @mock
  Senaryo: NEXA-UI-0005 - Takım lideri global kullanıcı oluşturma ekranına erişemez
    Diyelim ki TEAM_LEADER rolündeki kullanıcı giriş yapmıştır
    Ne zaman kullanıcı "/admin/users/new" adresini doğrudan açar
    O zaman 403 erişim engellendi sayfası görünür
    Ve yeni kullanıcı formu alanları render edilmez

  @s0 @session @expired-token @mock
  Senaryo: NEXA-UI-0006 - Süresi dolan oturum korumalı sayfada kullanıcıyı login ekranına taşır
    Diyelim ki kullanıcının token süresi dolmuştur
    Ne zaman kullanıcı "/dashboard" sayfasını yeniler
    O zaman giriş ekranı açılır
    Ve önceki kullanıcının adı veya proje verisi ekranda kalmaz

  @s0 @session @logout @mock
  Senaryo: NEXA-UI-0007 - Çıkış sonrası geri tuşu dashboard verisini geri getirmez
    Diyelim ki kullanıcı dashboard ekranındadır
    Ve kullanıcı çıkış yapmıştır
    Ne zaman tarayıcı geri tuşuna basılır
    O zaman korumalı dashboard tekrar görünmez
    Ve kullanıcı giriş ekranında kalır

  @s1 @login @negative @live @mock
  Senaryo: NEXA-UI-0008 - Hatalı e-posta hesap varlığını ele vermez
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman sistemde olmayan e-posta ve herhangi bir parola ile giriş dener
    O zaman tek tip "Geçersiz e-posta veya şifre" mesajı görünür
    Ve kullanıcıya hesabın varlığı veya yokluğu hakkında ek bilgi verilmez

  @s2 @login @privacy @live @mock
  Senaryo: NEXA-UI-0009 - Parola alanı maskeli kalır
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman kullanıcı parola alanına değer yazar
    O zaman alan tipi parola olarak kalır
    Ve parola düz metin olarak ekranda görünmez

  @s2 @validation @login @mock
  Senaryo: NEXA-UI-0010 - Boş giriş formu API çağrısı yapmadan doğrulama gösterir
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman kullanıcı e-posta ve parola girmeden "Giriş Yap" butonuna basar
    O zaman e-posta ve parola doğrulama mesajları görünür
    Ve oturum açma isteği gönderilmez

  @s2 @validation @login @mock
  Senaryo: NEXA-UI-0011 - Biçimsiz e-posta istemci tarafında reddedilir
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman kullanıcı e-posta alanına "deniz" değerini yazar
    Ve geçerli uzunlukta parola girip giriş yapmaya çalışır
    O zaman e-posta biçimi doğrulama mesajı görünür
    Ve kullanıcı login ekranında kalır

  @s1 @login @double-submit @mock
  Senaryo: NEXA-UI-0012 - Yavaş login yanıtında çift tıklama iki oturum isteği üretmez
    Diyelim ki login API yanıtı gecikmeli dönecektir
    Ve kullanıcı geçerli kimlik bilgilerini girmiştir
    Ne zaman kullanıcı "Giriş Yap" butonuna iki kez hızlıca basar
    O zaman buton yüklenme durumuna geçer
    Ve sadece tek login isteği işlenir

  @s1 @login @negative @mock
  Senaryo: NEXA-UI-0013 - Başarısız login sonrası eski token saklanmaz
    Diyelim ki tarayıcı depolamasında geçersiz bir token kalmıştır
    Ne zaman kullanıcı hatalı kimlik bilgileriyle giriş dener
    O zaman login reddedilir
    Ve tarayıcı depolamasında kullanılabilir oturum tokenı kalmaz

  @s0 @session @role-cache @mock
  Senaryo: NEXA-UI-0014 - Rol değişimi sonrası eski admin menüsü cache'ten görünmez
    Diyelim ki aynı tarayıcıda önce ADMIN kullanıcısı çıkış yapmıştır
    Ne zaman TESTER rolündeki kullanıcı giriş yapar
    O zaman admin menüleri görünmez
    Ve eski admin oturumundan kalan yetkili aksiyonlar tıklanabilir olmaz

  @s0 @login @inactive-user @mock
  Senaryo: NEXA-UI-0015 - Pasif kullanıcı dashboard ekranına alınmaz
    Diyelim ki kullanıcı hesabı pasif durumdadır
    Ne zaman kullanıcı doğru e-posta ve parola ile giriş dener
    O zaman oturum açılmaz
    Ve hesap durumunu açıklayan güvenli hata mesajı görünür

  @s0 @login @disabled-user @mock
  Senaryo: NEXA-UI-0016 - Devre dışı bırakılmış hesap proje verisi göremez
    Diyelim ki devre dışı bırakılmış kullanıcı giriş yapmaya çalışır
    Ne zaman backend 403 yanıtı döner
    O zaman kullanıcı dashboard yerine login ekranında kalır
    Ve proje veya koşu verisi yüklenmez

  @s0 @rbac @tamper @mock
  Senaryo: NEXA-UI-0017 - LocalStorage rol manipülasyonu admin erişimi sağlamaz
    Diyelim ki TESTER rolündeki kullanıcı giriş yapmıştır
    Ve tarayıcı depolamasındaki rol alanı "ADMIN" yapılmıştır
    Ne zaman kullanıcı "/admin/users" adresini açar
    O zaman backend yetkisi esas alınır ve 403 sayfası görünür
    Ve admin ekranı kısa süreli bile render edilmez

  @s1 @session @refresh @mock
  Senaryo: NEXA-UI-0018 - Sayfa yenileme kullanıcı bilgisini API'den yeniden doğrular
    Diyelim ki kullanıcı dashboard ekranındadır
    Ne zaman sayfa yenilenir
    O zaman kullanıcı bilgisi güvenilir oturum endpointinden yeniden yüklenir
    Ve rol bilgisi gelmeden yetkili menüler açılmaz

  @s2 @session @login @mock
  Senaryo: NEXA-UI-0019 - Oturum açıkken login sayfası dashboard'a yönlendirir
    Diyelim ki kullanıcı geçerli oturumla dashboard ekranındadır
    Ne zaman kullanıcı "/login" adresini doğrudan açar
    O zaman kullanıcı dashboard ekranına yönlendirilir
    Ve login formu aktif oturumu bozmaz

  @s1 @session @deep-link @mock
  Senaryo: NEXA-UI-0020 - Login sonrası istenen korumalı rota güvenli şekilde açılır
    Diyelim ki anonim kullanıcı "/runs/run-sprint-24" adresini açmıştır
    Ve giriş ekranına yönlendirilmiştir
    Ne zaman kullanıcı yetkili hesapla giriş yapar
    O zaman istenen koşu detay ekranı açılır
    Ve yetkisiz rol ile giriş yapılırsa 403 sayfası görünür

  @s0 @rbac @data-leak @mock
  Senaryo: NEXA-UI-0021 - 403 sayfasında admin API verisi sızmaz
    Diyelim ki TESTER rolündeki kullanıcı admin endpointine yönlendiren URL açar
    Ne zaman 403 ekranı render edilir
    O zaman kullanıcı e-postaları, roller veya proje izinleri görünmez
    Ve yalnızca erişim engeli mesajı gösterilir

  @s0 @session @logout @mock
  Senaryo: NEXA-UI-0022 - Çıkış aksiyonu local ve session storage oturum alanlarını temizler
    Diyelim ki kullanıcı giriş yapmıştır
    Ne zaman kullanıcı çıkış aksiyonunu çalıştırır
    O zaman token, kullanıcı ve izin bilgileri tarayıcı depolamasından silinir
    Ve sonraki korumalı sayfa isteği login ekranına döner

  @s1 @session @multi-tab @mock
  Senaryo: NEXA-UI-0023 - Bir sekmede çıkış diğer sekmedeki korumalı ekranı kapatır
    Diyelim ki kullanıcı iki sekmede oturum açmıştır
    Ne zaman bir sekmede çıkış yapılır
    Ve diğer sekmede dashboard yenilenir
    O zaman diğer sekme giriş ekranına döner
    Ve eski dashboard verisi görünür kalmaz

  @s0 @tenant-isolation @live
  Senaryo: NEXA-UI-0024 - Yeni canlı kullanıcı başka kullanıcının projesini göremez
    Diyelim ki canlı modda yeni kayıt olmuş TESTER kullanıcısı vardır
    Ne zaman kullanıcı "/projects/project-sales" adresini doğrudan açar
    O zaman proje bulunamadı veya yetki engeli ekranı görünür
    Ve satış portalı proje verisi ekranda görünmez

  @s1 @rbac @admin @mock
  Senaryo: NEXA-UI-0025 - Admin menüsü sadece ADMIN rolünde görünür
    Diyelim ki ADMIN rolündeki kullanıcı giriş yapmıştır
    Ne zaman ana navigasyon menüsü açılır
    O zaman kullanıcı yönetimi bağlantısı görünür
    Ve aynı kontrol TESTER rolünde görünmez

  @s1 @rbac @project-member @mock
  Senaryo: NEXA-UI-0026 - Takım lideri yalnızca üyesi olduğu proje üyelerini görür
    Diyelim ki TEAM_LEADER rolündeki kullanıcı proje detayındadır
    Ne zaman üyeler veya takım alanı açılır
    O zaman yalnızca ilgili projenin üyeleri listelenir
    Ve başka projeye ait kullanıcılar görünmez

  @s0 @privilege-escalation @profile @mock
  Senaryo: NEXA-UI-0027 - Profil güncellemesi rol yükseltme alanı göndermez
    Diyelim ki TESTER rolündeki kullanıcı profil ekranındadır
    Ne zaman ad ve soyad bilgilerini günceller
    O zaman rol alanı düzenlenebilir görünmez
    Ve kayıt isteği kullanıcı rolünü değiştirecek payload içermez

  @s1 @session @expired-during-save @mock
  Senaryo: NEXA-UI-0028 - Oturum kayıt sırasında biterse form verisi kaybolmadan login'e dönülür
    Diyelim ki kullanıcı profil formunda değişiklik yapmıştır
    Ve oturum kayıt isteği sırasında sona erecektir
    Ne zaman kullanıcı kaydet aksiyonuna basar
    O zaman kullanıcı güvenli şekilde login ekranına yönlendirilir
    Ve formdaki hassas olmayan değişiklikler tekrar deneme için korunur veya açıkça uyarılır

  @s1 @session @redirect @mock
  Senaryo: NEXA-UI-0029 - Son rota bilgisi login bypass için kullanılamaz
    Diyelim ki anonim kullanıcının son rota bilgisi "/admin/users" olarak manipüle edilmiştir
    Ne zaman kullanıcı TESTER rolüyle giriş yapar
    O zaman admin ekranı açılmaz
    Ve kullanıcı 403 veya yetkili ana ekrana yönlendirilir

  @s0 @history @rbac @mock
  Senaryo: NEXA-UI-0030 - 403 sonrası tarayıcı geçmişi admin içeriğini göstermez
    Diyelim ki TESTER rolündeki kullanıcı "/admin/users" adresinden 403 görmüştür
    Ne zaman tarayıcı geri ve ileri tuşları kullanılır
    O zaman admin liste içeriği hiçbir aşamada görünmez
    Ve erişim engeli davranışı korunur

  @s2 @validation @unicode @mock
  Senaryo: NEXA-UI-0031 - Unicode karakterli geçersiz e-posta güvenli doğrulanır
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman kullanıcı e-posta alanına "ğiriş@nexa" yazar
    Ve geçerli uzunlukta parola girer
    O zaman e-posta doğrulama mesajı görünür
    Ve uygulama istemci hatası üretmez

  @s2 @validation @trim @mock
  Senaryo: NEXA-UI-0032 - E-posta başındaki ve sonundaki boşluklar güvenli işlenir
    Diyelim ki kullanıcı giriş ekranındadır
    Ne zaman kullanıcı e-posta alanına " zeynep.acar@nexa.test " yazar
    Ve doğru parolayı girer
    O zaman sistem e-postayı beklenen biçimde işler
    Ve gereksiz boşluk nedeniyle yanlış kullanıcıya giriş yapılmaz

  @s1 @rate-limit @login @mock
  Senaryo: NEXA-UI-0033 - Çok fazla başarısız login denemesi güvenli uyarı gösterir
    Diyelim ki login endpointi 429 yanıtı dönecektir
    Ne zaman kullanıcı tekrar giriş yapmaya çalışır
    O zaman geçici kısıtlama mesajı görünür
    Ve parola veya hesap varlığı hakkında ek bilgi verilmez

  @s1 @server-error @login @mock
  Senaryo: NEXA-UI-0034 - Login 500 hatasında kullanıcı güvenli tekrar deneme mesajı görür
    Diyelim ki login endpointi 500 yanıtı dönecektir
    Ne zaman kullanıcı geçerli bilgileri gönderir
    O zaman oturum açılmış gibi davranılmaz
    Ve kullanıcıya tekrar deneyebileceği açık hata mesajı gösterilir

  @s2 @offline @login @mock
  Senaryo: NEXA-UI-0035 - Offline login denemesi kullanıcı girdisini silmez
    Diyelim ki kullanıcı giriş formunu doldurmuştur
    Ve ağ bağlantısı kesilmiştir
    Ne zaman kullanıcı giriş yapmaya çalışır
    O zaman bağlantı hatası mesajı görünür
    Ve e-posta alanındaki değer korunur

  @s1 @session @refresh-loop @mock
  Senaryo: NEXA-UI-0036 - Token yenileme hatası sonsuz yükleme üretmez
    Diyelim ki oturum yenileme endpointi art arda hata dönecektir
    Ne zaman kullanıcı dashboard sayfasını açar
    O zaman belirli süre içinde login veya hata ekranı görünür
    Ve sayfa sonsuz spinner durumunda kalmaz

  @s1 @protected-route @reports @mock
  Senaryo: NEXA-UI-0037 - Anonim kullanıcı raporlar sayfasına erişemez
    Diyelim ki tarayıcıda oturum yoktur
    Ne zaman kullanıcı "/reports" adresini açar
    O zaman giriş ekranına yönlendirilir
    Ve rapor listesi veya başarı oranı verisi görünmez

  @s1 @protected-route @runs @mock
  Senaryo: NEXA-UI-0038 - Anonim kullanıcı test koşuları sayfasına erişemez
    Diyelim ki tarayıcıda oturum yoktur
    Ne zaman kullanıcı "/runs" adresini açar
    O zaman giriş ekranına yönlendirilir
    Ve koşu başlıkları veya sonuç sayacı görünmez

  @s0 @project-permission @release @mock
  Senaryo: NEXA-UI-0039 - Yetkisiz kullanıcı release sekmesine direkt URL ile erişemez
    Diyelim ki TESTER rolündeki kullanıcının project-sales üzerinde release yetkisi yoktur
    Ne zaman kullanıcı "/projects/project-sales?tab=release" adresini açar
    O zaman release kararları ve AI özeti görünmez
    Ve kullanıcı yetki engeli veya güvenli boş durum görür

  @s0 @permission-tamper @project @mock
  Senaryo: NEXA-UI-0040 - Proje izni localStorage manipülasyonu ile kazanılamaz
    Diyelim ki TESTER kullanıcısı yalnızca kendi çalışma alanına yetkilidir
    Ve tarayıcı depolamasına sahte "project.update" izni eklenmiştir
    Ne zaman kullanıcı proje ayar aksiyonunu açmaya çalışır
    O zaman backend yetkisi esas alınır
    Ve güncelleme formu veya silme aksiyonu görünmez

