# Nexa

Nexa is a self-hosted software delivery lifecycle and quality management platform. It brings product planning, agile work management, requirements, test design and execution, automation, traceability, release governance, reporting, and AI-assisted workflows into one deployment.

The default installation is private and self-contained: PostgreSQL with pgvector, Redis, MinIO, Browserless, and Ollama run alongside the React frontend and Node.js API.

## Quick start

Requirements:

- Docker Engine with Docker Compose v2.30 or newer
- At least 8 GB RAM; 16 GB or more is recommended for the default Ollama model
- Enough free disk space for container images, database data, uploads, and AI models

Clone the repository and run:

```bash
./scripts/install.sh
```

The installer creates a private `.env`, generates cryptographically random secrets, builds every application image, starts the complete stack, and prints the initial administrator credentials once. The application is available at `http://localhost:8080` by default.

The first startup downloads the configured Ollama chat and embedding models. Follow its progress with:

```bash
docker compose logs -f backend ollama
```

For a server with a domain:

```bash
PUBLIC_URL=https://nexa.example.com \
BACKEND_PUBLIC_URL=https://nexa.example.com \
BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
./scripts/install.sh
```

Terminate TLS in a reverse proxy and forward traffic to the configured `APP_PORT`. See [Deployment](docs/DEPLOYMENT.md) for production guidance, GPU setup, upgrades, backups, and recovery.

## Services

| Service | Purpose | Default exposure |
| --- | --- | --- |
| `frontend` | React application and reverse proxy | `0.0.0.0:8080` |
| `backend` | API, WebSocket server, workers, and migrations | Internal only |
| `postgres` | PostgreSQL and pgvector | Internal only |
| `redis` | Queues, cache, and Socket.IO coordination | Internal only |
| `minio` | Attachments and automation artifacts | API and console on loopback only |
| `browserless` | Isolated Chromium automation | Internal only |
| `ollama` | Local chat and embedding models | Loopback only |

All persistent state lives in named Docker volumes. `docker compose down` keeps data; `docker compose down -v` permanently deletes it.

## Common operations

```bash
docker compose ps
docker compose logs -f
docker compose up -d --build
docker compose down
```

Configuration lives in the ignored `.env` file. The committed [.env.example](.env.example) contains every deployment option but no usable secret. To validate configuration without starting containers:

```bash
./scripts/install.sh --no-start
```

CPU-based Ollama is the portable default. On a host with a working NVIDIA Container Toolkit, set `COMPOSE_PROFILES=gpu` in `.env` and recreate the stack.

## Development

Use Node.js 22, then install the workspaces:

```bash
npm run install:all
```

For application development, copy [backend/.env.example](backend/.env.example) to `backend/.env`, provide local credentials, start the infrastructure services, and run:

```bash
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
npm run test:api
npm run test:ui
```

Generated files such as API route catalogs, Playwright reports, coverage output, and BDD catalogs are intentionally not versioned.

## Repository layout

```text
backend/          API, workers, Prisma schema, migrations, and API tests
frontend/         React and Vite web application
api-automation/   HTTP contract and end-to-end API suite
ui-automation/    Playwright and BDD user-interface suite
docs/             Architecture, operations, security, and deployment guides
scripts/          Installation, health checks, backup, and restore utilities
Dockerfile        Multi-stage frontend and backend image definition
docker-compose.yml Complete self-hosted stack
```

## Security

Never commit `.env`, exported credentials, database dumps, private keys, or test recordings. If a credential was ever committed, removing the current file is insufficient: revoke the credential and purge it from Git history before publishing.

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Authorization details are documented in [the authorization matrix](docs/AUTHORIZATION_MATRIX.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), keep changes focused, and include tests for behavior changes.
