#!/bin/sh
set -e
if [ "${SKIP_DB_MIGRATE:-0}" != "1" ]; then
  node scripts/ensure-database.mjs
  node scripts/migrate.mjs
fi
exec "$@"
