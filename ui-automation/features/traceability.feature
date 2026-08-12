# language: tr
@traceability @ai @p1
Özellik: Gelişmiş İzlenebilirlik ve Etki Analizi
  Değişikliklerin sistemin diğer parçaları üzerindeki etkisi otomatik olarak analiz edilmeli ve riskler raporlanmalıdır.

  @s1 @impact_analysis
  Senaryo: NEXA-UI-1801 - Story içeriği değiştiğinde bağlı testlerin "IMPACTED" olması
    Diyelim ki "Giriş Ekranı Yenileme" isimli bir Story ve ona bağlı 5 onaylı test case mevcuttur
    Ne zaman kullanıcı Story açıklamasını köklü şekilde değiştirirse
    O zaman sistem "Bağlı 5 test case etkilendi" bildirimi verir
    Ve bu testlerin durumu otomatik olarak "NEEDS_REVIEW" (Gözden Geçirilmeli) olur

  @s0 @graph
  Senaryo: NEXA-UI-1802 - İzlenebilirlik Grafiği (Traceability Graph) görselleştirmesi
    Diyelim ki bir gereksinim -> story -> test case -> test run zinciri mevcuttur
    Ne zaman kullanıcı "İzlenebilirlik Haritası"nı açarsa
    O zaman tüm bu öğeler arasındaki bağlantılar bir ağ (graph) diyagramı olarak görünür
    Ve kopuk olan (orphan) öğeler kırmızı ile vurgulanır

  @s1 @ai @gap_analysis
  Senaryo: NEXA-UI-1803 - AI ile Kapsama Açığı (Gap Analysis) tespiti
    Diyelim ki bir projede 10 Story mevcuttur ancak sadece 8 tanesinin test case'i yazılmıştır
    Ne zaman kullanıcı "AI Kapsama Analizi" butonuna basarsa
    O zaman AI "Testi yazılmamış 2 adet Story bulundu" raporunu sunar
    Ve bu story'ler için taslak test adımları önerir

  @s2 @sync
  Senaryo: NEXA-UI-1804 - GitHub PR'ın Story durumuna ve Test statüsüne etkisi
    Diyelim ki bir Story "READY_FOR_TEST" durumundadır
    Ne zaman ilgili GitHub PR'ı "Declined" (Reddedildi) olursa
    O zaman Nexa'daki Story durumu otomatik olarak "IN_PROGRESS"e geri çekilir
    Ve test uzmanına "Geliştirme geri çekildi, testi bekletin" notu düşer

  @s1 @decision_audit
  Senaryo: NEXA-UI-1805 - Karar Kayıtları (Decision Records) ile sürüm onayı
    Diyelim ki bir Sürüm Adayı (RC) için 3 farklı Team Leader "APPROVED" oyu vermiştir
    Ne zaman oylama tamamlanırsa
    O zaman sürümün "Readiness Score"u yükselir
    Ve "Karar Geçmişi" sekmesinde kimin neden onay verdiği dökümante edilir
