# language: tr
@regression @mock
Özellik: Proje detayları
  Proje detay ekranı, genel bakış ve alt sekmeler üzerinden projenin kapsamını, kalite sinyallerini ve iş akışlarını görünür kılmalıdır.

  Senaryo: Genel bakış sekmesi proje özetini gösterir
    Diyelim ki kullanıcı geçerli bir proje detay sayfasına giriyor
    Ne zaman sayfa açılırsa
    O zaman proje adı görünür
    Ve proje açıklaması görünür
    Ve proje metrik kartları görünür
    Ve üst gezinme alanında proje bağlamı görünür

  Senaryo: Geçersiz proje adresi bulunamadı ekranı gösterir
    Diyelim ki kullanıcı sistemde olmayan bir proje kimliği açıyor
    Ne zaman sayfa yanıt verirse
    O zaman proje bulunamadı metni görünür
    Ve kullanıcı projeler listesine geri dönebilir

  Senaryo Taslağı: Sekme yönlendirmeleri doğru URL üretir
    Diyelim ki kullanıcı geçerli bir proje detay sayfasında
    Ne zaman "<rota>" adresine giderse
    O zaman URL, ilgili sekme parametresini taşır
    Ve proje bağlamı korunur

    Örnekler:
      | rota                              |
      | /projects/project-sales/wiki      |
      | /projects/project-sales/board     |
      | /projects/project-sales/ai-analyst |
