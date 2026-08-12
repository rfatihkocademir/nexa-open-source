# Nexa canlı ortam hazırlık kılavuzu

## Mevcut veritabanını güncelleme

`20260721140000_reconcile_schema_history` migrasyonu, daha önce yalnızca Prisma `db push` ile uygulanmış ve migration geçmişine kaydedilmemiş şema değişikliklerini migration sistemine dahil eder.

- Yeni ve boş bir veritabanında normal şekilde `npx prisma migrate deploy` çalıştırılmalıdır.
- Mevcut veritabanı zaten `prisma/schema.prisma` ile aynı durumdaysa önce aşağıdaki komutla fark olmadığı doğrulanmalı, ardından yalnızca bu migration uygulanmış olarak işaretlenmelidir:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code

npx prisma migrate resolve \
  --applied 20260721140000_reconcile_schema_history

npx prisma migrate deploy
```

İlk komutun çıkış kodu `0` olmalı ve `No difference detected` mesajı görülmelidir. Şema farkı varsa migration kesinlikle uygulanmış olarak işaretlenmemelidir. Önce veritabanının staging kopyası alınmalı ve oluşturulan SQL dikkatle incelenmelidir.

## Canlı ortam için zorunlu entegrasyonlar

- `JWT_SECRET`, `AUDIT_SIGNING_KEY`, `DATA_ENCRYPTION_KEY`, veritabanı, MinIO ve yedekleme parolaları bir secret manager içinde saklanmalıdır.
- `PUBLIC_URL` ve `BACKEND_PUBLIC_URL` değişkenlerinde gerçek ve HTTPS kullanan adresler bulunmalıdır.
- TLS, ingress veya load balancer üzerinde güvenilir bir sertifikayla sonlandırılmalıdır.
- Tüm HTTP istekleri HTTPS adresine yönlendirilmelidir.
- E-posta gönderim webhook’u ve canlı OIDC sağlayıcısı yapılandırılmalıdır.
- Şifreli yedekler uygulama sunucusundan farklı bir konuma gönderilmelidir.
- Son 26 saat içinde başarılı yedek yoksa uyarı üretilmelidir.

## Canlıya çıkış kontrolleri

1. `npx prisma migrate status` çalıştırılmalı ve şemanın güncel olduğu doğrulanmalıdır.
2. `/health/ready` adresinde veritabanı, Redis ve dosya depolama kontrollerinin tamamı sağlıklı görünmelidir. `NODE_ENV=production` için AI readiness ve gerçek generation probe varsayılan olarak aktiftir; Compose dağıtımlarında ayrıca `AI_READINESS_REQUIRED=true` ve `AI_READINESS_GENERATION_PROBE=true` açıkça sabitlenmiştir. Seçili AI provider zincirinde en az bir provider/model gerçekten üretim yapabiliyor olmalıdır. Üretim probe'u süreç başına başarılı provider için yalnızca bir kez çalışır; kota/kimlik/model hatası uygulamanın sağlıklı görünmesini engeller.
3. Backend testleri ile backend ve frontend production build işlemleri başarılı olmalıdır.
4. İzin verilen CORS adresi, `Secure` ve `HttpOnly` refresh cookie ile frontend güvenlik başlıkları doğrulanmalıdır.
5. Staging ortamında OIDC giriş ve SCIM kullanıcı oluşturma, pasifleştirme ve token iptal testleri yapılmalıdır.
6. Canlı trafik açılmadan önce `DISASTER_RECOVERY.md` dokümanındaki geri yükleme tatbikatı tamamlanmalıdır.
7. `npm --prefix api-automation test` 5xx veya AI bağımlılığı 503'ü olmadan tamamlanmalıdır; AI sağlayıcısı çalışmıyorsa `ALLOW_DEPENDENCY_503=true` ile sonucu yeşile çevirmek release onayı sayılmaz.

## Gerçek TLS kontrolü

Gerçek alan adı hazır olduğunda aşağıdaki kontroller yapılmalıdır:

- Sertifika güvenilir bir sertifika otoritesi tarafından üretilmiş olmalıdır.
- Sertifikadaki alan adı uygulama alan adıyla aynı olmalıdır.
- Sertifikanın sona erme tarihi izlenmelidir.
- HTTP adresi kalıcı olarak HTTPS adresine yönlenmelidir.
- Backend yanıtlarında HSTS başlığı bulunmalıdır.
- OIDC callback adresi tam ve HTTPS kullanan bir adres olmalıdır; wildcard kullanılmamalıdır.
