# language: tr
@analytics @dashboard @p1
Özellik: Dashboard, Analitik ve Karar Destek Metrikleri
  Yöneticiler ve ekip liderleri projenin genel durumunu dashboard üzerinden izler. Verilerin doğruluğu ve güncelliği esastır.

  @s1 @charts
  Senaryo: NEXA-UI-0901 - Dashboard üzerinde "Geçme Oranı" (Pass Rate) grafiği
    Diyelim ki bir projede son 7 günde 5 test koşusu yapılmıştır
    Ne zaman kullanıcı Dashboard sayfasını açarsa
    O zaman "Pass Rate" pasta grafiği (Pie Chart) toplam sonuçları doğru oranlarla gösterir
    Ve üzerine gelindiğinde (hover) net rakamlar ("34 Geçti, 12 Kaldı") belirir

  @s2 @filters
  Senaryo: NEXA-UI-0902 - Global Dashboard filtreleri: Tarih aralığı seçimi
    Diyelim ki kullanıcı dashboard sayfasındadır
    Ne zaman tarih filtresini "Son 30 Gün"den "Bugün"e çekerse
    O zaman tüm widget'lar (Hata sayısı, Koşu özeti) anlık olarak güncellenir
    Ve sadece bugüne ait veriler listelenir

  @s1 @widgets
  Senaryo: NEXA-UI-0903 - "Kritik Açık Buglar" widget'ı ve detaylara gitme
    Diyelim ki projede 3 adet "CRITICAL" seviyesinde bug mevcuttur
    Ne zaman kullanıcı dashboard'daki "Kritik Buglar" sayısına tıklarsa
    O zaman sistem otomatik olarak "İş Öğeleri" sayfasına gider
    Ve sadece o 3 kritik bug filtrelenmiş şekilde listelenir

  @s2 @performance
  Senaryo: NEXA-UI-0904 - Büyük veri setinde dashboard yüklenme hızı
    Diyelim ki projede 10.000+ test sonucu mevcuttur
    Ne zaman dashboard sayfası açılırsa
    O zaman sayfa "skeleton loader" (iskelet yükleyici) ile açılır
    Ve ana metrikler 3 saniyenin altında yüklenir
    Ve tarayıcı sekmesi donmaz

  @s1 @activity_feed
  Senaryo: NEXA-UI-0905 - "Son Aktiviteler" akışında gerçek zamanlı güncellemeler
    Diyelim ki "Tester A" bir testi onaylamıştır
    Ne zaman Team Leader dashboard sayfasını yenilemeden izlerse
    O zaman "Son Aktiviteler" listesinde "Tester A bir testi onayladı" kaydı anlık olarak belirir
    Ve ilgili kayda tıklandığında test detayı açılır

  @s3 @customization
  Senaryo: NEXA-UI-0906 - Dashboard widget'larının yerini değiştirme (Drag & Drop)
    Diyelim ki kullanıcı dashboard sayfasındadır
    Ne zaman "Hata Trendi" grafiğini tutup en üst sıraya sürüklerse
    O zaman widget'ların sırası değişir
    Ve bu tercih kullanıcının yerel ayarlarında (Local Storage) saklanır

  @s2 @export
  Senaryo: NEXA-UI-0907 - Dashboard özetinin PDF olarak dışa aktarılması
    Diyelim ki kullanıcı haftalık rapor hazırlamaktadır
    Ne zaman "Raporu Dışa Aktar > PDF" butonuna basarsa
    O zaman dashboard görünümü mevcut filtrelerle PDF dosyasına dönüştürülür
    Ve grafikler okunabilir kalitede dosyaya eklenir
