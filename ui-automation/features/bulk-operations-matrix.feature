# language: tr
@bulk_operations @import_export @matrix @p1
Özellik: Yığın İşlemler (Bulk Actions) ve Veri İçe/Dışa Aktarımı (Import/Export)
  Büyük projelerde binlerce test case ve gereksinimin aynı anda güncellenmesi veya CSV üzerinden sisteme yüklenmesi gereklidir.

  @s1 @bulk_edit
  Senaryo Taslağı: NEXA-UI-5101 - Çoklu seçim (Multi-Select) ile toplu alan güncellemesi
    Diyelim ki listede 50 adet Test Case seçilmiştir
    Ne zaman kullanıcı "Toplu Düzenle" menüsünden "<alan>" bilgisini "<yeni_deger>" olarak güncellerse
    O zaman sistem seçili olan tüm (50 adet) kaydın sadece o alanını değiştirir

    Örnekler:
      | alan         | yeni_deger | aciklama                     |
      | Priority     | CRITICAL   | Öncelikleri yükseltme        |
      | Status       | APPROVED   | Toplu onaylama (Eğer yetki varsa) |
      | Assignee     | "User X"   | Toplu kişi ataması           |
      | Etiketler (Tags)| "Regresyon"| Mevcut etiketlerin üzerine ekleme |

  @s2 @import
  Senaryo Taslağı: NEXA-UI-5102 - CSV formatında toplu test case içe aktarma (Import) matrisi
    Diyelim ki kullanıcı "Test Case Import" aracını açmıştır
    Ne zaman kullanıcı "<csv_durumu>" içeriğine sahip bir dosya yüklerse
    O zaman sistemin verdiği içe aktarma özeti "<beklenen_sonuc>" şeklinde olur

    Örnekler:
      | csv_durumu                        | beklenen_sonuc               | aciklama                      |
      | 100 geçerli satır, eksiksiz veri | "100 eklendi, 0 hatalı"       | Sorunsuz içe aktarım          |
      | 50 geçerli, 5 zorunlu alan boş   | "50 eklendi, 5 hatalı satır"  | Kısmi başarı                  |
      | Yanlış başlık (Headers) olan dosya| "Geçersiz CSV şablonu"        | Format hatası, hiçbiri eklenmez|
      | 100.000 satırlık devasa dosya     | "Sınır aşıldı (Max 5000)"     | Performans koruması           |
