# language: tr
@critical @mock
Özellik: Proje oluşturma sihirbazı
  Proje oluşturma sihirbazı, takım liderinin proje kurulumunu adım adım tamamlamasını, AI destekli analizleri görüntülemesini ve zorunlu alanları doğrulamasını sağlamalıdır.

  Senaryo: Sihirbaz dashboard üzerinden açılır
    Diyelim ki kullanıcı takım lideri olarak giriş yaptı
    Ne zaman "Proje Oluştur" aksiyonuna tıklarsa
    O zaman proje kurulum sihirbazı açılır
    Ve ilk adımda proje adı alanı görünür
    Ve kısa açıklama alanı görünür

  Senaryo: Proje adı boş bırakılırsa doğrulama görünür
    Diyelim ki proje oluşturma sihirbazı açık
    Ne zaman kullanıcı hiçbir isim girmeden ilerlemeye çalışırsa
    O zaman zorunlu alan doğrulama mesajı görünür
    Ve kullanıcı aynı adımda kalır

  Senaryo: Proje ismi girildiğinde AI kapsam soruları görünür
    Diyelim ki proje oluşturma sihirbazında geçerli bir isim girildi
    Ne zaman kullanıcı bir sonraki adıma geçerse
    O zaman kapsam analizi adımı açılır
    Ve en az bir AI soru alanı görünür
    Ve kullanıcı isterse analizi atlayabilir

  Senaryo: AI analizini atlayan kullanıcı dokümanlar adımına geçer
    Diyelim ki kapsam analizi adımı açık
    Ve kullanıcı AI sorularını yanıtlamak istemiyor
    Ne zaman "Analizi Atla" aksiyonuna tıklarsa
    O zaman proje dokümanları adımı açılır
    Ve kapsam dokümanı düzenlenebilir durumda görünür
