#!/bin/sh
set -eu

npx prisma db push

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  node prisma/seed.js
fi

exec "$@"
