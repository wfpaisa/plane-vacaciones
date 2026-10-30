#!/usr/bin/env bash
# Publica Vacaciones en el servidor: copia el código, construye la imagen allá
# y reinicia el contenedor. Los datos viven en $DIR/pb_data y no se tocan.
#
#   ./desplegar.sh            despliega
#   ./desplegar.sh --logs     muestra los registros del contenedor
#
# Variables opcionales: DEPLOY_HOST (vigotes@64.23.130.221), DEPLOY_DIR (/home/vigotes/vacaciones),
# DOMAIN (vacaciones.wfelipe.com), HOST_PORT (8090), VACACIONES_RESPALDOS (5).
set -euo pipefail

HOST="${DEPLOY_HOST:-vigotes@64.23.130.221}"
DIR="${DEPLOY_DIR:-/home/vigotes/vacaciones}"
DOMAIN="${DOMAIN:-vacaciones.wfelipe.com}"
HOST_PORT="${HOST_PORT:-8090}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/.env.production"

cd "$ROOT"

# Una sola conexión SSH para todo el despliegue: el agente pide aprobar una vez.
SOCKET="${TMPDIR:-/tmp}/vacaciones-ssh-%C"
ssh() { command ssh -o ControlMaster=auto -o ControlPath="$SOCKET" -o ControlPersist=120 "$@"; }

if [[ "${1:-}" == "--logs" ]]; then
  ssh "$HOST" "cd '$DIR/src' && docker compose -p vacaciones logs --tail=200 -f"; exit
fi

secret() { openssl rand -base64 33 | tr -d '/+=' | cut -c1-32; }

# Primera vez: se crea .env.production con credenciales nuevas. Las del
# ejemplo son públicas y no deben usarse en internet.
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Creando .env.production con credenciales nuevas…"
  get() { grep -E "^$1=" .env 2>/dev/null | cut -d= -f2- || true; }
  umask 077
  cat > "$ENV_FILE" <<EOF
ADMIN_USER=familia
ADMIN_PASSWORD=$(secret)
PB_ADMIN_EMAIL=admin@${DOMAIN#*.}
PB_ADMIN_PASSWORD=$(secret)

PB_ORIGINS=https://${DOMAIN}
TRUSTED_PROXY_HEADERS=X-Forwarded-For

GOOGLE_MAPS_BROWSER_KEY=$(get GOOGLE_MAPS_BROWSER_KEY)
GOOGLE_PLACES_SERVER_KEY=$(get GOOGLE_PLACES_SERVER_KEY)
GOOGLE_MAPS_MONTHLY_LIMIT=$(get GOOGLE_MAPS_MONTHLY_LIMIT)
GOOGLE_PLACES_MONTHLY_LIMIT=$(get GOOGLE_PLACES_MONTHLY_LIMIT)
MCP_ALLOWED_ORIGINS=
EOF
  echo "Credenciales guardadas en .env.production (no se versiona)."
fi

for key in ADMIN_PASSWORD PB_ADMIN_PASSWORD; do
  value="$(grep -E "^$key=" "$ENV_FILE" | cut -d= -f2-)"
  example="$(grep -E "^$key=" .env.example | cut -d= -f2-)"
  if [[ ${#value} -lt 12 || "$value" == "$example" ]]; then
    echo "Error: $key en .env.production es corta o es la del ejemplo." >&2
    exit 1
  fi
done

echo "→ Copiando código a $HOST:$DIR"
ssh "$HOST" "mkdir -p '$DIR/src'"
tar -czf - --exclude='web/dist' --exclude='node_modules' \
  Dockerfile .dockerignore compose.yaml docker package.json bun.lock tsconfig.json \
  web pb/pb_migrations pb/pb_hooks |
  ssh "$HOST" "rm -rf '$DIR/src.new' && mkdir '$DIR/src.new' && tar -xzf - -C '$DIR/src.new' && rm -rf '$DIR/src' && mv '$DIR/src.new' '$DIR/src'"
ssh "$HOST" "umask 077 && cat > '$DIR/src/.env'" < "$ENV_FILE"

echo "→ Construyendo la imagen"
ssh "$HOST" "cd '$DIR/src' && HOST_PORT='$HOST_PORT' docker compose -p vacaciones build"

# Los datos viven en $DIR/pb_data (fuera de src/). La primera vez se copian
# del volumen Docker que se usaba antes; el volumen no se borra. Antes de cada
# actualización se guarda un .tgz de pb_data con el contenedor parado y se
# conservan los últimos $KEEP. Los respaldos diarios de PocketBase quedan en
# pb_data/backups y los recoge Proxmox (CT 111).
echo "→ Respaldando pb_data y reiniciando el contenedor"
ssh "$HOST" "DIR='$DIR' KEEP='${VACACIONES_RESPALDOS:-5}' HOST_PORT='$HOST_PORT' bash -s" <<'REMOTE'
set -euo pipefail
cd "$DIR"
if [[ ! -d pb_data ]]; then
  rm -rf pb_data.nuevo && mkdir pb_data.nuevo
  if docker volume inspect vacaciones_datos >/dev/null 2>&1; then
    echo "  Copiando el volumen vacaciones_datos a $DIR/pb_data"
    docker stop vacaciones >/dev/null 2>&1 || true
    docker run --rm -v vacaciones_datos:/from:ro -v "$DIR/pb_data.nuevo:/to" alpine \
      sh -c 'cp -a /from/. /to/ && chown -R 1000:1000 /to'
  fi
  mv pb_data.nuevo pb_data
fi
if [[ -f pb_data/data.db ]]; then
  docker stop vacaciones >/dev/null 2>&1 || true
  mkdir -p respaldos && chmod 700 respaldos
  file="respaldos/pb_data-$(date +%Y%m%d-%H%M%S).tgz"
  tar czf "$file" --exclude=pb_data/backups pb_data
  echo "  $file"
  ls -1t respaldos/pb_data-*.tgz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
fi
cd src
docker compose -p vacaciones up -d --remove-orphans
docker image prune -f >/dev/null
REMOTE

echo "→ Esperando a que responda"
for _ in $(seq 1 30); do
  if ssh "$HOST" "curl -fsS http://127.0.0.1:$HOST_PORT/api/health || wget -qO- http://127.0.0.1:$HOST_PORT/api/health" >/dev/null 2>&1; then
    echo "Listo: https://$DOMAIN"
    exit 0
  fi
  sleep 2
done
echo "El contenedor no respondió. Revise: ./desplegar.sh --logs" >&2
exit 1
