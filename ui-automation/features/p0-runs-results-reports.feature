# language: tr
@p0 @runs @results @reports @release @manual
Özellik: P0 test koşusu, sonuç, rapor ve release hata avı
  Bu dosya test koşuları, yürütme listesi, sonuç kaydı, raporlar ve release kararları için kritik hata yakalama senaryolarını içerir.

  @s1 @runs @empty-state @live @mock
  Senaryo: NEXA-UI-0121 - Koşu listesi boşken önceki koşu sonuçları görünmez
    Diyelim ki kullanıcının erişebildiği test koşusu yoktur
    Ne zaman test koşuları sayfası açılır
    O zaman boş durum mesajı görünür
    Ve önceki oturumdan kalan koşu satırı görünmez

  @s1 @runs @filter @mock
  Senaryo: NEXA-UI-0122 - Açık koşu filtresi kapalı koşuları gizler
    Diyelim ki listede açık ve kapalı koşular vardır
    Ne zaman kullanıcı açık koşu filtresini seçer
    O zaman yalnızca açık koşular görünür
    Ve kapalı koşu satırları listeden çıkar

  @s1 @runs @ai-focus @mock
  Senaryo: NEXA-UI-0123 - AI focus failed-runs sadece başarısız koşuları gösterir
    Diyelim ki kullanıcı "/runs?aiFocus=failed-runs" adresini açmıştır
    Ne zaman koşu listesi yüklenir
    O zaman başarısız veya blokajlı koşular görünür
    Ve tamamen başarılı koşular listelenmez

  @s1 @runs @search @mock
  Senaryo: NEXA-UI-0124 - Koşu araması ortam bilgisiyle yanlış eşleşme üretmez
    Diyelim ki QA ve PROD ortamlarında koşular vardır
    Ne zaman kullanıcı arama alanına "QA" yazar
    O zaman yalnızca QA ile ilişkili kayıtlar görünür
    Ve PROD koşuları sonuçta kalmaz

  @s1 @runs @create @mock
  Senaryo: NEXA-UI-0125 - Yeni koşu test senaryosu seçilmeden oluşturulamaz
    Diyelim ki kullanıcı yeni koşu formundadır
    Ne zaman hiçbir test senaryosu seçmeden kaydetmeye çalışır
    O zaman test senaryosu seçimi zorunlu uyarısı görünür
    Ve boş koşu kaydı oluşmaz

  @s1 @runs @create @mock
  Senaryo: NEXA-UI-0126 - Yeni koşu seçili test senaryolarını eksiksiz içerir
    Diyelim ki kullanıcı üç test senaryosu seçmiştir
    Ne zaman yeni koşu oluşturulur
    O zaman koşu detayında üç yürütme itemı görünür
    Ve seçili senaryolardan biri sessizce düşmez

  @s1 @runs @create @mock
  Senaryo: NEXA-UI-0127 - Koşu oluşturma çift tıklama ile iki kayıt üretmez
    Diyelim ki koşu oluşturma endpointi gecikmeli dönecektir
    Ne zaman kullanıcı oluştur butonuna iki kez hızlıca basar
    O zaman tek koşu oluşturulur
    Ve kullanıcıya yüklenme durumu gösterilir

  @s1 @run-detail @load @mock
  Senaryo: NEXA-UI-0128 - Koşu detayı doğru proje ve ortam bilgisini gösterir
    Diyelim ki kullanıcı koşu listesinde "Sprint 24 Regresyon" satırını açmıştır
    Ne zaman koşu detay sayfası yüklenir
    O zaman koşu başlığı, proje adı ve ortam bilgisi doğru görünür
    Ve başka koşunun itemları karışmaz

  @s1 @run-detail @not-found @mock
  Senaryo: NEXA-UI-0129 - Var olmayan koşu adresi güvenli bulunamadı durumu gösterir
    Diyelim ki kullanıcı giriş yapmıştır
    Ne zaman "/runs/olmayan-kosu" adresini açar
    O zaman bulunamadı veya güvenli hata ekranı görünür
    Ve önceki koşu detay verisi ekranda kalmaz

  @s1 @execution @manual-result @mock
  Senaryo: NEXA-UI-0130 - PASS sonucu kaydı item sayacını günceller
    Diyelim ki koşu detayında UNTESTED durumunda bir item vardır
    Ne zaman kullanıcı item sonucunu PASS olarak kaydeder
    O zaman item PASS görünür
    Ve koşu özetindeki geçen sayısı bir artar

  @s1 @execution @manual-result @mock
  Senaryo: NEXA-UI-0131 - FAIL sonucu açıklama ve kanıtla birlikte kaydedilir
    Diyelim ki koşu itemı yürütme modundadır
    Ne zaman kullanıcı FAIL sonucu, açıklama ve kanıt bağlantısı girer
    O zaman sonuç kaydı başarısız olarak görünür
    Ve açıklama ile kanıt bağlantısı detayda korunur

  @s1 @execution @validation @mock
  Senaryo: NEXA-UI-0132 - BLOCK sonucu gerekçe olmadan kaydedilemez
    Diyelim ki kullanıcı bir koşu itemını BLOCK olarak işaretlemiştir
    Ne zaman gerekçe girmeden kaydetmeye çalışır
    O zaman gerekçe zorunlu uyarısı görünür
    Ve item eski durumunda kalır

  @s0 @execution @data-integrity @mock
  Senaryo: NEXA-UI-0133 - Sonuç kaydı yanlış koşu itemına yazılmaz
    Diyelim ki koşuda iki farklı item vardır
    Ne zaman kullanıcı ikinci item için FAIL sonucu kaydeder
    O zaman sadece ikinci item FAIL görünür
    Ve birinci itemın sonucu değişmez

  @s1 @execution @next-item @mock
  Senaryo: NEXA-UI-0134 - Sonuç kaydı sonrası sonraki itema geçiş doğru çalışır
    Diyelim ki koşu yürütme listesinde birden fazla item vardır
    Ne zaman kullanıcı ilk item sonucunu kaydeder
    O zaman aktif odak sonraki itema geçer
    Ve kaydedilen item sonucu korunur

  @s1 @execution @step-results @mock
  Senaryo: NEXA-UI-0135 - Adım bazlı sonuçlar genel item sonucuyla çelişmez
    Diyelim ki item manuel adımlara sahiptir
    Ne zaman bir adım FAIL olarak işaretlenir
    O zaman genel item sonucu başarısız veya dikkat gerektirir görünür
    Ve tüm adımlar PASS değilken item PASS sayılmaz

  @s1 @execution @automation-result @mock
  Senaryo: NEXA-UI-0136 - Otomasyon sonucu manuel sonucu izinsiz ezmez
    Diyelim ki item manuel olarak FAIL kaydedilmiştir
    Ne zaman otomasyon sonucu PASS döner
    O zaman kullanıcıya sonuç çakışması gösterilir
    Ve manuel karar kullanıcı onayı olmadan ezilmez

  @s0 @execution @bug-conversion @mock
  Senaryo: NEXA-UI-0137 - Başarısız itemdan bug oluşturma test sonucu bağlantısını korur
    Diyelim ki koşu itemı FAIL durumundadır
    Ne zaman kullanıcı "Bug'a Dönüştür" aksiyonunu çalıştırır
    O zaman bug kaydı ilgili test sonucu ve proje ile bağlanır
    Ve bug detayında kaynak koşu bilgisi görünür

  @s1 @execution @bug-conversion @mock
  Senaryo: NEXA-UI-0138 - PASS item için bug'a dönüştürme aksiyonu görünmez
    Diyelim ki koşu itemı PASS durumundadır
    Ne zaman kullanıcı item aksiyonlarını açar
    O zaman "Bug'a Dönüştür" aksiyonu görünmez veya pasif olur
    Ve yanlışlıkla başarılı itemdan bug açılmaz

  @s1 @execution @close-run @mock
  Senaryo: NEXA-UI-0139 - Açık item varken koşu kapatma uyarı gösterir
    Diyelim ki koşuda UNTESTED itemlar vardır
    Ne zaman kullanıcı koşuyu kapatmaya çalışır
    O zaman açık item uyarısı görünür
    Ve onaysız kapatma yapılmaz

  @s0 @execution @delete-run @mock
  Senaryo: NEXA-UI-0140 - Koşu silme onaysız ve yetkisiz çalışmaz
    Diyelim ki kullanıcı koşu detayındadır
    Ne zaman silme aksiyonunu başlatır
    O zaman onay diyaloğu görünür
    Ve yetkisiz kullanıcı için silme aksiyonu hiç görünmez

  @s1 @reports @empty-state @live @mock
  Senaryo: NEXA-UI-0141 - Rapor listesi boşken eski rapor detayı görünmez
    Diyelim ki kullanıcının rapor kaydı yoktur
    Ne zaman raporlar sayfası açılır
    O zaman "Rapor bulunamadı" mesajı görünür
    Ve önceki rapor başlığı veya başarı oranı görünmez

  @s1 @reports @summary @mock
  Senaryo: NEXA-UI-0142 - Rapor başarı oranı koşu sonuçlarından doğru hesaplanır
    Diyelim ki koşuda PASS, FAIL, BLOCK ve UNTESTED itemlar vardır
    Ne zaman rapor detayı açılır
    O zaman başarı oranı yalnızca doğru sonuçlardan hesaplanır
    Ve yüzde değeri "NaN%" veya negatif görünmez

  @s1 @reports @tabs @mock
  Senaryo: NEXA-UI-0143 - Başarısız sekmesi yalnızca FAIL itemları gösterir
    Diyelim ki rapor detayında farklı sonuç durumları vardır
    Ne zaman kullanıcı "Başarısız" sekmesini açar
    O zaman yalnızca FAIL itemlar listelenir
    Ve PASS veya UNTESTED itemlar görünmez

  @s1 @reports @blocked @mock
  Senaryo: NEXA-UI-0144 - Bloklu sekmesi BLOCK item gerekçesini gösterir
    Diyelim ki raporda BLOCK durumlu item vardır
    Ne zaman kullanıcı bloklu sekmesini açar
    O zaman blok gerekçesi görünür
    Ve gerekçe alanı boşsa kullanıcıya eksik bilgi uyarısı verilir

  @s1 @reports @direct-url @mock
  Senaryo: NEXA-UI-0145 - Yetkisiz rapor detay adresi veri sızdırmaz
    Diyelim ki kullanıcı başka projeye ait rapora yetkili değildir
    Ne zaman kullanıcı rapor detay URLini doğrudan açar
    O zaman yetki engeli veya bulunamadı ekranı görünür
    Ve rapor özet metrikleri ekranda görünmez

  @s2 @reports @export @mock
  Senaryo: NEXA-UI-0146 - Rapor export hatası kullanıcıyı boş sayfaya düşürmez
    Diyelim ki rapor export endpointi hata dönecektir
    Ne zaman kullanıcı export aksiyonunu çalıştırır
    O zaman hata bildirimi görünür
    Ve rapor detay ekranı kullanılabilir kalır

  @s1 @reports @comparison @mock
  Senaryo: NEXA-UI-0147 - Karşılaştırma raporu veri yokken güvenli boş durum gösterir
    Diyelim ki koşu için karşılaştırma verisi yoktur
    Ne zaman kullanıcı karşılaştırma raporunu açar
    O zaman boş karşılaştırma durumu görünür
    Ve uygulama grafik hatasıyla kırılmaz

  @s1 @reports @stale @mock
  Senaryo: NEXA-UI-0148 - Rapor detayından başka rapora geçiş eski grafiği ekranda bırakmaz
    Diyelim ki kullanıcı bir rapor detayını görüntülemiştir
    Ne zaman kullanıcı başka rapor detayına geçer
    O zaman başlık ve grafikler yeni rapora göre yenilenir
    Ve eski raporun başarısız itemları listede kalmaz

  @s1 @release @hub @mock
  Senaryo: NEXA-UI-0149 - Release hub özet kartları bağlı koşu verisiyle tutarlıdır
    Diyelim ki release adayına bağlı test koşuları vardır
    Ne zaman release hub açılır
    O zaman açık koşu ve başarısız item sayıları bağlı veriye göre görünür
    Ve sayılar negatif veya boş görünmez

  @s1 @release @create @mock
  Senaryo: NEXA-UI-0150 - Release candidate başlığı boşsa oluşturulamaz
    Diyelim ki kullanıcı release candidate oluşturma formundadır
    Ne zaman başlık girmeden kaydetmeye çalışır
    O zaman başlık zorunlu uyarısı görünür
    Ve yeni release kaydı oluşmaz

  @s1 @release @create @mock
  Senaryo: NEXA-UI-0151 - Release candidate seçili koşularla doğru bağlanır
    Diyelim ki kullanıcı iki test koşusu seçerek release candidate oluşturur
    Ne zaman kayıt başarılı olur
    O zaman release detayında iki bağlı koşu görünür
    Ve seçilmeyen koşular bağlı gibi gösterilmez

  @s1 @release @ai-summary @mock
  Senaryo: NEXA-UI-0152 - AI release özeti yoksa karar ekranı kırılmaz
    Diyelim ki release candidate için AI özeti bulunmamaktadır
    Ne zaman release detayı açılır
    O zaman güvenli boş AI özeti görünür
    Ve karar kaydetme alanı kullanılabilir kalır

  @s0 @release @decision @mock
  Senaryo: NEXA-UI-0153 - Release kararı gerekçe olmadan onaylanamaz
    Diyelim ki kullanıcı release karar formundadır
    Ne zaman gerekçe girmeden APPROVED kararı kaydetmeye çalışır
    O zaman gerekçe uyarısı görünür
    Ve karar geçmişine eksik kayıt eklenmez

  @s0 @release @decision @mock
  Senaryo: NEXA-UI-0154 - Kritik açık bug varken READY kararı uyarı gerektirir
    Diyelim ki release adayında kritik açık bug vardır
    Ne zaman kullanıcı release'i READY olarak işaretlemeye çalışır
    O zaman kritik risk uyarısı görünür
    Ve kullanıcı onaysız yayın kararını tamamlayamaz

  @s1 @release @follow-up @mock
  Senaryo: NEXA-UI-0155 - Release takip işi kaynak aksiyon bilgisiyle oluşur
    Diyelim ki release AI özeti takip aksiyonu önermiştir
    Ne zaman kullanıcı takip işi oluşturur
    O zaman takip işi kaynak aksiyon türü ve odak bilgisiyle görünür
    Ve release detayında açık takip sayısı güncellenir

  @s1 @release @follow-up @mock
  Senaryo: NEXA-UI-0156 - Aynı release takip işi iki kez oluşturulmaz
    Diyelim ki kullanıcı takip işi oluşturma aksiyonuna basmıştır
    Ve istek gecikmeli dönecektir
    Ne zaman kullanıcı aksiyona tekrar basar
    O zaman tek takip işi oluşur
    Ve açık takip sayısı bir artar

  @s1 @milestone @runs @mock
  Senaryo: NEXA-UI-0157 - Kilometre taşı detayında bağlı koşular doğru listelenir
    Diyelim ki kilometre taşına bağlı iki test koşusu vardır
    Ne zaman kilometre taşı detayı açılır
    O zaman bağlı koşu adları görünür
    Ve başka kilometre taşına ait koşular listelenmez

  @s1 @milestone @complete @mock
  Senaryo: NEXA-UI-0158 - Açık koşu varken kilometre taşı tamamlamada uyarı görünür
    Diyelim ki kilometre taşına bağlı açık koşu vardır
    Ne zaman kullanıcı kilometre taşını tamamlamaya çalışır
    O zaman açık koşu uyarısı görünür
    Ve tamamlandı durumu onaysız uygulanmaz

  @s1 @traceability @coverage @mock
  Senaryo: NEXA-UI-0159 - İzlenebilirlik kapsam boşluğu doğru epic üzerinde görünür
    Diyelim ki bir epic içinde test senaryosu olmayan story vardır
    Ne zaman izlenebilirlik matrisi açılır
    O zaman kapsam boşluğu aynı epic altında işaretlenir
    Ve başka epic hatalı riskli görünmez

  @s1 @traceability @ai-focus @mock
  Senaryo: NEXA-UI-0160 - Coverage gap AI odağı matrisi doğru daraltır
    Diyelim ki izlenebilirlik matrisinde kapalı ve açık kapsamlar vardır
    Ne zaman kullanıcı coverage-gaps odağını açar
    O zaman sadece kapsam eksiği olan storyler görünür
    Ve tam kapsanan storyler sonuçtan çıkar

