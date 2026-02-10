#!/usr/bin/env bash
set -euo pipefail

printf "\n[1/6] Starting local infra (Postgres + Redis)...\n"
docker compose -f docker-compose.local.yml up -d

printf "\n[2/6] Preparing .env...\n"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from .env.example"
else
  echo ".env already exists"
fi

printf "\n[3/6] Installing deps...\n"
npm install

printf "\n[4/6] Prisma migrate + generate + seed...\n"
npx prisma migrate dev --name init
npm run prisma:generate
npm run prisma:seed

printf "\n[5/6] Starting app...\n"
echo "Run in terminal A: npm run dev"

echo "\n[6/6] Starting worker..."
echo "Run in terminal B: npm run worker"

echo "\nDone. Open http://localhost:3000"
