# language: tr
@projects @p1
Özellik: Proje Yönetimi ve Portfolyo Operasyonları
  Projeler, sistemin ana organizasyon birimleridir. Proje yaşam döngüsü ve üye yetkileri titizlikle yönetilmelidir.

  @s1 @settings
  Senaryo: NEXA-UI-1601 - Proje logosu yükleme ve önizleme
    Diyelim ki kullanıcı "Proje Ayarları" sayfasındadır
    Ne zaman bir PNG dosyası seçip "Logo Güncelle" butonuna basarsa
    O zaman proje logosu güncellenir
    Ve yan menüde yeni logo anlık olarak görüntülenir

  @s2 @archiving
  Senaryo: NEXA-UI-1602 - Projenin arşivlenmesi ve salt-okunur (read-only) moda geçmesi
    Diyelim ki bir proje "ACTIVE" durumundadır
    Ne zaman admin projenin durumunu "ARCHIVED" yaparsa
    O zaman proje listesinde "Arşivlenmiş" etiketiyle görünür
    Ve kullanıcılar bu proje içinde yeni test case veya koşu oluşturamaz

  @s1 @members
  Senaryo: NEXA-UI-1603 - Projeye yeni üye ekleme ve rolünü güncelleme
    Diyelim ki admin proje üyeleri sekmesindedir
    Ne zaman "User X"i projeye "DEVELOPER" rolüyle davet ederse
    O zaman "User X" projesine erişim sağlar
    Ve admin daha sonra bu rolü "TEAM_LEADER" olarak güncelleyebilir

  @s0 @transfer
  Senaryo: NEXA-UI-1604 - Proje sahipliğinin başka bir kullanıcıya devredilmesi
    Diyelim ki "Admin A" projenin yaratıcısıdır
    Ne zaman "Sahipliği Devret" diyerek "Admin B"yi seçerse
    O zaman projenin tam yönetim yetkisi "Admin B"ye geçer
    Ve "Admin A" artık projeyi silemez

  @s2 @tags
  Senaryo: NEXA-UI-1605 - Proje bazlı özel etiketler (Tags) tanımlama
    Diyelim ki kullanıcı proje ayarlarında "Etiketler" sekmesindedir
    Ne zaman "Regresyon" ve "Kritik" adında iki renkli etiket tanımlarsa
    O zaman bu etiketler projedeki tüm test case'lerde seçim listesinde belirir

  @s1 @portfolio
  Senaryo: NEXA-UI-1606 - Portfolyo görünümü: Tüm projelerin sağlık durumunu tek ekranda izleme
    Diyelim ki kullanıcının 5 farklı projesi mevcuttur
    Ne zaman "Tüm Projeler" (Portfolio) sayfasını açarsa
    O zaman her projenin yanındaki "Sağlık Barı" (Health Bar) son test geçme oranlarını gösterir
    Ve "FAIL" oranı yüksek olan projeler uyarı verir

  @s3 @deletion
  Senaryo: NEXA-UI-1607 - Proje silme onayı ve veri kaybı uyarısı
    Diyelim ki admin bir projeyi silmek istemektedir
    Ne zaman "Projeyi Sil" butonuna basarsa
    O zaman sistem "Bu işlem geri alınamaz, lütfen proje adını yazarak onaylayın" uyarısı verir
    Ve yanlış isim girildiğinde "Sil" butonu aktif olmaz
