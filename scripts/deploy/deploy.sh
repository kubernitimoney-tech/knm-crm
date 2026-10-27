#!/usr/bin/env bash
# Deploy prebuilt images (tagged with a git commit SHA) on this server.
#
# Steps: pull images -> back up the database -> run migrations (old version
# keeps serving) -> restart containers -> health check -> on failure, roll
# back to the previously deployed images.
#
# Required env:
#   STACK       test | prod
#   IMAGE_TAG   git commit SHA built by GitHub Actions
# Optional env:
#   PROJECT          compose project name (default: knm-crm)
#   IMAGE_REGISTRY   default: ghcr.io/kubernitimoney-tech
#   KEEP_BACKUPS     database backups to keep (default: 7)
#   SKIP_PULL=1      use images already on the server (emergency local build)
#
# Run from the repository folder on the server, e.g.:
#   STACK=prod IMAGE_TAG=<sha> bash scripts/deploy/deploy.sh
set -euo pipefail

: "${STACK:?STACK is required (test or prod)}"
: "${IMAGE_TAG:?IMAGE_TAG is required (git commit SHA)}"
PROJECT="${PROJECT:-knm-crm}"
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"
export STACK IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/kubernitimoney-tech}"

STATE_DIR=".deploy"
BACKUP_DIR="backups"
mkdir -p "$STATE_DIR" "$BACKUP_DIR"
PREVIOUS_TAG="$(cat "$STATE_DIR/current_tag" 2>/dev/null || true)"

compose() { docker compose -p "$PROJECT" -f docker-compose.prod.yml --profile edge "$@"; }
log() { echo "[deploy $(date '+%F %T')] $*"; }

APP_SERVICES=(django celery celery-beat frontend marketing)

if [ ! -f backend/.env ]; then
  echo "Missing backend/.env on this server — create it before deploying." >&2
  exit 1
fi

docker network inspect knm-edge >/dev/null 2>&1 || docker network create knm-edge >/dev/null

if [ "${SKIP_PULL:-0}" != "1" ]; then
  log "Pulling images for $IMAGE_TAG"
  compose pull --quiet "${APP_SERVICES[@]}"
fi

# Make sure the database is up (first deploy) before backup / migrations.
compose up -d postgres redis
for _ in $(seq 1 30); do
  if compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

BACKUP_FILE="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S)-${IMAGE_TAG:0:12}.dump"
log "Backing up database to $BACKUP_FILE"
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_FILE"
if [ ! -s "$BACKUP_FILE" ]; then
  echo "Database backup is empty — stopping before any change." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi
# Keep only the newest backups.
ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f

log "Running migrations with the new image (current version keeps serving)"
compose run --rm -T django python manage.py migrate --noinput

log "Starting new containers"
compose up -d --remove-orphans
if compose ps --services --status running | grep -qx caddy; then
  compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
fi

log "Health check"
healthy=0
for _ in $(seq 1 30); do
  if compose exec -T django curl -fsS http://127.0.0.1:8000/api/v1/health/ >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" != "1" ]; then
  log "Health check FAILED for $IMAGE_TAG"
  compose logs --tail 80 django || true
  if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
    log "Rolling back to $PREVIOUS_TAG"
    IMAGE_TAG="$PREVIOUS_TAG" compose up -d "${APP_SERVICES[@]}"
    log "Rolled back. Database backup from before this deploy: $BACKUP_FILE"
  else
    log "No previous version recorded to roll back to."
  fi
  exit 1
fi

echo "$PREVIOUS_TAG" > "$STATE_DIR/previous_tag"
echo "$IMAGE_TAG" > "$STATE_DIR/current_tag"
echo "$(date '+%F %T') $STACK $IMAGE_TAG" >> "$STATE_DIR/history.log"
log "Deployed $IMAGE_TAG to $STACK"

# Free disk: keep images for the current and previous release only.
docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E "/knm-crm-(backend|frontend-$STACK|marketing-$STACK):" \
  | grep -v -e ":$IMAGE_TAG\$" ${PREVIOUS_TAG:+-e ":$PREVIOUS_TAG\$"} \
  | xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
