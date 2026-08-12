# 5000 Gercek UI Otomasyon Senaryosu Plani

Bu planin hedefi otomatik uretilmis tekrarli BDD satirlari degil, Nexa uygulamasinda farkli hata seviyelerinden gercek hatalar bulabilecek 5000 farkli UI senaryosu yazmaktir.

## Senaryo Tanimi

Bir senaryo ancak asagidaki alanlari tasiyorsa hedef sayiya dahil edilir:

| Alan | Kural |
| --- | --- |
| ID | `NEXA-UI-0001` formatinda benzersiz olur. |
| Risk | Senaryonun yakalamayi hedefledigi hata turu acik yazilir. |
| Severity | `S0`, `S1`, `S2`, `S3` seviyelerinden biri atanir. |
| Rol | TESTER, TEAM_LEADER, ADMIN veya yetkisiz/anonim kullanici belirtilir. |
| Veri durumu | Bos, standart, buyuk, bozuk, yetkisiz, gecikmeli veya canli veri baglami belirtilir. |
| Adimlar | Kullanici aksiyonu gercek ekran ve kontrol isimleriyle yazilir. |
| Oracle | Hatanin nasil fark edilecegi net beklenen sonuc olarak yazilir. |
| Otomasyon | Mock, live veya hibrit calisma modu belirtilir. |

## Severity Hedefi

| Severity | Hedef | Hata Profili |
| --- | ---: | --- |
| S0 | 350 | Veri kaybi, yetki acigi, oturum sızıntısı, kritik akisin tamamen durmasi. |
| S1 | 1150 | Ana is akisi kirilmasi, yanlis karar verdiren veri, release/test sonuc sapmasi. |
| S2 | 2200 | Form, filtre, durum, liste, senkronizasyon, validasyon ve regresyon hatalari. |
| S3 | 1300 | Kullanilabilirlik, metin, bos durum, erisilebilirlik ve kenar deneyim hatalari. |
| Toplam | 5000 |  |

## Hata Turu Dagilimi

| Hata Turu | Hedef |
| --- | ---: |
| Negatif akis ve validasyon | 900 |
| Yetki, rol ve guvenlik | 550 |
| Veri butunlugu ve state senkronizasyonu | 650 |
| Boundary, uzun veri ve buyuk liste | 700 |
| Mutlu yol ve kritik smoke | 650 |
| API hata cevabi, timeout ve yeniden deneme | 500 |
| Erisilebilirlik, klavye ve responsive | 450 |
| AI, otomasyon ve karar destek yanilmalari | 400 |
| Raporlama, sayac ve metrik tutarsizligi | 200 |
| Toplam | 5000 |

## Modul Dagilimi

| Modul | Hedef |
| --- | ---: |
| Kimlik, oturum, sifre ve RBAC | 320 |
| Dashboard, navigasyon ve global layout | 220 |
| Proje portfoyu ve proje detay genel bakis | 520 |
| AI destekli proje sihirbazi ve dokuman uretilmesi | 420 |
| Test paketleri, test senaryolari ve test case editoru | 700 |
| Otomasyon kurucu, dry-run, step library ve degiskenler | 420 |
| Test kosulari, yurutme, sonuc kaydi ve bug'a donusum | 620 |
| Raporlar, metrikler ve karsilastirma gorunumleri | 260 |
| Wiki, ek dosyalar ve bilgi tabani | 300 |
| Izlenebilirlik, release, milestone ve karar surecleri | 520 |
| Kullanici yonetimi, profil, bildirim ve admin | 420 |
| Entegrasyon, is talepleri, audit ve gozlemlenebilirlik | 280 |
| Erisilebilirlik, responsive, offline ve bozuk veri regresyonlari | 500 |
| Toplam | 5000 |

## Teslim Plani

