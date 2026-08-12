#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${NEXA_ENV_FILE:-"$repo_dir/.env"}
compose_file="$repo_dir/docker-compose.yml"
example_file="$repo_dir/.env.example"
start_stack=true

usage() {
  printf '%s\n' "Usage: ./scripts/install.sh [--no-start]"
  printf '%s\n' "  --no-start  Generate and validate configuration without starting containers."
}

for argument in "$@"; do
  case "$argument" in
    --no-start) start_stack=false ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
  esac
done

for required_command in awk chmod cp docker mktemp mv openssl printenv; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf 'Required command is missing: %s\n' "$required_command" >&2
    exit 1
  fi
done

if [ -L "$env_file" ]; then
  printf 'Refusing to write configuration through a symbolic link: %s\n' "$env_file" >&2
  exit 1
fi

if [ ! -f "$env_file" ]; then
  cp "$example_file" "$env_file"
  printf 'Created private configuration: %s\n' "$env_file"
else
  printf 'Using existing configuration; explicit process environment values still take precedence: %s\n' "$env_file"
fi
chmod 600 "$env_file"

read_env() {
  awk -F= -v wanted="$1" '
    $1 == wanted {
      print substr($0, index($0, "=") + 1)
      exit
    }
  ' "$env_file"
}

write_env() {
  key=$1
  value=$2
  temporary_file=$(mktemp "${env_file}.tmp.XXXXXX")
  awk -v wanted="$key" -v replacement="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" wanted "=" {
      print wanted "=" replacement
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) print wanted "=" replacement
    }
  ' "$env_file" > "$temporary_file"
  chmod 600 "$temporary_file"
  mv "$temporary_file" "$env_file"
}

is_missing() {
  candidate=$1
  case "$candidate" in
    ""|change-me*|generate-*|GENERATE-*|\<*\>) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_value() {
  key=$1
  fallback=$2
  current=$(read_env "$key")
  if is_missing "$current"; then
    write_env "$key" "$fallback"
  fi
}

# Explicit process environment values take precedence on first install and
# make non-interactive server provisioning predictable.
while IFS='=' read -r environment_key _environment_value; do
  case "$environment_key" in
    ''|'#'*) continue ;;
  esac
  case "$environment_key" in
    *[!A-Z0-9_]*) continue ;;
  esac
  process_value=$(printenv "$environment_key" 2>/dev/null || true)
  if [ -n "$process_value" ]; then
    write_env "$environment_key" "$process_value"
  fi
done < "$example_file"

ensure_hex_secret() {
  key=$1
  byte_count=$2
  current=$(read_env "$key")
  if is_missing "$current"; then
    write_env "$key" "$(openssl rand -hex "$byte_count")"
    return 0
  fi
  return 1
}

ensure_value COMPOSE_PROJECT_NAME nexa
ensure_value COMPOSE_PROFILES cpu
ensure_value APP_BIND_ADDRESS 0.0.0.0
ensure_value APP_PORT 8080
ensure_value DB_USER nexa
ensure_value DB_NAME nexa
ensure_value MINIO_ROOT_USER nexa
ensure_value MINIO_BUCKET nexa
ensure_value DEFAULT_ORGANIZATION_SLUG default
ensure_value BOOTSTRAP_ORGANIZATION_NAME Nexa
ensure_value BOOTSTRAP_ADMIN_EMAIL "${BOOTSTRAP_ADMIN_EMAIL:-admin@nexa.local}"
ensure_value BOOTSTRAP_ADMIN_FIRST_NAME Nexa
ensure_value BOOTSTRAP_ADMIN_LAST_NAME Admin

public_url=${PUBLIC_URL:-$(read_env PUBLIC_URL)}
if is_missing "$public_url"; then
  public_url=http://localhost:8080
fi
public_url=${public_url%/}
write_env PUBLIC_URL "$public_url"

backend_public_url=${BACKEND_PUBLIC_URL:-$(read_env BACKEND_PUBLIC_URL)}
if is_missing "$backend_public_url"; then
  backend_public_url=$public_url
fi
write_env BACKEND_PUBLIC_URL "${backend_public_url%/}"

ensure_hex_secret DB_PASSWORD 24 || true
ensure_hex_secret JWT_SECRET 32 || true
ensure_hex_secret AUDIT_SIGNING_KEY 32 || true
ensure_hex_secret MINIO_ROOT_PASSWORD 24 || true
ensure_hex_secret BROWSERLESS_TOKEN 32 || true

data_key=$(read_env DATA_ENCRYPTION_KEY)
if is_missing "$data_key"; then
  write_env DATA_ENCRYPTION_KEY "$(openssl rand -base64 32 | tr -d '\n')"
fi

admin_password_generated=false
admin_password=$(read_env BOOTSTRAP_ADMIN_PASSWORD)
if is_missing "$admin_password"; then
  admin_password="Nx!$(openssl rand -hex 14)"
  write_env BOOTSTRAP_ADMIN_PASSWORD "$admin_password"
  admin_password_generated=true
fi

ollama_profile=$(read_env COMPOSE_PROFILES)
case "$ollama_profile" in
  cpu|gpu) ;;
  *) printf 'COMPOSE_PROFILES must be either cpu or gpu, got: %s\n' "$ollama_profile" >&2; exit 1 ;;
esac

if [ "${NEXA_SKIP_DOCKER_CHECK:-false}" != "true" ]; then
  if ! docker info >/dev/null 2>&1; then
    printf '%s\n' 'Docker daemon is not available to the current user.' >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    printf '%s\n' 'Docker Compose v2.30.0 or newer is required.' >&2
    exit 1
  fi

  compose_version=$(docker compose version --short)
  compose_version=${compose_version#v}
  compose_major=${compose_version%%.*}
  compose_remainder=${compose_version#*.}
  compose_minor=${compose_remainder%%.*}
  case "$compose_major:$compose_minor" in
    *[!0-9:]*)
      printf 'Unable to parse Docker Compose version: %s\n' "$compose_version" >&2
      exit 1
      ;;
  esac
  if [ "$compose_remainder" = "$compose_version" ] \
    || [ "$compose_major" -lt 2 ] \
    || { [ "$compose_major" -eq 2 ] && [ "$compose_minor" -lt 30 ]; }; then
    printf 'Docker Compose v2.30.0 or newer is required; found %s.\n' "$compose_version" >&2
    exit 1
  fi

  docker compose --env-file "$env_file" -f "$compose_file" config --quiet
fi

if [ "$start_stack" = true ]; then
  docker compose --env-file "$env_file" -f "$compose_file" up -d --build --remove-orphans
  printf '\nNexa containers have been started.\n'
  printf 'Application: %s\n' "$public_url"
  printf '%s\n' 'The first startup downloads the configured Ollama models and can take several minutes.'
  printf 'Follow progress: docker compose logs -f backend ollama ollama-gpu\n'
else
  printf '%s\n' 'Configuration generated and validated; containers were not started.'
fi

if [ "$admin_password_generated" = true ]; then
  printf '\nInitial administrator\n'
  printf 'Email: %s\n' "$(read_env BOOTSTRAP_ADMIN_EMAIL)"
  printf 'Password: %s\n' "$admin_password"
  printf '%s\n' 'Store this password securely and change it after the first login.'
fi
