# Contributing to Nexa

Thank you for helping improve Nexa.

## Before opening a change

1. Search existing issues and pull requests to avoid duplicate work.
2. Discuss large architectural or product changes in an issue first.
3. Never include customer data, credentials, `.env` files, database dumps, recordings, or generated reports.

## Local setup

Use Node.js 22 and Docker Compose v2.30 or newer:

```bash
npm run install:all
./scripts/install.sh --no-start
```

Copy `backend/.env.example` to `backend/.env` and configure local service addresses when running the API outside Docker.

## Quality checks

Run the checks relevant to your change before opening a pull request:

```bash
npm run build
npm run lint
npm run test:api
npm run test:ui
docker compose config --quiet
```

Add or update tests for behavior changes. Do not commit generated route catalogs, BDD catalogs, coverage files, Playwright reports, or build output.

## Pull requests

- Keep each pull request focused on one concern.
- Explain the user-visible behavior, design decisions, and verification performed.
- Call out migrations, environment-variable changes, security implications, and breaking changes.
- Use clear commit messages and resolve review feedback without rewriting unrelated code.
