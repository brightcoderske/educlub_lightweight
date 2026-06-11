#!/usr/bin/env bash

set -Eeuo pipefail

SOURCE_ROOT="$(pwd)"
APP_ROOT="/home/codecham/educlub-backend"
NODE_ENV_ROOT="/home/codecham/nodevenv/educlub-backend/20"
BACKUP_ROOT="/home/codecham/educlub-backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

if [[ ! -f "$SOURCE_ROOT/backend/package.json" ]]; then
  echo "Run this deployment from the educlub_lightweight repository root." >&2
  exit 1
fi

if [[ "$APP_ROOT" != "/home/codecham/educlub-backend" ]]; then
  echo "Unexpected application root: $APP_ROOT" >&2
  exit 1
fi

if [[ ! -f "$NODE_ENV_ROOT/bin/activate" ]]; then
  echo "Node.js environment was not found at $NODE_ENV_ROOT." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp -a "$APP_ROOT/src" "$BACKUP_DIR/src"
cp -a "$APP_ROOT/package.json" "$BACKUP_DIR/package.json"
cp -a "$APP_ROOT/package-lock.json" "$BACKUP_DIR/package-lock.json"

rollback() {
  echo "Deployment failed; restoring $BACKUP_DIR." >&2
  rm -rf "$APP_ROOT/src"
  cp -a "$BACKUP_DIR/src" "$APP_ROOT/src"
  cp -a "$BACKUP_DIR/package.json" "$APP_ROOT/package.json"
  cp -a "$BACKUP_DIR/package-lock.json" "$APP_ROOT/package-lock.json"

  set +u
  # shellcheck disable=SC1091
  source "$NODE_ENV_ROOT/bin/activate"
  set -u
  cd "$APP_ROOT"
  npm install --omit=dev --no-audit --no-fund
  mkdir -p "$APP_ROOT/tmp"
  touch "$APP_ROOT/tmp/restart.txt"
}

trap rollback ERR

rm -rf "$APP_ROOT/src"
cp -a "$SOURCE_ROOT/backend/src" "$APP_ROOT/src"
cp -a "$SOURCE_ROOT/backend/package.json" "$APP_ROOT/package.json"
cp -a "$SOURCE_ROOT/backend/package-lock.json" "$APP_ROOT/package-lock.json"

set +u
# shellcheck disable=SC1091
source "$NODE_ENV_ROOT/bin/activate"
set -u
cd "$APP_ROOT"
npm install --omit=dev --no-audit --no-fund

mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"

for attempt in {1..10}; do
  if curl --fail --silent --show-error \
    "https://learn.educlub.co.ke/health" >/dev/null; then
    trap - ERR
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -nr \
      | tail -n +6 \
      | cut -d' ' -f2- \
      | xargs -r rm -rf
    echo "eduClub backend deployed successfully."
    exit 0
  fi

  sleep 3
done

echo "Health check failed after restart." >&2
exit 1
