#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v bun >/dev/null || { echo 'Install Bun first: https://bun.sh'; exit 1; }
command -v docker >/dev/null || { echo 'Install Docker first: https://docs.docker.com/get-docker/'; exit 1; }
if [ ! -f be/.env ]; then
  cp be/.env.example be/.env
  echo 'Created be/.env. Update SESSION_SECRET and USERNAME_HMAC_KEYS before production.'
fi
bun install
docker compose up -d
bun run db:generate
bun run db:migrate
bun run build
echo 'Setup complete. In separate terminals run: bun run dev:api and bun run dev:web'
