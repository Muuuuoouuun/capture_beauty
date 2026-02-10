#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_BOOTSTRAP_SECRET="${ADMIN_BOOTSTRAP_SECRET:-replace_with_long_random_secret}"

printf "[smoke] bootstrap admin...\n"
curl -sS -X POST "$BASE_URL/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-secret: $ADMIN_BOOTSTRAP_SECRET" \
  -d '{"email":"ops@oracleguild.com","name":"Operations Steward","reputationPoints":3000}'

printf "\n[smoke] list reminder: use x-user-id=seed-admin for admin APIs\n"
printf "Example: curl -X POST $BASE_URL/api/admin/questions/<QUESTION_ID>/void -H 'x-user-id: seed-admin' -H 'Content-Type: application/json' -d '{\"reason\":\"ambiguous\"}'\n"
