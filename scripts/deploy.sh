#!/usr/bin/env bash
# Deploys eduClub on Novahost: one Node app in ~/apps/educlub serving the website and the API on one
# address. Nothing deploys by itself: pushing to GitHub changes nothing until this is run on the server.
#
#   bash scripts/deploy.sh             fetch main, list the new commits, ask, then deploy them
#   bash scripts/deploy.sh --yes       the same without the question
#   bash scripts/deploy.sh --no-pull   deploy exactly what is checked out now
#   bash scripts/deploy.sh --force     do every step (first deploy, or after editing .env heavily)
#
# Only the work a change needs is done:
#   backend packages   installed only when backend/package-lock.json changed (or none are installed)
#   website packages   installed only when frontend/package-lock.json changed
#   website build      rebuilt only when something under frontend/ changed (or there is no build)
#   database           backed up, then migrated, only when the schema changed
# A backend-only change is a restart and nothing else.
#
# Safety: the website is built into frontend/build.next while the site keeps serving the current build,
# and swapped in only when it is complete. Any failure puts the previous code and build back and restarts.
#
# Settings, all optional, read from the environment:
#   NODE_VENV        the nodevenv "bin/activate" (found under ~/nodevenv/apps/educlub/backend/ otherwise)
#   SITE_URL         address /health is checked on (default FRONTEND_URL from backend/.env)
#   RUNNER_DIR       folder runner.educlub.co.ke serves (default runner/ in this checkout; skipped if missing)
#   BACKUP_DIR       where database backups go (default backups/ in this checkout; the newest 14 are kept)
#   BUILD_MEMORY_MB  heap limit for the website build (default 1024)
#   SKIP_BACKUP=1    migrate without taking a backup first
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"
STATE="$APP_DIR/.deploy"
BRANCH="${BRANCH:-main}"
LAST_FILE="$STATE/last-sha"
mkdir -p "$STATE"
export GIT_TERMINAL_PROMPT=0

PULL=1; FORCE=0; ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --force) FORCE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
git_app() { git -C "$APP_DIR" "$@"; }

# One deploy at a time. The lock is held across the restart below (exec keeps the file open).
if command -v flock >/dev/null 2>&1 && [[ "${DEPLOY_LOCKED:-0}" != "1" ]]; then
  exec 9>"$STATE/lock"
  flock -n 9 || { echo "Another deploy is already running." >&2; exit 1; }
  export DEPLOY_LOCKED=1
fi

# ---------------------------------------------------------------- fetch, show, ask, then run the new script
# The update happens first and the script starts again, so every deploy runs the deploy script of the
# commit it deploys.
if [[ "$PULL" == "1" && "${DEPLOY_PULLED:-0}" != "1" ]]; then
  OLD_HEAD="$(git_app rev-parse HEAD)"
  git_app fetch -q origin "$BRANCH"
  NEW="$(git_app rev-parse "origin/$BRANCH")"
  BASE="$(cat "$LAST_FILE" 2>/dev/null || true)"
  if [[ -n "$BASE" && "$NEW" == "$BASE" && "$FORCE" != "1" ]]; then
    echo "Already deployed: ${NEW:0:7} is live. Nothing to do (--force redoes it)."
    exit 0
  fi
  SINCE="${BASE:-$OLD_HEAD}"
  if [[ "$NEW" != "$SINCE" ]] && git_app cat-file -e "$SINCE^{commit}" 2>/dev/null; then
    echo "New since ${SINCE:0:7}:"
    git_app log --oneline --no-decorate "$SINCE..$NEW" | head -30 | sed 's/^/  /'
  fi
  if [[ "$ASSUME_YES" != "1" && -t 0 ]]; then
    read -r -p "Deploy ${NEW:0:7} now? [y/N] " reply
    case "$reply" in y|Y|yes|YES) ;; *) echo "Not deployed."; exit 0 ;; esac
  fi
  # The website build rewrites frontend/public/sitemap.xml; that copy must not block the update.
  git_app checkout -q -- frontend/public/sitemap.xml 2>/dev/null || true
  git_app merge -q --ff-only "origin/$BRANCH" || {
    echo "The checkout cannot fast-forward to origin/$BRANCH (local edits on the server?). Resolve it, then deploy again." >&2
    exit 1
  }
  export DEPLOY_PULLED=1 DEPLOY_OLD_HEAD="$OLD_HEAD"
  exec bash "$APP_DIR/scripts/deploy.sh" "$@"
fi

NEW="$(git_app rev-parse HEAD)"
OLD_HEAD="${DEPLOY_OLD_HEAD:-$NEW}"
BASE="$(cat "$LAST_FILE" 2>/dev/null || true)"

