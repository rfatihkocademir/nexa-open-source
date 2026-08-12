# language: tr
@regression @mock
Özellik: Release governance
  Release adayları, karar kayıtları ve takip öğeleri tek yüzeyde yönetilmeli; AI özeti karar sürecini desteklemelidir.

  Arka Plan:
    Diyelim ki kullanıcı TEAM_LEADER olarak giriş yapmıştır
    Ve proje release hub'ını açmıştır

  Senaryo: Release hub özet kartları ve mevcut aday görünür
    O zaman "Release governance" başlığı görünmelidir
    Ve hazırlık skoru kartı görünmelidir
    Ve toplam aday sayısı görünmelidir
    Ve "Sprint 24 Release Candidate" kartı listede yer almalıdır

  Senaryo: Kullanıcı yeni bir release candidate oluşturur
    Ne zaman kullanıcı "Yeni release candidate" butonuna basarsa
    Ve başlığı "Sprint 25 Release Candidate" olarak girerse
    Ve etiketi "2026.04-rc1" olarak belirlerse
    Ve özet alanını doldurursa
    Ve bağlı koşulardan birini seçerse
    Ve aday oluşturur
    O zaman yeni release candidate listede görünmelidir
    Ve durum etiketi "Taslak" olmalıdır

  Senaryo: Release candidate detay sayfası karar ve AI özetini gösterir
    Diyelim ki kullanıcı "Sprint 24 Release Candidate" detayına gider
    O zaman karar kapsamı bölümü görünmelidir
    Ve release sağlığı kartları görünmelidir
    Ve bağlı koşular listelenmelidir
    Ve AI release özeti görünmelidir
    Ve başlıca riskler ile önerilen aksiyonlar görünmelidir

  Senaryo: Kullanıcı karar kaydedip takip öğesi oluşturur
    Diyelim ki kullanıcı release candidate detay sayfasındadır
    Ne zaman kullanıcı "Kapsam" kararını açar
    Ve sonucu "Onaylandı" seçer
    Ve güven değerini "0.92" girer
    Ve geçerli bir gerekçe yazar
    Ve kararı kaydeder
    O zaman karar geçmişine yeni kayıt eklenmelidir
    Ve ardından önerilen bir aksiyondan takip öğesi oluşturulabilmelidir
