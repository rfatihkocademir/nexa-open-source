# language: tr
@p0 @test-cases @automation @manual
Özellik: P0 test tasarımı ve otomasyon kurucu hata avı
  Bu dosya test paketleri, test senaryosu editorü ve otomasyon kurucu için kritik hata yakalama senaryolarını içerir.

  @s1 @suites @tree @mock
  Senaryo: NEXA-UI-0081 - Test paket ağacı ilk açılışta doğru hiyerarşi gösterir
    Diyelim ki projede üst ve alt test paketleri vardır
    Ne zaman test senaryoları sekmesi açılır
    O zaman üst paketler ve çocuk paketler doğru girintiyle görünür
    Ve çocuk paket sayacı yanlış pakete yazılmaz

  @s1 @suites @selection @mock
  Senaryo: NEXA-UI-0082 - Paket seçimi yalnızca seçili paketin senaryolarını listeler
    Diyelim ki iki farklı pakette test senaryoları vardır
    Ne zaman kullanıcı "Kimlik Doğrulama" paketini seçer
    O zaman sadece bu pakete ait senaryolar görünür
    Ve ödeme paketi senaryoları listede kalmaz

  @s1 @suites @empty @mock
  Senaryo: NEXA-UI-0083 - Boş test paketi yanıltıcı eski senaryo göstermez
    Diyelim ki seçilen test paketinde senaryo yoktur
    Ne zaman kullanıcı bu paketi açar
    O zaman boş paket durumu görünür
    Ve önceki paketten kalan senaryo satırları temizlenir

  @s1 @suites @create @mock
  Senaryo: NEXA-UI-0084 - Yeni test paketi adı zorunlu doğrulanır
    Diyelim ki kullanıcı test paketleri alanındadır
    Ne zaman kullanıcı boş paket adıyla paket oluşturmayı dener
    O zaman zorunlu alan uyarısı görünür
    Ve paket ağacına boş adlı kayıt eklenmez

  @s1 @suites @duplicate @mock
  Senaryo: NEXA-UI-0085 - Aynı seviyede yinelenen paket adı reddedilir
    Diyelim ki "Kimlik Doğrulama" adlı paket zaten vardır
    Ne zaman kullanıcı aynı ebeveyn altında aynı adı tekrar oluşturur
    O zaman yinelenen paket uyarısı görünür
    Ve paket ağacında ikinci kopya oluşmaz

  @s1 @cases @create @mock
  Senaryo: NEXA-UI-0086 - Inline test senaryosu başlığı boşsa kayıt yapılmaz
    Diyelim ki kullanıcı test senaryoları listesindedir
    Ne zaman kullanıcı inline yeni senaryo alanını boş bırakıp kaydeder
    O zaman başlık zorunlu uyarısı görünür
    Ve listede boş başlıklı senaryo oluşmaz

  @s1 @cases @create @mock
  Senaryo: NEXA-UI-0087 - Inline test senaryosu doğru pakete eklenir
    Diyelim ki "Ödeme Akışları" paketi seçilidir
    Ne zaman kullanıcı inline alandan yeni senaryo oluşturur
    O zaman yeni senaryo seçili paketin listesinde görünür
    Ve başka pakete sessizce eklenmez

  @s2 @cases @long-title @mock
  Senaryo: NEXA-UI-0088 - Çok uzun test senaryosu başlığı tablo düzenini bozmaz
    Diyelim ki yeni test senaryosu çok uzun tek parça başlığa sahiptir
    Ne zaman senaryo listeye eklenir
    O zaman başlık hücre içinde taşmadan gösterilir
    Ve hızlı işlem butonları görünür kalır

  @s1 @cases @filter @mock
  Senaryo: NEXA-UI-0089 - Öncelik filtresi sadece eşleşen test senaryolarını gösterir
    Diyelim ki listede CRITICAL ve LOW öncelikli senaryolar vardır
    Ne zaman kullanıcı CRITICAL filtresini seçer
    O zaman yalnızca kritik senaryolar görünür
    Ve düşük öncelikli senaryolar listeden çıkar

  @s1 @cases @deleted @mock
  Senaryo: NEXA-UI-0090 - Silinen test senaryosu normal listede görünmez
    Diyelim ki bir test senaryosu soft delete durumundadır
    Ne zaman kullanıcı aktif test senaryoları listesini açar
    O zaman silinen senaryo görünmez
    Ve silinenler görünümü ayrıca erişilebilir kalır

  @s1 @cases @restore @mock
  Senaryo: NEXA-UI-0091 - Silinen test senaryosu geri yüklenince doğru pakete döner
    Diyelim ki silinenler görünümünde bir senaryo vardır
    Ne zaman kullanıcı geri yükleme aksiyonunu çalıştırır
    O zaman senaryo eski paketinde görünür
    Ve silinenler listesinden kaldırılır

  @s0 @cases @hard-delete @mock
  Senaryo: NEXA-UI-0092 - Kalıcı silme onaysız çalışmaz
    Diyelim ki admin silinen test senaryoları görünümündedir
    Ne zaman kullanıcı kalıcı silme aksiyonunu başlatır
    O zaman onay diyaloğu görünür
    Ve onay verilmeden kayıt kalıcı olarak silinmez

  @s1 @case-detail @load @mock
  Senaryo: NEXA-UI-0093 - Test senaryosu detayı doğru temel bilgileri yükler
    Diyelim ki kullanıcı test senaryosu satırına tıklamıştır
    Ne zaman detay sayfası açılır
    O zaman başlık, öncelik, durum ve paket bilgisi doğru görünür
    Ve başka senaryonun adımları karışmaz

  @s1 @case-detail @save @mock
  Senaryo: NEXA-UI-0094 - Başlık güncellemesi sonrası listeye dönünce yeni başlık görünür
    Diyelim ki kullanıcı test senaryosu detayında başlığı değiştirmiştir
    Ne zaman değişiklikleri kaydeder ve listeye döner
    O zaman listede güncel başlık görünür
    Ve eski başlık cache'ten geri gelmez

  @s1 @case-detail @validation @mock
  Senaryo: NEXA-UI-0095 - Test senaryosu başlığı boş kaydedilemez
    Diyelim ki kullanıcı test senaryosu detayındadır
    Ne zaman başlık alanını boşaltıp kaydetmeye çalışır
    O zaman başlık zorunlu uyarısı görünür
    Ve önceki geçerli başlık veritabanında korunur

  @s1 @case-detail @priority @mock
  Senaryo: NEXA-UI-0096 - Öncelik değişikliği kaydedilmeden listeye yansımaz
    Diyelim ki kullanıcı test senaryosu detayında önceliği değiştirmiştir
    Ne zaman kullanıcı kaydetmeden sayfadan ayrılır
    O zaman kullanıcıya kaydedilmemiş değişiklik uyarısı görünür
    Ve liste eski önceliği göstermeye devam eder

  @s0 @case-detail @data-loss @mock
  Senaryo: NEXA-UI-0097 - Manuel adım düzenleme sırasında API hatası adımları silmez
    Diyelim ki kullanıcı manuel adımları düzenlemiştir
    Ve kayıt endpointi 500 yanıtı dönecektir
    Ne zaman kullanıcı kaydet aksiyonuna basar
    O zaman hata mesajı görünür
    Ve düzenlenen adımlar form üzerinde korunur

  @s1 @steps @add @mock
  Senaryo: NEXA-UI-0098 - Yeni manuel adım sıralamanın sonuna eklenir
    Diyelim ki test senaryosunda iki manuel adım vardır
    Ne zaman kullanıcı yeni manuel adım ekler
    O zaman yeni adım üçüncü sırada görünür
    Ve önceki adımların beklenen sonuçları değişmez

  @s1 @steps @delete @mock
  Senaryo: NEXA-UI-0099 - Manuel adım silme yalnızca seçilen adımı kaldırır
    Diyelim ki test senaryosunda üç manuel adım vardır
    Ne zaman kullanıcı ikinci adımı siler
    O zaman ikinci adım listeden kaldırılır
    Ve birinci ve üçüncü adım içerikleri korunur

  @s1 @steps @reorder @mock
  Senaryo: NEXA-UI-0100 - Manuel adım sırası kaydedildikten sonra yenilemede korunur
    Diyelim ki kullanıcı manuel adımların sırasını değiştirmiştir
    Ne zaman kullanıcı kaydeder ve sayfayı yeniler
    O zaman adımlar yeni sırayla görünür
    Ve adım numaraları tekrarlanmaz

  @s2 @steps @keyboard @mock
  Senaryo: NEXA-UI-0101 - Manuel adım alanları klavye ile erişilebilir kalır
    Diyelim ki kullanıcı manuel adımlar sekmesindedir
    Ne zaman Tab tuşuyla aksiyon ve beklenen sonuç alanları arasında ilerler
    O zaman odak görünür şekilde ilerler
    Ve kaydet butonuna klavye ile ulaşılır

  @s1 @automation @tab @mock
  Senaryo: NEXA-UI-0102 - Otomasyon sekmesi mevcut senaryo akışını gösterir
    Diyelim ki test senaryosuna bağlı otomasyon akışı vardır
    Ne zaman kullanıcı otomasyon sekmesini açar
    O zaman akıştaki adımlar doğru sırayla görünür
    Ve bağlı olmayan adımlar akışta görünmez

  @s1 @automation @step-library @mock
  Senaryo: NEXA-UI-0103 - Otomasyon adım kütüphanesi proje bazında filtrelenir
    Diyelim ki iki projeye ait otomasyon adımları vardır
    Ne zaman kullanıcı project-sales test senaryosunda otomasyon sekmesini açar
    O zaman yalnızca bu projeye ait adımlar görünür
    Ve başka proje locator değerleri görünmez

  @s1 @automation @create-step @mock
  Senaryo: NEXA-UI-0104 - Manuel otomasyon adımı zorunlu locator olmadan kaydedilemez
    Diyelim ki kullanıcı yeni otomasyon adımı oluşturma formundadır
    Ne zaman ad adı girip locator alanını boş bırakır
    O zaman locator zorunlu uyarısı görünür
    Ve adım kütüphanesine eksik kayıt eklenmez

  @s1 @automation @create-step @mock
  Senaryo: NEXA-UI-0105 - Otomasyon adımı action type değerini doğru kaydeder
    Diyelim ki kullanıcı yeni otomasyon adımı oluşturur
    Ve action type olarak "FILL" seçer
    Ne zaman adımı kaydeder
    O zaman adım listesinde FILL tipi görünür
    Ve varsayılan NAVIGATE tipiyle ezilmez

  @s1 @automation @suggestions @mock
  Senaryo: NEXA-UI-0106 - HTML analiz önerileri kullanıcı onayı olmadan akışa eklenmez
    Diyelim ki kullanıcı HTML analizinden öneriler üretmiştir
    Ne zaman öneri listesi görünür
    O zaman öneriler pasif aday olarak listelenir
    Ve kullanıcı seçmeden otomasyon senaryosuna eklenmez

  @s1 @automation @suggestions @mock
  Senaryo: NEXA-UI-0107 - Seçilen HTML önerisi doğru locator ve aksiyonla adım olur
    Diyelim ki HTML analiz önerileri görünmektedir
    Ne zaman kullanıcı e-posta alanı önerisini seçip ekler
    O zaman otomasyon adımı e-posta locator değeriyle oluşur
    Ve action type FILL olarak görünür

  @s1 @automation @dry-run @mock
  Senaryo: NEXA-UI-0108 - Dry-run başarılı akışta PASS sonucu ve süre gösterir
    Diyelim ki otomasyon senaryosunda geçerli adımlar vardır
    Ne zaman kullanıcı dry-run çalıştırır
    O zaman PASS sonucu görünür
    Ve çalıştırma süresi ve log satırları gösterilir

  @s1 @automation @dry-run @mock
  Senaryo: NEXA-UI-0109 - Dry-run başarısız adımı belirgin gösterir
    Diyelim ki otomasyon senaryosunda hatalı locator içeren adım vardır
    Ne zaman kullanıcı dry-run çalıştırır
    O zaman FAIL sonucu görünür
    Ve başarısız adım adı ve hata mesajı kullanıcıya gösterilir

  @s0 @automation @data-leak @mock
  Senaryo: NEXA-UI-0110 - Dry-run logları parola değişkenini maskeleyerek gösterir
    Diyelim ki otomasyon senaryosunda PASSWORD değişkeni vardır
    Ne zaman kullanıcı dry-run sonucunu görüntüler
    O zaman parola değeri düz metin olarak görünmez
    Ve loglarda maskeleme kullanılır

  @s1 @automation @variables @mock
  Senaryo: NEXA-UI-0111 - Değişken eksikse dry-run açık hata verir
    Diyelim ki otomasyon adımı "${EMAIL}" değişkenini kullanır
    Ve değişken setinde EMAIL yoktur
    Ne zaman kullanıcı dry-run çalıştırır
    O zaman eksik değişken hatası görünür
    Ve test yanlışlıkla PASS sayılmaz

  @s1 @automation @reorder @mock
  Senaryo: NEXA-UI-0112 - Otomasyon adım sırası kaydedildikten sonra korunur
    Diyelim ki kullanıcı otomasyon senaryo adımlarını yeniden sıralamıştır
    Ne zaman değişiklikleri kaydeder ve sayfayı yeniler
    O zaman adımlar yeni sırayla görünür
    Ve dry-run aynı sırayı kullanır

  @s1 @automation @remove-step @mock
  Senaryo: NEXA-UI-0113 - Akıştan adım kaldırma kütüphane adımını silmez
    Diyelim ki otomasyon akışında kütüphaneden eklenmiş bir adım vardır
    Ne zaman kullanıcı adımı senaryo akışından kaldırır
    O zaman adım akıştan çıkar
    Ve adım kütüphanesinde tekrar kullanılabilir kalır

  @s1 @automation @empty-flow @mock
  Senaryo: NEXA-UI-0114 - Boş otomasyon akışı dry-run çalıştırmaz
    Diyelim ki test senaryosunda otomasyon adımı yoktur
    Ne zaman kullanıcı dry-run aksiyonunu görür
    O zaman aksiyon pasif veya açıklamalı görünür
    Ve boş akış PASS olarak raporlanmaz

  @s1 @automation @quick-generate @mock
  Senaryo: NEXA-UI-0115 - Manuel adımlardan otomasyon üretimi kullanıcının mevcut akışını ezmez
    Diyelim ki otomasyon akışında iki özel adım vardır
    Ne zaman kullanıcı manuel adımlardan otomasyon üretmeyi dener
    O zaman kullanıcıya mevcut akışın üzerine yazma onayı sorulur
    Ve onay verilmeden mevcut akış değişmez

  @s2 @automation @long-locator @mock
  Senaryo: NEXA-UI-0116 - Çok uzun locator metni otomasyon kartını bozmaz
    Diyelim ki otomasyon adımı çok uzun CSS locator içerir
    Ne zaman adım kartı listede görünür
    O zaman locator metni taşmadan kırılır veya kısaltılır
    Ve kart aksiyonları tıklanabilir kalır

  @s1 @cases @quick-run @mock
  Senaryo: NEXA-UI-0117 - Hızlı test başlatma doğru test senaryosu için koşu oluşturur
    Diyelim ki kullanıcı test senaryosu listesinde bir satırdadır
    Ne zaman kullanıcı "Hızlı Test" aksiyonunu çalıştırır
    O zaman yeni koşu bu test senaryosunu içerir
    Ve kullanıcı oluşturulan koşu detayına yönlendirilir

  @s1 @cases @quick-run @mock
  Senaryo: NEXA-UI-0118 - Hızlı test başlatma yetkisiz kullanıcıya kapalıdır
    Diyelim ki TESTER rolündeki kullanıcının koşu oluşturma yetkisi yoktur
    Ne zaman kullanıcı test senaryosu satırındaki hızlı test aksiyonunu görüntüler
    O zaman aksiyon görünmez veya pasif olur
    Ve doğrudan istek gönderildiğinde 403 davranışı korunur

  @s0 @attachments @case-detail @mock
  Senaryo: NEXA-UI-0119 - Test senaryosu ekleri başka senaryoya karışmaz
    Diyelim ki iki test senaryosunun farklı ek dosyaları vardır
    Ne zaman kullanıcı birinci senaryonun ekler alanını açar
    O zaman yalnızca bu senaryoya ait ekler görünür
    Ve ikinci senaryonun kanıt dosyaları listelenmez

  @s1 @attachments @case-detail @mock
  Senaryo: NEXA-UI-0120 - Ek dosya silme onay verilmeden gerçekleşmez
    Diyelim ki test senaryosunda bir ek dosya vardır
    Ne zaman kullanıcı silme aksiyonunu başlatır
    O zaman onay diyaloğu görünür
    Ve onay verilmeden ek dosya listeden kaldırılmaz

