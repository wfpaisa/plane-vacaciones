#!/bin/sh
# Arranca PocketBase con los datos en /data y la web compilada en la raíz.
set -eu

dirs="--dir=/data --migrationsDir=/app/pb_migrations --hooksDir=/app/pb_hooks"

if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  # shellcheck disable=SC2086
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" $dirs >/dev/null
fi

# shellcheck disable=SC2086
exec pocketbase serve --http=0.0.0.0:8090 $dirs --publicDir=/app/pb_public \
  --origins="${PB_ORIGINS:-*}"
