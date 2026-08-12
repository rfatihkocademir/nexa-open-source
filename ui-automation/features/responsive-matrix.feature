# language: tr
@responsive @ui @matrix @p1
Özellik: Çoklu Cihaz ve Responsive Görünüm Matrisi
  Uygulama arayüzü; masaüstü, tablet ve mobil cihazlarda doğru şekilde render edilmeli, menüler ve tablolar erişilebilir kalmalıdır.

  @s2 @layout
  Senaryo Taslağı: NEXA-UI-2901 - Kritik sayfaların farklı ekran boyutlarında düzeni
    Diyelim ki kullanıcı "<sayfa>" sayfasını "<cihaz>" boyutunda (genişlik: <genislik>px) açmıştır
    O zaman sayfa düzeni "<beklenen_davranis>" kuralına uygun olmalıdır

    Örnekler:
      | sayfa        | cihaz      | genislik | beklenen_davranis                      |
      | Dashboard    | Desktop    | 1920     | Tüm widget'lar yan yana (Grid) görünür |
      | Dashboard    | Tablet     | 768      | Widget'lar 2'li sıra halinde dizilir   |
      | Dashboard    | Mobile     | 375      | Tüm widget'lar tek sütun (Stack) olur  |
      | Projeler     | Mobile     | 375      | Tablo yerine kart görünümü (Card) gelir|
      | Test Case    | Mobile     | 375      | Yan menü gizlenir (Hamburger menu)     |
      | Raporlar     | Tablet     | 1024     | Grafikler %100 genişliğe yayılır       |
      | Agile Board  | Desktop    | 2560     | Ultra-wide ekran desteği (Max-width)   |
      | Login        | Mobile     | 320      | Küçük ekranlarda form dikeyde ortalanır|

  @s3 @interaction
  Senaryo Taslağı: NEXA-UI-2902 - Dokunmatik (Touch) cihaz etkileşimleri
    Diyelim ki kullanıcı "<cihaz>" üzerinden uygulamayı kullanmaktadır
    Ne zaman kullanıcı "<islem>" işlemini yaparsa
    O zaman sistem "<tepki>" verir

    Örnekler:
      | cihaz  | islem               | tepki                                |
      | Mobile | Kaydırma (Swipe)    | Yan menü soldan açılır               |
      | Tablet | Uzun Basma (Long)   | Öğe üzerinde aksiyon menüsü açılır   |
      | Mobile | Pinch (Zoom)        | Grafikler büyütülür/küçültülür       |
      | Tablet | Drag & Drop (Board) | Kartlar kolonlar arasında taşınabilir|