# ---------------------------------------------------------------- what changed since the last good deploy
EVERYTHING=1; CHANGED=""
if [[ -n "$BASE" && "$FORCE" != "1" ]] && git_app cat-file -e "$BASE^{commit}" 2>/dev/null; then
  CHANGED="$(git_app diff --name-only "$BASE" "$NEW")"
  EVERYTHING=0
fi
touched() { [[ "$EVERYTHING" == "1" ]] || printf '%s\n' "$CHANGED" | grep -Eq "$1"; }
fingerprint() { sha256sum "$1" | awk '{print $1}'; }
same_lock() { [[ "$(cat "$STATE/$1" 2>/dev/null || true)" == "$(fingerprint "$2")" ]]; }

NEED_BACKEND_DEPS=1; NEED_FRONTEND_DEPS=0; NEED_BUILD=0; NEED_MIGRATE=0
if same_lock backend-deps "$BACKEND/package-lock.json" && [[ -e "$BACKEND/node_modules/express" ]]; then NEED_BACKEND_DEPS=0; fi
if touched '^frontend/' || [[ ! -f "$FRONTEND/build/index.html" ]]; then
  NEED_BUILD=1
  if ! same_lock frontend-deps "$FRONTEND/package-lock.json" || [[ ! -e "$FRONTEND/node_modules/vite" ]]; then NEED_FRONTEND_DEPS=1; fi
fi
if touched '^backend/(scripts/mysql-migration/|src/database/)'; then NEED_MIGRATE=1; fi

if [[ -n "$BASE" ]]; then FROM="from ${BASE:0:7}"; else FROM="first deploy"; fi
say "Deploying ${NEW:0:7} ($FROM): backend packages=$NEED_BACKEND_DEPS website packages=$NEED_FRONTEND_DEPS website build=$NEED_BUILD database=$NEED_MIGRATE"

# ---------------------------------------------------------------- checks before touching anything
[[ -f "$BACKEND/.env" ]] || { echo "No backend/.env. Create it first (docs/NOVAHOST.md, part D)." >&2; exit 1; }
if [[ -z "${NODE_VENV:-}" ]]; then
  NODE_VENV="$(ls -d "$HOME"/nodevenv/apps/educlub/backend/*/bin/activate 2>/dev/null | sort -V | tail -1 || true)"
fi
if [[ -z "${NODE_VENV:-}" || ! -f "$NODE_VENV" ]]; then
  echo "No Node.js environment for apps/educlub/backend. Create the app in cPanel > Setup Node.js App first, or set NODE_VENV." >&2
  exit 1
fi
set +u
# shellcheck disable=SC1090
source "$NODE_VENV"
set -u
env_value() { sed -n "s/^$1=//p" "$BACKEND/.env" | head -1 | tr -d "\"' \r"; }
SITE_URL="${SITE_URL:-$(env_value FRONTEND_URL)}"
SITE_URL="${SITE_URL%/}"
[[ -n "$SITE_URL" ]] || { echo "Set FRONTEND_URL in backend/.env (or SITE_URL) so the deploy can check the site." >&2; exit 1; }
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

# cPanel's Node selector puts a wrapper in front of npm that installs into the registered app's shared
# folder. That is right for the backend but refuses the website's own node_modules, so the website
# calls npm directly: the npm that ships with the Node actually running. The host keeps many Node
# versions side by side (/opt/alt/alt-nodejs14 ... 24), and the nodevenv's `node` is a wrapper, so
# the real program's own folder is the only reliable guide. Node 14's npm 6 cannot read the lock file.
NPM_CLI="${NPM_CLI:-}"
if [[ -z "$NPM_CLI" ]]; then
  NODE_HOME="$(dirname "$(dirname "$(node -p 'process.execPath')")")"
  for candidate in "$NODE_HOME/lib/node_modules/npm/bin/npm-cli.js" \
                   "/opt/alt/alt-nodejs$(node -p 'process.versions.node.split(".")[0]')/root/usr/lib/node_modules/npm/bin/npm-cli.js"; do
    if [[ -f "$candidate" ]]; then NPM_CLI="$candidate"; break; fi
  done
fi
website_npm() { if [[ -n "$NPM_CLI" ]]; then node "$NPM_CLI" "$@"; else npm "$@"; fi; }
NPM_MAJOR="$(website_npm --version 2>/dev/null | cut -d. -f1)"
if [[ ! "$NPM_MAJOR" =~ ^[0-9]+$ ]] || (( NPM_MAJOR < 7 )); then
  echo "The website needs npm 7 or newer, and the npm found is '${NPM_MAJOR:-none}' (${NPM_CLI:-npm}). Set NPM_CLI to a newer npm-cli.js." >&2
  exit 1
