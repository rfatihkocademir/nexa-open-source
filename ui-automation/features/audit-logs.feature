# language: tr
@audit @compliance @p1
Özellik: Denetim Kayıtları (Audit Logs) ve Uyumluluk İzleme
  Sistemdeki tüm kritik işlemler (silme, yetki değişimi, veri güncelleme) izlenebilir ve raporlanabilir olmalıdır.

  Arka Plan:
    Diyelim ki ADMIN rolünde kullanıcı "Denetim Kayıtları" sayfasındadır

  @s1 @search
  Senaryo: NEXA-UI-2501 - Aktör (Kullanıcı) ismine göre denetim kaydı arama
    Ne zaman kullanıcı "Aktör" filtresine "Ramazan" yazarsa
    O zaman sadece Ramazan tarafından gerçekleştirilen işlemler listelenir
    Ve işlemin yapıldığı tarih, IP adresi ve detaylar tablo şeklinde görünür

  @s1 @entity_filter
  Senaryo: NEXA-UI-2502 - Varlık türüne (Entity Type) göre filtreleme
    Ne zaman kullanıcı "Varlık Türü" olarak "Project" seçerse
    O zaman sadece projeler üzerinde yapılan (oluşturma, silme, arşivleme) işlemler gösterilir
    Ve "User" veya "TestCase" ile ilgili kayıtlar gizlenir

  @s2 @details
  Senaryo: NEXA-UI-2503 - Değişiklik detaylarını (Before/After) inceleme
    Diyelim ki bir projenin adı değiştirilmiştir
    Ne zaman kullanıcı bu işlemin yanındaki "Detay" butonuna basarsa
    O zaman eski değer (Before) ve yeni değer (After) JSON veya yan yana tablo formatında görünür

  @s2 @export
  Senaryo: NEXA-UI-2504 - Denetim kayıtlarının CSV olarak dışa aktarılması
    Ne zaman kullanıcı "Kayıtları İndir" butonuna basarsa
    O zaman mevcut filtrelere uygun tüm denetim geçmişi bir CSV dosyasına yazılır
    Ve indirme işlemi başarıyla tamamlanır

  @s1 @security
  Senaryo: NEXA-UI-2505 - Başarısız giriş denemelerinin denetim günlüğüne düşmesi
    Diyelim ki "Hatalı Giriş Denemesi" gerçekleşmiştir
    O zaman denetim kayıtlarında "Action: LOGIN_FAILED" ve ilgili e-posta adresiyle bir kayıt oluşur
    Ve bu kayıt admin tarafından "Güvenlik İhlalleri" sekmesinde izlenebilir

  @s2 @retention
  Senaryo: NEXA-UI-2506 - Eski denetim kayıtlarının arşivlenme politikası
    Diyelim ki sistemde 1 yıldan eski kayıtlar mevcuttur
    Ne zaman admin "Arşiv Politikası"nı çalıştırırsa
    O zaman 1 yıldan eski kayıtlar ana listeden kalkar
    Ve "Arşivlenmiş Kayıtlar" alanına taşınır
