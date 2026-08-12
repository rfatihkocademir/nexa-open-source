# language: tr
@automation @ai @step_suggestion @matrix @p1
Özellik: AI Destekli Otomasyon Adımı Önerisi (Step Suggestion)
  Test otomasyonu yazılırken AI, sayfanın HTML yapısını (DOM) analiz ederek kullanıcıya mantıklı bir sonraki adımı önerebilmelidir.

  @s2 @suggestions
  Senaryo Taslağı: NEXA-UI-4901 - HTML girdisine (DOM Snapshot) göre adım tahmini
    Diyelim ki kullanıcı "Yeni Otomasyon Adımı" ekranındadır
    Ne zaman sisteme sayfanın "<html_girdisi>" snapshot'ı iletilirse
    O zaman AI "<beklenen_aksiyon>" eylemini ve "<beklenen_locator>" hedefini önerir

    Örnekler:
      | html_girdisi                                     | beklenen_aksiyon | beklenen_locator    | aciklama                   |
      | "<button id='login-btn'>Giriş Yap</button>"      | CLICK            | "#login-btn"        | Buton tıklaması            |
      | "<input type='email' name='userEmail' />"        | FILL             | "input[name='userEmail']"| Veri girişi                 |
      | "<div class='alert-error'>Hatalı Şifre</div>"    | ASSERT_VISIBLE   | ".alert-error"      | Hata kontrolü              |
      | "Boş veya anlamsız metin"                        | (Boş Öneri)      | (Boş)               | Geçersiz HTML girdisi      |

  @s3 @context_awareness
  Senaryo: NEXA-UI-4902 - Bağlam farkındalığı: Önceki adıma göre öneri
    Diyelim ki kullanıcının yazdığı son adım "FILL: username_input" şeklindedir
    Ne zaman kullanıcı yeni bir öneri talep ederse
    O zaman AI "FILL: password_input" veya "CLICK: submit_button" gibi mantıksal sıraya uygun (Context-Aware) öneriler sunar