fi
say "Website packages use npm $(website_npm --version) with Node $(node --version)."

# ---------------------------------------------------------------- failure: put everything back
SWAPPED=0
STAGE="$FRONTEND/build.next"
PREVIOUS="$FRONTEND/build.previous"
write_release() { printf '{"commit":"%s","deployedAt":"%s"}\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BACKEND/.release.json"; }
on_fail() {
  trap - ERR
  set +e
  say "FAILED (line $1). Putting the previous version back."
  rm -rf "$STAGE"
  if [[ "$SWAPPED" == "1" && -d "$PREVIOUS" ]]; then rm -rf "$FRONTEND/build"; mv "$PREVIOUS" "$FRONTEND/build"; fi
  if [[ "$OLD_HEAD" != "$NEW" ]]; then git_app reset -q --hard "$OLD_HEAD"; fi
  git_app checkout -q -- frontend/public/sitemap.xml 2>/dev/null
  write_release "$OLD_HEAD"
  mkdir -p "$BACKEND/tmp" && touch "$BACKEND/tmp/restart.txt"
  say "Version ${OLD_HEAD:0:7} is back in place. Database changes are not undone; any backup taken is in $BACKUP_DIR."
  exit 1
}
die() { echo "$1" >&2; on_fail "${BASH_LINENO[0]}"; }
trap 'on_fail $LINENO' ERR

# ---------------------------------------------------------------- packages
if [[ "$NEED_BACKEND_DEPS" == "1" ]]; then
  say "Installing backend packages..."
  (cd "$BACKEND" && npm install --omit=dev --no-audit --no-fund)
  fingerprint "$BACKEND/package-lock.json" > "$STATE/backend-deps"
fi
if [[ "$NEED_FRONTEND_DEPS" == "1" ]]; then
  say "Installing website packages (two downloads at a time)..."
  (cd "$FRONTEND" && website_npm ci --include=dev --no-audit --no-fund --maxsockets=2)
  fingerprint "$FRONTEND/package-lock.json" > "$STATE/frontend-deps"
fi

# The app reads and checks its settings as it starts, and a refusal there shows only as a page that
# never answers. Running the same check now names the problem before anything is built or restarted.
say "Checking backend/.env..."
(cd "$BACKEND" && node -e 'try { require("./src/config/env"); } catch (error) { console.error(error.message); process.exit(1); }') \
  || die "backend/.env is not ready: the reason is on the line above. Fix it, then deploy again."

# ---------------------------------------------------------------- website build, beside the live one
if [[ "$NEED_BUILD" == "1" ]]; then
  # The account counts every thread against its process limit, and Vite's compiler starts one per CPU
  # it can see (dozens on a shared host). Pinning the build to two CPUs keeps that pool small.
  PIN=()
  if command -v taskset >/dev/null 2>&1 && taskset -c 0,1 true 2>/dev/null; then PIN=(taskset -c 0,1); fi
  if [[ ${#PIN[@]} -gt 0 ]]; then CPUS="pinned to 2 CPUs"; else CPUS="taskset unavailable, not pinned"; fi
  say "Building the website ($CPUS, heap ${BUILD_MEMORY_MB:-1024} MB)..."
  rm -rf "$STAGE"
  attempt=1
  until (cd "$FRONTEND" && export BUILD_OUT_DIR=build.next RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=2 \
           NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY_MB:-1024}" \
         && ${PIN[@]+"${PIN[@]}"} node node_modules/vite/bin/vite.js build \
         && node scripts/generate-public-seo.js); do
    if (( attempt >= 3 )); then die "The website build failed 3 times."; fi
    attempt=$((attempt + 1))
    say "Build failed (often a momentary process limit); trying again in 20 seconds ($attempt of 3)..."
    sleep 20
  done
  git_app checkout -q -- frontend/public/sitemap.xml 2>/dev/null || true
  if [[ ! -s "$STAGE/index.html" ]]; then die "The build finished without an index.html."; fi
fi

# ---------------------------------------------------------------- database: back up, then migrate
if [[ "$NEED_MIGRATE" == "1" ]]; then
  if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
    mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
    say "Backing up the database before migrating..."
    # The password goes in a private options file, never on the command line where ps would show it.
    CNF="$STATE/db.cnf"
    ( umask 077
      cd "$BACKEND" && node -e '
        require("dotenv").config();
        const fs = require("fs");
        const u = new URL(process.env.DATABASE_URL);
        fs.writeFileSync(process.argv[1], [
          "[client]",
          `user=${decodeURIComponent(u.username)}`,
          `password=${decodeURIComponent(u.password)}`,
          `host=${u.hostname || "localhost"}`,
          `port=${u.port || 3306}`, "",
        ].join("\n"));
        process.stdout.write(decodeURIComponent(u.pathname.slice(1)));
      ' "$CNF" > "$STATE/db.name" )
    BACKUP_FILE="$BACKUP_DIR/educlub-$(date -u +%Y%m%dT%H%M%SZ)-${OLD_HEAD:0:7}.sql.gz"
    mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines "$(cat "$STATE/db.name")" | gzip > "$BACKUP_FILE"
    rm -f "$CNF" "$STATE/db.name"
    ls -1t "$BACKUP_DIR"/educlub-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
    say "Backup saved: $BACKUP_FILE"
  fi
  say "Migrating the database..."
  (cd "$BACKEND" && node scripts/mysql-migration/apply-schema.js)
fi

# ---------------------------------------------------------------- swap in the new website
if [[ "$NEED_BUILD" == "1" ]]; then
  rm -rf "$PREVIOUS"
  if [[ -d "$FRONTEND/build" ]]; then mv "$FRONTEND/build" "$PREVIOUS"; fi
  mv "$STAGE" "$FRONTEND/build"
  SWAPPED=1
  # runner.educlub.co.ke: the Python runner on an address of its own, so learners' code never runs with
  # access to the signed-in site. It needs only its page and the scripts in assets/.
  RUNNER_DIR="${RUNNER_DIR:-$APP_DIR/runner}"
  if [[ -d "$RUNNER_DIR" ]]; then
    rm -rf "$RUNNER_DIR/assets.next"
    cp -a "$FRONTEND/build/assets" "$RUNNER_DIR/assets.next"
    cp "$FRONTEND/build/python-runner.html" "$RUNNER_DIR/python-runner.html"
    cp "$APP_DIR/deploy/runner.htaccess" "$RUNNER_DIR/.htaccess"
    rm -rf "$RUNNER_DIR/assets"
    mv "$RUNNER_DIR/assets.next" "$RUNNER_DIR/assets"
    say "Python runner updated in $RUNNER_DIR."
  else
    say "No $RUNNER_DIR, so the Python runner was not updated (docs/NOVAHOST.md, step 1)."
  fi
fi

# ---------------------------------------------------------------- restart, and confirm the new version answers
write_release "$NEW"

# LiteSpeed can leave an old worker running after a restart is requested. Only processes that ARE Node
# (named node, or lsnode:... for LiteSpeed's workers) with the backend as working folder are stopped:
# never this script, and never a shell someone has open there, whatever it is running.
for proc in /proc/[0-9]*; do
  pid="${proc##*/}"
  [[ "$pid" == "$$" || "$pid" == "$PPID" ]] && continue
  [[ "$(readlink "$proc/cwd" 2>/dev/null || true)" == "$BACKEND" ]] || continue
  if grep -Eq '^(node|lsnode)' "$proc/comm" 2>/dev/null; then kill -TERM "$pid" 2>/dev/null || true; fi
done
mkdir -p "$BACKEND/tmp"
touch "$BACKEND/tmp/restart.txt"

# Passenger starts the app on the first request after a restart, so this check is also what starts it.
# It asks the public address and also this server directly (127.0.0.1, which the web server answers for
# every site on it). Before DNS points here (a first deploy), the public address still reaches the old
# host, so only the direct answer can show the new version. The direct request skips the certificate
# check: it connects to this server itself, which may not have its certificate yet.
SITE_HOST="${SITE_URL#*://}"
SITE_HOST="${SITE_HOST%%/*}"
health_commit() { sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p'; }
running_commit() {
  local found
  found="$(curl -fsS --max-time 10 "$SITE_URL/health" 2>/dev/null | health_commit || true)"
  [[ "$found" == "$NEW" ]] && { echo "$found"; return; }
  curl -fsSk --max-time 10 --resolve "$SITE_HOST:443:127.0.0.1" "https://$SITE_HOST/health" 2>/dev/null | health_commit || true
}
say "Checking $SITE_URL/health for ${NEW:0:7}..."
running=""
for _ in $(seq 1 18); do
  running="$(running_commit)"
  [[ "$running" == "$NEW" ]] && break
  sleep 5
done
if [[ "$running" != "$NEW" ]]; then
  die "The site did not report ${NEW:0:7} within 90 seconds (it reports '${running:0:7}'). See the app's log in cPanel > Setup Node.js App."
fi

trap - ERR
echo "$NEW" > "$LAST_FILE"
rm -rf "$PREVIOUS"
say "DEPLOYED ${NEW:0:7}. $SITE_URL is running it."
