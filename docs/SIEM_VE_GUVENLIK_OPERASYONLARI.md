# SIEM ve Güvenlik Operasyonları

Yönetim ekranı: **Yönetim → Güvenlik operasyonları** (`/admin/security-operations`)

## Genel yapı

Nexa denetim kayıtlarını HMAC bütünlük zincirinde tutmaya devam eder. SIEM entegrasyonu bu zincirin üzerine eklenen kalıcı bir outbox kullanır. SIEM hedefi geçici olarak erişilemez olsa bile olay kaybolmaz.

Akış:

1. Denetim kaydı bütünlük hash’iyle veritabanına yazılır.
2. Olay kategori ve önem seviyesine ayrılır.
3. Uygun SIEM hedefleri için kalıcı teslimat kaydı oluşturulur.
4. Birincil worker teslimatı HMAC-SHA256 ile imzalayarak gönderir.
5. Hata durumunda 1, 5, 30, 120, 720 ve 1440 dakikalık kademeli yeniden deneme uygulanır.
6. Altıncı başarısız denemede kayıt `DEAD_LETTER` durumuna geçer ve yönetici müdahalesi ister.

## Webhook imza doğrulaması

Her istekte aşağıdaki başlıklar gönderilir:

- `X-Nexa-Event-Id`: Audit kaydının benzersiz kimliği.
- `X-Nexa-Timestamp`: Unix zaman damgası.
- `X-Nexa-Signature`: `sha256=<hex>` biçiminde imza.

İmza girdisi:

```text
timestamp + "." + raw_request_body
```

SIEM tarafı aynı HMAC-SHA256 hesabını tek sefer gösterilen imzalama anahtarıyla yapmalı ve sabit zamanlı karşılaştırma kullanmalıdır. Replay saldırılarına karşı zaman damgası için beş dakikalık tolerans ve `X-Nexa-Event-Id` için tekillik kontrolü uygulanmalıdır.

## Ağ güvenliği

- Üretimde yalnızca HTTPS hedefleri kabul edilir.
- URL içinde kullanıcı adı/parola kullanılamaz.
- Loopback, link-local ve özel ağ adresleri varsayılan olarak reddedilir. Kurum içi SIEM yalnızca alan adı `SIEM_ALLOWED_DOMAINS` içinde açıkça tanımlanırsa kullanılabilir.
- `SIEM_ALLOWED_DOMAINS` tanımlanırsa yalnızca listedeki alan adları ve alt alan adları kullanılabilir.
- Yönlendirmeler takip edilmez; DNS hedefi her teslimatta yeniden doğrulanır.

## Olay yaşam döngüsü

- `OPEN`: Henüz bir operatör tarafından kabul edilmemiş olay.
- `ACKNOWLEDGED`: İnceleme sorumluluğu alınmış olay.
- `RESOLVED`: En az 10 karakterlik çözüm ve kanıt açıklamasıyla kapatılmış olay.

Çözülmüş olay yeniden açılabilir. Kabul, çözüm ve yeniden açma işlemleri de audit zincirine yazılır; ancak yeni bir güvenlik olayı üretmez.

HTTP 401/403 cevapları `SECURITY_UNAUTHORIZED_ACCESS`, 429 cevapları `SECURITY_RATE_LIMIT_TRIGGERED` olarak kaydedilir. Politika ihlali, şüpheli aktivite ve yetkisiz erişim olayları otomatik olarak güvenlik olayına dönüştürülür.

## İmzalama anahtarı yönetimi

Anahtar oluşturma veya rotasyon sonrasında yalnızca bir kez gösterilir. Kurumsal secret kasasına hemen kaydedilmelidir. Rotasyon işlemi audit kaydı üretir. Anahtar uygulama veritabanında şifreli tutulur ve `DATA_ENCRYPTION_KEY` olmadan çözülemez.

## Canlıya çıkış kontrolleri

- `DATA_ENCRYPTION_KEY` 32 bayt base64 değer olarak secret manager’dan sağlanmalı.
- `SIEM_ALLOWED_DOMAINS` mümkün olduğunca dar tanımlanmalı.
- SIEM tarafında imza, timestamp ve event-id doğrulaması test edilmeli.
- En az bir kontrollü güvenlik olayı gönderilip `DELIVERED` görülmeli.
- Hatalı endpoint ile retry ve dead-letter alarmı doğrulanmalı.
- Dead-letter sayısı ve ardışık hedef hataları dış izleme sisteminde alarm üretmeli.
