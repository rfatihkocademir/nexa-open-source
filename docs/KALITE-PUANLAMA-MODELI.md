# Nexa kalite puanlama modeli

## Amaç

Modelin amacı tek başına pass oranına dayanan ve küçük örneklemlerde yanıltıcı olabilen kalite kararlarını engellemektir. Bütün hesaplar deterministiktir; aynı release kapsamı ve aynı kanıtlar her zaman aynı sonucu üretir. Yapay zekâ değerlendirmesi matematiksel kalite kapısını değiştiremez.

## Ölçülen boyutlar

| Boyut | Hesap | Bileşik skordaki ağırlık |
|---|---:|---:|
| Pass güveni | %95 Wilson güven aralığının alt sınırı | %28 |
| Test yürütme | Yürütülen / planlanan | %16 |
| Onaylı test kapsamı | Onaylı test case / toplam test case | %16 |
| İzlenebilirlik | İzlenebilir iş / kapsamdaki iş | %12 |
| Hata sağlığı | Hata risk puanına uygulanan üstel ceza | %20 |
| Kanıt güveni | Test sayısı arttıkça doygunluğa ulaşan güven | %8 |

Boyutlar aritmetik ortalamayla değil, ağırlıklı geometrik ortalamayla birleştirilir:

`Q = 100 × exp(Σ(wᵢ × ln(max(0.001, dᵢ))) / Σwᵢ)`

Bu tercih, bir boyuttaki ciddi eksikliğin başka bir boyuttaki yüksek sonuçla maskelenmesini engeller.

## İstatistiksel pass güveni

Ham pass oranı `p̂ = pass / yürütülen` olarak gösterilir. Karar desteğinde ayrıca %95 Wilson güven aralığı kullanılır. Bu nedenle 10 testin 10'unun geçmesi ile 1000 testin 1000'inin geçmesi aynı güven seviyesinde değildir:

- 10/10: alt güven sınırı yaklaşık %72,25
- 1000/1000: alt güven sınırı yaklaşık %99,62

## Hata risk puanı

Hata risk puanı aşağıdaki şiddet katsayılarıyla hesaplanır:

- Kritik: 13 puan
- Yüksek: 5 puan
- Orta: 2 puan
- Düşük: 0,5 puan

Hata sağlığı `exp(-riskPuanı / max(5, kapsamdakiİşSayısı))` formülüyle hesaplanır. Kritik hata ayrıca kalite kapısında kesin engel oluşturur; kurum riski kabul edecekse bu durum gizlenmeden, tüm paydaşların gerekçeli oybirliğiyle istisna sürecine girer.

## Regresyon eğilimi

Son 12 tamamlanmış koşum eskiden yeniye sıralanır. En küük kareler doğrusunun eğimi kalite yönünü, `α = 0,35` olan EWMA yakın dönem seviyesini, standart sapma ise oynaklığı gösterir.

- Eğim > 0,35 puan/koşum: iyileşiyor
- Eğim < -0,35 puan/koşum: kötüleşiyor
- Aradaki değerler: stabil
- Üçten az koşum: yetersiz veri

## Tier eşikleri

| Tier | Ham pass | Wilson alt sınır | Bileşik skor | Yürütme | Yüksek hata |
|---|---:|---:|---:|---:|---|
| Tier 0 | %99,5 | %97 | 95 | %100 | Engeller |
| Tier 1 | %98 | %95 | 90 | %100 | Engeller |
| Tier 2 | %95 | %90 | 82 | %98 | Koşullu risk |
| Tier 3 | %90 | %80 | 70 | %90 | Koşullu risk |

Her tier'da açık kritik hata engelleyicidir. Düşen regresyon eğilimi ve başarısız/bloklu/çakışmalı testler uyarı üretir. Kalite snapshot'ı; metrikleri, tier politikasını ve kapsam hash'ini deploy mutabakatıyla birlikte saklar.
