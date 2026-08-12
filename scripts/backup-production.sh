#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

case "${BACKUP_DIR%/}" in
  ""|/|"$HOME") echo "Unsafe BACKUP_DIR: $BACKUP_DIR" >&2; exit 2 ;;
esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_network="${COMPOSE_NETWORK:-${COMPOSE_PROJECT_NAME:-nexa}_default}"
minio_bucket="${MINIO_BUCKET:-nexa}"
target="${BACKUP_DIR%/}/${timestamp}"
mkdir -p "$target"
chmod 700 "$target"

docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSWORD -out "$target/postgres.dump.enc"

docker run --rm --user "$(id -u):$(id -g)" --network "$compose_network" \
  -e MC_CONFIG_DIR=/tmp/mc \
  -e MC_HOST_nexa="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  -v "$target:/export" minio/mc:RELEASE.2025-04-16T18-13-26Z \
  mirror --overwrite "nexa/${minio_bucket}" /export/minio

tar -C "$target" -czf - minio \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSWORD -out "$target/minio.tar.gz.enc"
rm -rf "$target/minio"

(cd "$target" && sha256sum postgres.dump.enc minio.tar.gz.enc > SHA256SUMS)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
  -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z' \
  -mtime "+${BACKUP_RETENTION_DAYS:-30}" -exec rm -rf -- {} +
echo "Encrypted backup created: $target"
