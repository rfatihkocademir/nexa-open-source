# Nexa felaket kurtarma kılavuzu

## Hedefler

- Canlı ortam için hedef RPO 24 saattir. Bu hedef günlük tam yedek alınacağını ifade eder.
- Daha düşük veri kaybı hedefleniyorsa PostgreSQL WAL arşivleme etkinleştirilmelidir.
- Hedef RTO, gerekli altyapı kullanılabilir duruma geldikten sonra 4 saattir.
- Yedekler PostgreSQL veritabanını ve Nexa MinIO bucket içeriğini kapsar.
- Tüm yedekler depolanmadan önce şifrelenir.

## Planlanmış yedekleme

`scripts/backup-production.sh` dosyası, erişimi kısıtlanmış bir sunucuda her gün çalıştırılmalıdır.

`BACKUP_DIR`, uygulama sunucusu dışında bulunan veya uzak depolamaya bağlı bir dizini göstermelidir. `BACKUP_ENCRYPTION_PASSWORD` secret manager üzerinden sağlanmalıdır ve kesinlikle yedek dosyalarıyla aynı konumda saklanmamalıdır.

`BACKUP_RETENTION_DAYS` belirtilmezse yedekler varsayılan olarak 30 gün saklanır.

Tamamlanan yedek dizinleri ikinci bir hata alanına kopyalanmalıdır. Örneğin farklı bir veri merkezi, bulut bucket’ı veya çevrimdışı yedekleme alanı kullanılabilir.

Şu durumlarda otomatik uyarı üretilmelidir:

- Yedekleme komutu hata verdiğinde
- Son 26 saat içinde yeni bir yedek oluşmadığında
- Yedek checksum doğrulaması başarısız olduğunda
- Uzak depolama alanına kopyalama tamamlanmadığında

## Yedek alma

Gerekli ortam değişkenleri tanımlandıktan sonra:

```bash
export BACKUP_DIR=/mnt/nexa-backups
export BACKUP_ENCRYPTION_PASSWORD='secret-manager-degeri'
export DB_USER=nexa
export DB_NAME=nexa
export MINIO_ROOT_USER='minio-kullanicisi'
export MINIO_ROOT_PASSWORD='minio-parolasi'
export MINIO_BUCKET=nexa

./scripts/backup-production.sh
```

Başarılı işlem sonunda oluşturulan yedek dizininde şu dosyalar bulunmalıdır:

- `postgres.dump.enc`
- `minio.tar.gz.enc`
- `SHA256SUMS`

Şifrelenmemiş PostgreSQL veya MinIO dosyaları yedek dizininde kalmamalıdır.

## Geri yükleme tatbikatı

Geri yükleme işlemi üç ayda bir, canlı ortamdan tamamen izole edilmiş bir ortamda yapılmalıdır.

Önce `SHA256SUMS` doğrulanmalı, ardından `RESTORE_SOURCE` doğru yedek dizinine ayarlanmalıdır. Hedef veritabanı ve container’ların test ortamına ait olduğu kesin olarak doğrulandıktan sonra `CONFIRM_RESTORE=RESTORE_NEXA` tanımlanmalıdır.

```bash
export RESTORE_SOURCE=/mnt/nexa-backups/YEDEK_DIZINI
export BACKUP_ENCRYPTION_PASSWORD='secret-manager-degeri'
export DB_USER=nexa
export DB_NAME=nexa
export MINIO_ROOT_USER='minio-kullanicisi'
export MINIO_ROOT_PASSWORD='minio-parolasi'
export MINIO_BUCKET=nexa
export CONFIRM_RESTORE=RESTORE_NEXA

./scripts/restore-production.sh
```

Geri yükleme komutu yıkıcıdır. Kesin onay değeri verilmeden çalışmayı reddeder. Canlı veritabanında tatbikat yapılmamalıdır.

## Geri yükleme sonrası kontroller

1. `npx prisma migrate status` çalıştırılmalıdır.
2. `/health/ready` adresinin `200` döndürdüğü doğrulanmalıdır.
3. API testleri ve kritik tarayıcı smoke testleri çalıştırılmalıdır.
4. Kullanıcı, proje, work item ve test kayıtlarının sayıları kaynak sistemle karşılaştırılmalıdır.
5. Dosya ekleri açılıp indirilebilmelidir.
6. En az bir test çalıştırması dışa aktarılmalıdır.
7. Audit zinciri bütünlük kontrolünden geçmelidir.
8. Gerçekleşen RPO ve RTO süreleri kaydedilmelidir.
9. Tespit edilen sorunlar için sorumlu kişi ve tamamlanma tarihi belirlenmelidir.

## Mevcut audit kayıtlarını başlangıç zincirine alma

İmzalı hash zinciri eklenmeden önce oluşturulmuş audit kayıtları bulunan bir kurulum yükseltiliyorsa aşağıdaki işlem kontrollü bir bakım penceresinde yalnızca bir kez çalıştırılmalıdır:

```bash
cd backend
AUDIT_RECHAIN_CONFIRM=BASELINE_EXISTING_AUDIT_LOGS \
  npm run security:rechain-audit
```

Bu komut zamanlanmış göreve eklenmemeli ve başlangıç zinciri oluşturulduktan sonra tekrar çalıştırılmamalıdır. Komut, veritabanındaki mevcut içerik üzerinden yeni bir audit zinciri oluşturduğu için ayrıcalıklı ve kayıt altına alınan bir bakım işlemi olarak değerlendirilmelidir.

