# language: tr
@search @filters @p1
Özellik: Küresel Arama, Çoklu Sıralama ve Dinamik Filtreleme
  Kullanıcılar binlerce kayıt arasından istedikleri veriye hızlıca ve doğru kriterlerle ulaşabilmelidir.

  @s1 @global_search
  Senaryo Taslağı: NEXA-UI-3201 - Üst menüden küresel arama (Global Search)
    Diyelim ki sistemde farklı türden kayıtlar mevcuttur
    Ne zaman kullanıcı arama kutusuna "<terim>" yazarsa
    O zaman sonuçlar arasında "<beklenen_kayit>" görünür

    Örnekler:
      | terim     | beklenen_kayit        | aciklama               |
      | NEXA-101  | TC-101 Test Case      | ID ile arama           |
      | Login     | Login Story / Case    | Metin ile arama        |
      | Ramazan   | Ramazan (Kullanıcı)   | Kullanıcı arama        |
      | Wiki      | Wiki Sayfası          | Varlık türü arama      |

  @s2 @sorting
  Senaryo Taslağı: NEXA-UI-3202 - Tablo kolonlarında çoklu sıralama
    Diyelim ki kullanıcı "Test Case" listesindedir
    Ne zaman kullanıcı "<kolon>" başlığına tıklarsa
    O zaman liste "<yon>" şeklinde sıralanır

    Örnekler:
      | kolon    | yon      | aciklama               |
      | Başlık   | A'dan Z'ye | Alfabetik artan        |
      | Başlık   | Z'den A'ya | Alfabetik azalan       |
      | Öncelik  | Yüksekten Düşüğe | Önem sırası      |
      | Tarih    | Yeniden Eskiye | Zaman sırası        |

  @s1 @combined_filters
  Senaryo: NEXA-UI-3203 - Kombine filtreleme: Birden fazla kriterin aynı anda uygulanması
    Diyelim ki projede 100 test case vardır
    Ne zaman kullanıcı "Öncelik: KRİTİK" VE "Durum: BAŞARISIZ" VE "Atanan: BEN" filtrelerini seçerse
    O zaman ekranda sadece bu ÜÇ şartı da sağlayan kayıtlar kalır
    Ve filtre çubuğunda "3 Aktif Filtre" etiketi görünür

  @s2 @no_results
  Senaryo: NEXA-UI-3204 - Arama sonucu bulunamadığında "Boş Durum" (Empty State) uyarısı
    Ne zaman kullanıcı arama kutusuna "X-Y-Z-Geçersiz-Kayıt" yazarsa
    O zaman tabloda kayıt görünmez
    Ve "Aradığınız kriterlere uygun sonuç bulunamadı" görseli ve metni görüntülenir
