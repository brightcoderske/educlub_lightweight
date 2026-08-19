#!/usr/bin/env bash

set -Eeuo pipefail

# --- Paths. These are the configured locations on the cPanel account. --------
# DEPLOY_DIR is the cPanel "Deploy Directory" and is where the repository is
# checked out. APP_ROOT is the Node.js application root registered in cPanel.
# Neither is inferred: pwd is not reliable because cPanel chooses the working
# directory for deployment tasks, and the script is also run by hand over SSH.
DEPLOY_DIR="/home/codecham/domains/learn.educlub.co.ke/educlub-source"
APP_ROOT="/home/codecham/educlub-backend"
NODE_ENV_ROOT="/home/codecham/nodevenv/educlub-backend/20"
BACKUP_ROOT="/home/codecham/educlub-backups"
HEALTH_URL="https://learn.educlub.co.ke/health"

# Use the configured deploy directory when it exists. The fallback to this
# script's own location keeps a checkout in any other path working, rather than
# silently deploying from somewhere other than where it was invoked.
if [[ -d "$DEPLOY_DIR" ]]; then
  SOURCE_ROOT="$DEPLOY_DIR"
else
  SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  echo "note: $DEPLOY_DIR not found; deploying from $SOURCE_ROOT instead."
fi
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
STARTED_AT="$(date +%s)"
TOTAL_STEPS=7
STEP=0

# cPanel shows this script's output as the deployment log, and it is the only
# record of what happened. Each stage announces itself so a failed deploy points
# at the stage that failed instead of a wall of npm output.
step() {
  STEP=$((STEP + 1))
  echo
  echo "[${STEP}/${TOTAL_STEPS}] $1"
}

ok() {
  echo "      ok: $1"
}

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

# Everything below this point mutates the live application, so the remaining
# preconditions are checked first. Failing here costs nothing; failing after the
# copy means a rollback and a restart for no reason.
if [[ ! -d "$APP_ROOT" ]]; then
  echo "Application root $APP_ROOT does not exist." >&2
  exit 1
fi

# The migration step and the running app both read this. It is deliberately not
# in Git, and the copy below never touches it, but an absent .env would surface
# as a confusing database failure midway through the deploy.
if [[ ! -f "$APP_ROOT/.env" ]]; then
  echo "No .env found at $APP_ROOT/.env; the app cannot reach the database." >&2
  exit 1
fi

for required in backend/src backend/scripts backend/package.json backend/package-lock.json; do
  if [[ ! -e "$SOURCE_ROOT/$required" ]]; then
    echo "Missing $required in $SOURCE_ROOT; the checkout looks incomplete." >&2
    exit 1
  fi
done

DEPLOY_COMMIT="$(git -C "$SOURCE_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
DEPLOY_SUBJECT="$(git -C "$SOURCE_ROOT" log -1 --pretty=%s 2>/dev/null || echo 'unknown commit')"

echo "=============================================="
echo " eduClub backend deployment"
echo " commit : $DEPLOY_COMMIT  $DEPLOY_SUBJECT"
echo " source : $SOURCE_ROOT"
echo " target : $APP_ROOT"
echo " started: $(date -u +'%Y-%m-%d %H:%M:%SZ')"
echo "=============================================="

step "Preflight checks"
ok "source, node environment, .env and app root all present"

step "Backing up the current release"
mkdir -p "$BACKUP_DIR"
cp -a "$APP_ROOT/src" "$BACKUP_DIR/src"
if [[ -d "$APP_ROOT/scripts" ]]; then
  cp -a "$APP_ROOT/scripts" "$BACKUP_DIR/scripts"
fi
cp -a "$APP_ROOT/package.json" "$BACKUP_DIR/package.json"
cp -a "$APP_ROOT/package-lock.json" "$BACKUP_DIR/package-lock.json"
ok "previous release saved to $BACKUP_DIR"

rollback() {
  echo
  echo "!! DEPLOYMENT FAILED at step ${STEP}/${TOTAL_STEPS}" >&2
  echo "!! Restoring the previous release from $BACKUP_DIR" >&2
  rm -rf "$APP_ROOT/src"
  rm -rf "$APP_ROOT/scripts"
  cp -a "$BACKUP_DIR/src" "$APP_ROOT/src"
  if [[ -d "$BACKUP_DIR/scripts" ]]; then
    cp -a "$BACKUP_DIR/scripts" "$APP_ROOT/scripts"
  fi
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
  echo "!! Rollback complete. The previous release is running again." >&2
  echo "!! Database migrations are NOT rolled back; each one commits separately." >&2
}

trap rollback ERR

step "Copying the new release into place"
rm -rf "$APP_ROOT/src" "$APP_ROOT/scripts"
cp -a "$SOURCE_ROOT/backend/src" "$APP_ROOT/src"
cp -a "$SOURCE_ROOT/backend/scripts" "$APP_ROOT/scripts"
cp -a "$SOURCE_ROOT/backend/package.json" "$APP_ROOT/package.json"
cp -a "$SOURCE_ROOT/backend/package-lock.json" "$APP_ROOT/package-lock.json"

set +u
# shellcheck disable=SC1091
source "$NODE_ENV_ROOT/bin/activate"
set -u
cd "$APP_ROOT"
ok "backend source, scripts and manifests copied"

step "Installing production dependencies"
npm install --omit=dev --no-audit --no-fund
ok "dependencies installed"

step "Running database migrations"
npm run db:migrate
ok "database schema is up to date"

step "Restarting the application"
mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"
ok "restart requested (Passenger reloads on the next request)"

step "Waiting for the health check"

# Passenger spawns the app lazily on the first request after restart.txt is
# touched, and that first boot connects to a database a network hop away. Thirty
# seconds was tight enough that a slow cold start looked like a failed deploy
# and triggered a needless rollback, so the window is wider and reports itself.
for attempt in {1..20}; do
  if curl --fail --silent --show-error --max-time 10 \
    "$HEALTH_URL" >/dev/null; then
    trap - ERR
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -nr \
      | tail -n +6 \
      | cut -d' ' -f2- \
      | xargs -r rm -rf
    ok "healthy after ${attempt} attempt(s)"
    echo
    echo "=============================================="
    echo " DEPLOYMENT SUCCEEDED"
    echo " commit  : $DEPLOY_COMMIT  $DEPLOY_SUBJECT"
    echo " health  : $HEALTH_URL responded OK"
    echo " backup  : $BACKUP_DIR"
    echo " duration: $(($(date +%s) - STARTED_AT))s"
    echo " finished: $(date -u +'%Y-%m-%d %H:%M:%SZ')"
    echo "=============================================="
    exit 0
  fi

  echo "  waiting for health check, attempt ${attempt}/20"
  sleep 3
done

echo "Health check did not pass within 60s of the restart." >&2
echo "Check the cPanel application log for the startup error." >&2
exit 1
