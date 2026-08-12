# language: tr
@scalability @performance @p1
Özellik: Büyük Veri Altında UI Performansı ve Ölçeklenebilirlik
  Uygulama, binlerce test case, koşu ve üye içeren büyük projelerde bile akıcı bir deneyim sunmalıdır.

  @s2 @virtualization
  Senaryo: NEXA-UI-2001 - 1000+ test case içeren listede hızlı kaydırma (Virtual Scrolling)
    Diyelim ki bir projede 5.000 adet test case mevcuttur
    Ne zaman kullanıcı listeyi hızla aşağı kaydırırsa
    O zaman sistem sadece ekranda görünen öğeleri render eder (Virtualization)
    Ve tarayıcı belleği (RAM) aşırı yükselmez
    Ve liste takılmadan akmaya devam eder

  @s1 @pagination
  Senaryo: NEXA-UI-2002 - Sunucu taraflı sayfalama (Server-side Pagination) doğrulaması
    Diyelim ki kullanıcı "İş Öğeleri" sayfasındadır
    Ne zaman kullanıcı "Sayfa 2"ye tıklarsa
    O zaman sistem tüm veriyi frontend'de filtrelemek yerine API'ye "page=2" parametresiyle yeni istek atar
    Ve sadece ilgili 25 kayıt ekrana gelir

  @s2 @search_performance
  Senaryo: NEXA-UI-2003 - Büyük veri setinde anlık arama (Debounce)
    Diyelim ki kullanıcı binlerce kayıt arasından "NEXA-5000"i aramaktadır
    Ne zaman kullanıcı arama kutusuna her harf yazdığında
    O zaman sistem her tuş basımında değil, yazma durduktan 300ms sonra API isteği atar (Debounce)
    Ve gereksiz API trafiği önlenmiş olur

  @s3 @large_content
  Senaryo: NEXA-UI-2004 - Çok uzun test adımları (100+ adım) içeren case render'ı
    Diyelim ki bir test case yanlışlıkla 200 adım içerecek şekilde oluşturulmuştur
    Ne zaman bu test case detay sayfası açılırsa
    O zaman sayfa düzeni (Layout) bozulmaz
    Ve "Adımları Daralt/Genişlet" seçeneği ile kullanıcıya kontrol sunulur

  @s2 @bulk_upload
  Senaryo: NEXA-UI-2005 - CSV/Excel ile toplu 500 test case içe aktarma
    Diyelim ki kullanıcı dışarıdan büyük bir test setini içeri aktarmaktadır (Import)
    Ne zaman 500 satırlık dosya yüklenirse
    O zaman sistem bir "İlerleme Çubuğu" (Progress Bar) gösterir
    Ve işlem bittiğinde "498 Başarılı, 2 Hatalı Satır" şeklinde özet rapor sunar
