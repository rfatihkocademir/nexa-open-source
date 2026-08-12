# language: tr
@board_columns @agile @matrix @p1
Özellik: Özelleştirilebilir Kanban Board Kolonları ve WIP Limitleri
  Kullanıcılar proje düzeyinde kendilerine özel board kolonları tanımlayabilmeli ve süreçleri kısıtlayabilmelidir.

  @s1 @columns
  Senaryo Taslağı: NEXA-UI-4501 - Board kolonu ekleme, güncelleme ve silme (Soft Delete)
    Diyelim ki kullanıcı "Agile Ayarları" sayfasındadır
    Ne zaman "<islem>" butonuna basıp "<veri>" girerse
    O zaman sistem "<sonuc>" yanıtı verir

    Örnekler:
      | islem          | veri           | sonuc       | aciklama               |
      | Yeni Kolon Ekle| "Testing"      | Başarılı    | Yeni kolon boarda gelir|
      | Limit (WIP) Ayarla | "5"        | Başarılı    | Maksimum kart sınırı   |
      | Limit (WIP) Ayarla | "-1"       | Hata        | Negatif limit olamaz   |
      | Kolon Sil      | "Testing"      | Başarılı    | Kolon arşivlenir (Soft)|

  @s2 @wip_limit
  Senaryo: NEXA-UI-4502 - WIP (Work In Progress) limitinin aşılması
    Diyelim ki "In Progress" kolonunun WIP limiti "3" olarak ayarlanmıştır
    Ve bu kolonda halihazırda 3 adet kart bulunmaktadır
    Ne zaman kullanıcı 4. bir kartı bu kolona sürükleyip bırakırsa
    O zaman sistem "WIP limiti aşıldı" uyarısı verir
    Ve (ayarlara göre) kartı geri atar veya kırmızı uyarı ile kabul eder
