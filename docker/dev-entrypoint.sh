#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations"
  npm run db-update
fi

npm run build-css
npm run watch-css &

exec npm run start:dev
