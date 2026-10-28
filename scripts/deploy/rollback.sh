#!/usr/bin/env bash
# Switch app containers back to the previously deployed images.
# Database changes are NOT undone; restore a backup from backups/ if needed:
#   docker compose -p knm-crm -f docker-compose.prod.yml exec -T postgres \
#     sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/<file>.dump
#
#   STACK=prod bash scripts/deploy/rollback.sh
set -euo pipefail
: "${STACK:?STACK is required (test or prod)}"
PREVIOUS_TAG="$(cat .deploy/previous_tag 2>/dev/null || true)"
if [ -z "$PREVIOUS_TAG" ]; then
  echo "No previous deploy recorded in .deploy/previous_tag" >&2
  exit 1
fi
STACK="$STACK" IMAGE_TAG="$PREVIOUS_TAG" SKIP_PULL=1 bash scripts/deploy/deploy.sh
