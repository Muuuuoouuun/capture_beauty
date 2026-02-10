# Oracle Guild (MVP)

Oracle Guild is a non-gambling forecasting community app inspired by prediction market mechanics without money.

## Core MVP highlights
- Binary forecasting with probability slider (0-100) and full update history.
- Brier-score based reputation progression (Observer -> Sign-Reader -> Mindseer -> Prophet -> Oracle).
- Resolver adapter system for official API sources and official link/manual fallback.
- Scheduled resolution jobs with BullMQ + Redis and resolver run logs.
- Explore page with community probability, trending/closing filters, and sparkline trendline.
- Chronicle/rationale support for evidence-first forecasting discussion.
- Admin desk with queue visibility, governance events, and question void endpoint.

## Stack
- Next.js App Router + TypeScript + Tailwind
- Prisma + Postgres (Supabase/Neon compatible)
- BullMQ + Redis (Upstash compatible)
- Recharts for sparkline charts
- Sentry for observability

## Quick next process (recommended)
If you want to proceed immediately with local hosting + admin test, run:

```bash
npm run next:process
```

This script will:
1. Start Postgres + Redis via Docker Compose.
2. Prepare `.env` from `.env.example`.
3. Install dependencies.
4. Run Prisma migrate/generate/seed.
5. Tell you how to run app and worker in separate terminals.

Infrastructure file: `docker-compose.local.yml`

## Setup (manual)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Run Prisma migrations and generate client:
   ```bash
   npx prisma migrate dev --name init
   npm run prisma:generate
   ```
4. Seed data (includes observer/sign-reader/admin sample users):
   ```bash
   npm run prisma:seed
   ```
5. Start app:
   ```bash
   npm run dev
   ```
6. Start resolution worker (separate process):
   ```bash
   npm run worker
   ```

## Admin account creation
### Option A: seed default admin
- Seed creates `admin@oracleguild.local` (`id: seed-admin`, tier: `ADMIN`).

### Option B: bootstrap via API (production-safe)
```bash
curl -X POST http://localhost:3000/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-secret: $ADMIN_BOOTSTRAP_SECRET" \
  -d '{"email":"ops@oracleguild.com","name":"Operations Steward","reputationPoints":3000}'
```

### Smoke-test admin flow
```bash
npm run smoke:admin
```

## Moderation APIs
### Void ambiguous question (admin only)
```bash
curl -X POST http://localhost:3000/api/admin/questions/<QUESTION_ID>/void \
  -H "Content-Type: application/json" \
  -H "x-user-id: seed-admin" \
  -d '{"reason":"Official source changed and outcome became ambiguous"}'
```

## Environment variables
See `.env.example` for all required keys, including `ADMIN_BOOTSTRAP_SECRET`.

## Resolution plugin configuration
Question records include `resolver_type` + `resolver_config_json`.

### Official API resolver example
```json
{
  "endpoint": "https://api.stlouisfed.org/fred/series/observations",
  "queryParams": { "series_id": "UNRATE", "api_key": "demo", "file_type": "json", "limit": 1, "sort_order": "desc" },
  "parsePath": "observations.0.value",
  "operator": "<=",
  "threshold": 4
}
```

### Official link resolver example
```json
{
  "sourceUrl": "https://www.bls.gov/news.release/",
  "manualOutcome": "YES",
  "enteredBy": "admin-user-id",
  "notes": "Official announcement confirms target event occurred"
}
```

## Deployment notes (Vercel)
- Deploy Next.js app to Vercel.
- Use managed Postgres (Supabase/Neon) and Upstash Redis.
- Trigger `/api/resolution/run` via cron for redundancy in addition to worker.
- Add Sentry env vars to Vercel project settings.
- CI workflow (`.github/workflows/ci.yml`) runs `npm ci` + `npm run typecheck` on push/PR.

## No-gambling policy
Oracle Guild does not support money, wagering, staking, or cash-out. Points only control reputation tiers and permissions.
