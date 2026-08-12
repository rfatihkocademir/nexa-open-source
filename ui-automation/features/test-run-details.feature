# language: tr
@regression @mock @p1
Özellik: Test Koşusu Detayları ve Yürütme Varyasyonları
  Test koşusu sırasında sonuç girişi, kanıt ekleme, atama değişiklikleri ve karmaşık durumlar yönetilmelidir.

  Arka Plan:
    Diyelim ki kullanıcı TESTER olarak giriş yapmıştır
    Ve aktif bir test koşusunda "TC-101 - Login Testi" öğesini açmıştır

  @s1 @manual
  Senaryo: NEXA-UI-2201 - Test adımlarını tek tek onaylayarak ilerleme
    Ne zaman kullanıcı 1. adımı "Geçti" işaretler
    Ve 2. adımı "Geçti" işaretler
    O zaman testin genel durumu "Test Ediliyor" olarak görünür
    Ve tüm adımlar bitene kadar nihai sonuç oluşmaz

  @s0 @failure
  Senaryo: NEXA-UI-2202 - Bir adım "Kaldı" işaretlendiğinde testin otomatik başarısız olması
    Ne zaman kullanıcı 3. adımı "Kaldı" olarak işaretler
    Ve bir hata açıklaması girer
    O zaman testin nihai durumu otomatik olarak "Başarısız" (FAIL) olur
    Ve kullanıcıdan kanıt/görsel yüklemesi istenir

  @s2 @attachments
  Senaryo: NEXA-UI-2203 - Başarısız teste sürükle-bırak ile ekran görüntüsü ekleme
    Diyelim ki test "Başarısız" durumundadır
    Ne zaman kullanıcı "Hata Ekranı.png" dosyasını sonuç alanına sürükleyip bırakırsa
    O zaman görsel yüklendi bildirimi alınır
    Ve "Kanıtlar" sekmesinde resmin küçük önizlemesi görünür

  @s1 @blocking
  Senaryo: NEXA-UI-2204 - Testin "Engellendi" (Blocked) olarak işaretlenmesi
    Ne zaman kullanıcı "Dış sistem kapalı, test edilemiyor" gerekçesiyle testi "Engellendi" yapar
    O zaman bu test koşu listesinde gri renkle "BLOCKED" olarak görünür
    Ve bu testin başarısızlık (Fail) oranına etkisi olmaz

  @s2 @retest
  Senaryo: NEXA-UI-2205 - "Yeniden Test Et" (Retest) aksiyonu ile önceki sonucun temizlenmesi
    Diyelim ki test daha önce "Başarısız" olmuştur
    Ne zaman kullanıcı "Yeniden Test Et" butonuna basarsa
    O zaman eski "FAIL" etiketi kalkar
    Ve test tekrar "Test Edilmedi" (Untested) durumuna döner

  @s3 @assignment
  Senaryo: NEXA-UI-2206 - Koşu anında testin başka bir ekip arkadaşına devredilmesi
    Ne zaman kullanıcı "Atama" menüsünden "Ayşe Yılmaz"ı seçerse
    O zaman testin atanan kişisi güncellenir
    Ve kullanıcının ekranından bu test kalkar

  @s1 @history
  Senaryo: NEXA-UI-2207 - Testin yürütme geçmişini (Execution History) görüntüleme
    Ne zaman kullanıcı "Yürütme Geçmişi" sekmesini açarsa
    O zaman bu testin daha önce hangi tarihlerde, kim tarafından ve hangi sonuçla koşulduğunu görür
    Ve eski bir sonucun detaylarına tıklayarak o anki hata mesajını okuyabilir

  @s2 @navigation
  Senaryo: NEXA-UI-2208 - Koşu detay ekranında klavye kısayolları (J/K) ile gezinme
    Ne zaman kullanıcı "J" tuşuna basarsa
    O zaman bir sonraki test öğesine odaklanır
    Ve "K" tuşuna basarsa bir önceki öğeye döner
