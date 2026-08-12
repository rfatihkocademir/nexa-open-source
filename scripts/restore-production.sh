#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_SOURCE:?RESTORE_SOURCE is required}"
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

if [[ "${CONFIRM_RESTORE:-}" != "RESTORE_NEXA" ]]; then
  echo "Refusing destructive restore. Set CONFIRM_RESTORE=RESTORE_NEXA after verifying the target." >&2
  exit 2
fi
compose_network="${COMPOSE_NETWORK:-${COMPOSE_PROJECT_NAME:-nexa}_default}"
minio_bucket="${MINIO_BUCKET:-nexa}"

(cd "$RESTORE_SOURCE" && sha256sum -c SHA256SUMS)
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSWORD -in "$RESTORE_SOURCE/postgres.dump.enc" \
  | docker compose exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner

temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSWORD -in "$RESTORE_SOURCE/minio.tar.gz.enc" \
  | tar -xzf - -C "$temporary"
docker run --rm --user "$(id -u):$(id -g)" --network "$compose_network" \
  -e MC_CONFIG_DIR=/tmp/mc \
  -e MC_HOST_nexa="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  -v "$temporary/minio:/restore:ro" minio/mc:RELEASE.2025-04-16T18-13-26Z \
  mirror --overwrite --remove /restore "nexa/${minio_bucket}"

echo "Restore completed. Run migration status, readiness and smoke tests before opening traffic."
