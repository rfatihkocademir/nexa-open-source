# Self-hosted deployment

This guide covers a single-server Docker Compose deployment. For production, place Nexa behind a TLS-terminating reverse proxy and back up both PostgreSQL and MinIO.

## 1. Prepare the host

Install Docker Engine and Docker Compose v2.30 or newer. Reserve enough storage for database growth, uploaded evidence, browser recordings, container images, and Ollama models. The default `qwen3:8b` model benefits from 16 GB or more system RAM.

Only the application port should be public. PostgreSQL, Redis, Browserless, and the backend API stay on the Compose network. MinIO and Ollama bind to `127.0.0.1` by default.

## 2. Install

```bash
git clone <repository-url> nexa
cd nexa
PUBLIC_URL=https://nexa.example.com \
BACKEND_PUBLIC_URL=https://nexa.example.com \
BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
./scripts/install.sh
```

The script creates `.env` with mode `0600`, generates independent secrets, validates the Compose model, builds the frontend and backend images, and starts all dependencies. Store the printed administrator password in a password manager and change it after signing in.

The initial model download can be large:

```bash
docker compose logs -f backend ollama
docker compose ps
```

## 3. Configure TLS

Set `APP_BIND_ADDRESS=127.0.0.1` in `.env` when the reverse proxy runs directly on the host. A minimal Caddy site is:

```caddyfile
nexa.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Forward the original host, client address, and protocol when using another proxy. WebSocket upgrades must be enabled for `/socket.io/`. Do not expose MinIO, Redis, PostgreSQL, Browserless, or Ollama directly to the internet.

`TRUST_PROXY=1` is correct when the bundled Nginx frontend is the only proxy. If a TLS proxy sits in front of it, set the value to the verified number of proxy hops (usually `2`) and ensure the outer proxy replaces untrusted forwarding headers.

After changing `.env`, apply it with:

```bash
docker compose up -d --build
```

## 4. GPU acceleration

CPU mode works on any Docker host and is selected by `COMPOSE_PROFILES=cpu`. For NVIDIA acceleration:

1. Install a compatible NVIDIA driver and NVIDIA Container Toolkit.
2. Verify `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi`.
3. Set `COMPOSE_PROFILES=gpu` in `.env`.
4. Run `docker compose up -d --force-recreate`.

Only one of the `cpu` or `gpu` profiles should be active.

## 5. External AI providers

Ollama is the default and keeps prompts on the host. To add external providers, set `AI_PROVIDER` to an ordered comma-separated chain and configure the corresponding key:

```dotenv
AI_PROVIDER=gemini,ollama
GEMINI_API_KEY=...
AI_ALLOW_EXTERNAL_DATA=true
```

Enabling an external provider can send project content outside your infrastructure. Review your privacy and data-processing requirements first.

## 6. Outbound automation targets

Public HTTP(S) targets are permitted for API and browser automation. Private, loopback, link-local, and metadata destinations are blocked by default. If Nexa must test an internal service, add only its expected hostname to the appropriate comma-separated allowlist:

- `AUTOMATION_ALLOWED_HOSTS` controls browser and test-run navigation. The bundled frontend host is allowed by default.
- `API_OUTBOUND_ALLOWED_HOSTS` controls server-side requests from the API Automation module.

Keep these lists separate and narrow. Do not add cloud metadata hosts or broad wildcard domains.

## 7. Backups

The backup utility encrypts PostgreSQL and MinIO exports. Load deployment variables, supply a separate encryption password, and write backups outside the repository:

```bash
set -a
. ./.env
set +a
BACKUP_DIR=/srv/nexa-backups \
BACKUP_ENCRYPTION_PASSWORD='use-a-password-manager' \
./scripts/backup-production.sh
```

Test restores regularly on an isolated host. Restore is intentionally guarded by `CONFIRM_RESTORE=RESTORE_NEXA`; see `scripts/restore-production.sh` before using it.

Docker volumes are persistent. Never run `docker compose down -v` unless permanent deletion of all Nexa data is intended.

## 8. Upgrade

Create and verify a backup, then:

```bash
git pull --ff-only
docker compose pull
docker compose up -d --build
docker compose ps
```

The backend applies committed Prisma migrations before it starts. Review release notes and migration files before upgrading production.

## 9. Health and troubleshooting

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 postgres redis minio ollama browserless
npm run health:check
```

The application health endpoint is `/health`; backend liveness and readiness are exposed through the same application origin at `/health/live` and `/health/ready`.
