# Operasyonel Dayanıklılık ve Canlıya Çıkış Kontrolü

Bu katman, kurumun hizmet hedeflerini ve felaket kurtarma hazırlığını ölçülebilir kanıtlarla yönetir. Yönetim ekranı **Yönetim > Operasyonel dayanıklılık** adresindedir.

## Sağlık uçları

- `GET /health/live`: Sürecin çalıştığını bildirir. Kubernetes/PM2 liveness kontrolünde kullanılmalıdır.
- `GET /health/ready`: PostgreSQL, migration durumu, Redis ve obje depolamayı ayrı ayrı ölçer. Zorunlu bir bağımlılık sağlıksızsa HTTP 503 döner ve instance trafik havuzuna alınmamalıdır.
- Her bağımlılık için gecikme milisaniye olarak raporlanır; kimlik bilgileri veya bağlantı ayrıntıları dışarı verilmez.

## SLO ve hata bütçesi

Kimliği doğrulanmış kurum trafiği saatlik kalıcı bucket'larda tutulur. Ölçülen değerler:

- kullanılabilirlik oranı,
- HTTP 5xx hata oranı,
- P95 yanıt süresi,
- tüketilen ve kalan hata bütçesi.

Varsayılan hedefler `%99,9` kullanılabilirlik, `%1` azami hata, `800 ms` P95'tir. Kurum yöneticisi bunları politika ekranından değiştirebilir. Hata bütçesi tükendiğinde operasyonel durum riskli olur.

## RPO, RTO ve kanıt zinciri

- Başarılı yedek kaydı, 64 karakterlik SHA-256 checksum olmadan kabul edilmez.
- Başarılı geri yükleme tatbikatı, ölçülen RPO ve RTO olmadan kabul edilmez.
- Yedeğin yaşı kurum politikasındaki azami süreyi geçerse canlıya çıkış engeli oluşur.
- Tatbikat sonucu hedeflenen RPO/RTO'yu aşarsa canlıya çıkış engeli oluşur.
- Kanıtı kaydeden kullanıcı, zaman, referans ve sonuç kalıcı olarak saklanır; işlem audit zincirine yazılır.

En az üç ayda bir geri yükleme tatbikatı yapılması; kritik kurumlarda aylık yapılması önerilir. Tatbikat yalnızca yedeğin açılmasını değil, uygulamanın restore edilen veritabanı ve obje deposuyla ayağa kalkmasını kapsamalıdır.

## Bakım modu

Bakım modu etkinleştirildiğinde yönetici dışındaki kullanıcı istekleri kurumun belirlediği açıklamayla HTTP 503 alır. Yönetici erişimi açık kalır; böylece bakım modu güvenle kapatılabilir. İsteğe bağlı bitiş zamanı geçmişse mod otomatik olarak etkisizleşir.

## Güvenli saklama temizliği

Kalıcı silme varsayılan olarak kapalıdır. Açmak için:

```env
ENABLE_RETENTION_PURGE=true
SOFT_DELETE_RETENTION_DAYS=90
```

Süre en az 30 gündür. Kurum veya proje seviyesinde aktif legal hold bulunan projelerde hiçbir kalıcı silme yapılmaz. Canlı ortamda bu ayar açılmadan önce saklama politikası ve hukuk onayı doğrulanmalıdır.

## Canlıya çıkış kararı

Operasyonel ekran aşağıdaki durumları engel olarak gösterir:

- altyapı readiness başarısızlığı,
- güncel ve checksum'lı yedek bulunmaması,
- başarılı geri yükleme tatbikatı bulunmaması,
- RPO veya RTO hedef ihlali,
- SLO ihlali,
- SIEM dead-letter kayıtları,
- bütünlük imzası olmayan audit kayıtları.

Ekranın `READY` göstermesi teknik kontrolün geçtiğini ifade eder; iş onayı, güvenlik onayı ve değişiklik yönetimi adımları ayrıca tamamlanmalıdır.
