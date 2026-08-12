# Yerel altyapı hazırlığı

Nexa; PostgreSQL/pgvector, Redis, MinIO, Browserless ve bir AI sağlayıcısına ihtiyaç duyar. En kolay ve üretimle en tutarlı yerel kurulum kök dizinden yapılır:

```bash
./scripts/install.sh
```

Bu komut `.env` dosyasını oluşturur, güvenli ve birbirinden bağımsız parolalar üretir, tüm image'ları derler ve servisleri başlatır. İlk Ollama model indirmesi birkaç dakika sürebilir:

```bash
docker compose logs -f backend ollama
docker compose ps
npm run health:check
```

Yalnızca yapılandırmayı üretmek için:

```bash
./scripts/install.sh --no-start
```

Backend veya frontend'i Docker dışında geliştirecekseniz Node.js 22 kullanın, bağımlılıkları `npm run install:all` ile kurun ve `backend/.env.example` dosyasını `backend/.env` olarak kopyalayıp yerel servis adreslerini doldurun.

## Güvenlik notları

- `.env`, özel anahtarlar, dump dosyaları ve test kayıtları Git'e eklenmemelidir.
- `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `AUDIT_SIGNING_KEY`, veritabanı ve MinIO parolaları farklı olmalıdır.
- PostgreSQL, Redis, Browserless ve backend portlarını internete açmayın.
- Kalıcı verileri silmek istemiyorsanız `docker compose down -v` çalıştırmayın.