| Paket | Hedef | Kapsam | Cikis Kriteri |
| --- | ---: | --- | --- |
| P0 | 250 | En kritik smoke, login, RBAC, proje, test kosusu, sonuc kaydi. | 250 senaryo BDD + en az 60 Playwright spec. |
| P1 | 750 | Ana modullerin negatif ve boundary varyasyonlari. | Toplam 1000 senaryo + S0/S1 kapsami gorunur. |
| P2 | 1000 | AI sihirbaz, otomasyon kurucu, release, traceability, raporlar. | Toplam 2000 senaryo + mock data genisletmesi. |
| P3 | 1000 | Buyuk veri, bozuk API cevabi, timeout, concurrency, refresh state. | Toplam 3000 senaryo + hata enjeksiyon mocklari. |
| P4 | 1000 | Admin, bildirim, profil, wiki, ek dosya, integrasyon. | Toplam 4000 senaryo + live smoke ayrimi. |
| P5 | 1000 | Cross-browser, responsive, a11y, regresyon ve uretim benzeri veri. | Toplam 5000 senaryo + gece kosumu profili. |

## Yazim Kurali

Senaryolar `features/` altinda modul bazli dosyalara yazilir. Bir senaryo ayni hatayi ayni rol, ayni veri durumu ve ayni ekranda tekrar test ediyorsa hedef sayiya dahil edilmez.

Ornek format:

```gherkin
@s1 @rbac @negative @mock
Senaryo: NEXA-UI-0001 - Test uzmani admin kullanici listesine URL ile giremez
  Diyelim ki TESTER rolundeki kullanici sisteme giris yapmistir
  Ve kullanicinin admin yetkisi yoktur
  Ne zaman kullanici "/admin/users" adresini dogrudan acar
  O zaman 403 erisim engellendi sayfasi gorunur
  Ve kullanici listesi API yaniti veya hassas veri ekranda gorunmez
```

## Uygulama Sirasi

1. Mevcut 66 BDD senaryosu kalite acisindan korunur ve ID standardina tasinir.
2. Her modul icin once S0/S1 hata avlama senaryolari yazilir.
3. Her yeni senaryo icin mock veri gereksinimi ayni PR icinde eklenir.
4. Playwright spec'e donusecek senaryolar `coverage-matrix.md` uzerinden isaretlenir.
5. `npm --prefix ui-automation run bdd:count` her paket sonunda sayiyi raporlar.

## P0 Durumu

P0 BDD hedefi tamamlandi: mevcut 66 senaryoya ek olarak 184 yeni elle kurate edilmis senaryo yazildi ve toplam BDD sayisi 250 oldu.
P0 Playwright hedefi de tamamlandi: 38 yeni calisan spec eklendi ve toplam calisan UI otomasyon testi 60 oldu.

| Dosya | Yeni Senaryo |
| --- | ---: |
| `features/p0-auth-rbac.feature` | 40 |
| `features/p0-projects-wizard.feature` | 40 |
| `features/p0-test-design-automation.feature` | 40 |
| `features/p0-runs-results-reports.feature` | 40 |
| `features/p0-admin-wiki-resilience.feature` | 24 |
| Toplam | 184 |

| Spec Dosyasi | Calisan Test |
| --- | ---: |
| `tests/specs/p0-auth-rbac.spec.ts` | 8 |
| `tests/specs/p0-projects-wizard.spec.ts` | 8 |
| `tests/specs/p0-test-design.spec.ts` | 8 |
| `tests/specs/p0-runs-reports.spec.ts` | 8 |
| `tests/specs/p0-governance-admin.spec.ts` | 6 |
| P0 ek toplam | 38 |
| Tum Playwright toplam | 60 |

P0 sirasinda yakalanip duzeltilen urun/test altyapisi sorunlari:

- `milestone.service` ve `release.service` axios interceptor yanitini bir katman fazla actigi icin milestone ve release ekranlari veriyi gorebiliyordu; servisler diger servislerle ayni yanit sozlesmesine tasindi.
- Mock API'de `/projects/:id` handler'i nested wiki/release endpoint'lerini yakalayabiliyordu; proje detay rotasi yalnizca tek segment proje detayina daraltildi.
- Run report mock'u ozet sayaclariyla uyumsuz sabit case listesi uretiyordu; rapor detaylari artik run item'larindan turetiliyor.

Siradaki is P1 paketidir: toplam hedefi 1000 senaryoya cikarmak icin ana modullerin negatif, boundary ve state senkronizasyon varyasyonlari elle yazilacak ve calisan spec'e donusturulecek.
