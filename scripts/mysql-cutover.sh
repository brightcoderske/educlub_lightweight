#!/usr/bin/env bash
#
# One-time cutover from Supabase PostgreSQL to MySQL. Run it once; after that
# every release goes out with scripts/deploy-cpanel-git.sh and nothing else.
#
#   bash scripts/mysql-cutover.sh
#
# There are no arguments. Everything is read from /home/codecham/educlub-backend/.env,
# which you upload before running this, so no password is typed at a prompt or
# left in shell history.
#
# That .env needs two database settings:
#
#   DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE
#   POSTGRES_SOURCE_URL=postgresql://...          <- the current Supabase URL
#
# POSTGRES_SOURCE_URL is read only by this script and only by step 4. The
# application never looks at it. Delete the line once the cutover is signed off.
#
#   1 preflight  paths, .env, both databases reachable
#   2 source     fetch main and install the migration dependencies
#   3 schema     create the tables in MySQL
#   4 dump       read Supabase out and verify the copy against it
#   5 import     load it into MySQL and verify the result
#   6 deploy     hand over to deploy-cpanel-git.sh          <- first live change
#
# Steps 1-5 do not touch the running site: the new database is written, the old
# one is only read. A failed run resumes with --from <step>.
#
# --skip-data starts an empty database and seeds only the system administrator.
# Do not use it on an account that already has real learner records.

set -Eeuo pipefail

DEPLOY_DIR="/home/codecham/domains/learn.educlub.co.ke/educlub-source"
GIT_DIR_PATH="/home/codecham/domains/learn.educlub.co.ke/educlub-lightweight.git"
APP_ROOT="/home/codecham/educlub-backend"
NODE_ENV_ROOT="/home/codecham/nodevenv/educlub-backend/20"
CUTOVER_ROOT="/home/codecham/educlub-cutover"
BRANCH="main"
SSH_KEY="$HOME/.ssh/github_educlub"

SKIP_DATA=0
NO_FETCH=0
ASSUME_YES=0
FROM_STEP=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM_STEP="$2"; shift 2 ;;
    --skip-data) SKIP_DATA=1; shift ;;
    --no-fetch) NO_FETCH=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,31p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

STEP_TOTAL=6
say() { echo; echo "[$1/$STEP_TOTAL] $2"; }
ok() { echo "      ok: $1"; }
die() { echo; echo "!! $1" >&2; exit 1; }

running() { [[ "$FROM_STEP" -le "$1" ]]; }

# CloudLinux's Node.js Selector replaces npm with a wrapper that redirects every
# install into the virtual environment's shared node_modules, and refuses to let
# an application root hold a real one. That is correct for the app root, which
# cPanel symlinks into the environment, but this script installs into the source
# checkout, where the wrapper reports "up to date" and writes nothing. Calling
# npm's own CLI with node skips the wrapper. NODE_PATH carries the platform's
# node_modules, so require.resolve finds it without a hard-coded path.
npm_cli() {
  local cli candidate
  cli="$(node -e 'console.log(require.resolve("npm/bin/npm-cli.js"))' 2>/dev/null || true)"

  if [[ -z "$cli" || ! -f "$cli" ]]; then
    # NODE_PATH is not always set the way require.resolve needs, so the
    # platform's own npm is looked up directly before giving up on it.
    for candidate in \
      "${CL_NODEHOME:-}/usr/lib/node_modules/npm/bin/npm-cli.js" \
      /opt/alt/alt-nodejs*/root/lib/node_modules/npm/bin/npm-cli.js; do
      if [[ -f "$candidate" ]]; then cli="$candidate"; break; fi
    done
  fi

  if [[ -n "$cli" && -f "$cli" ]]; then
    node "$cli" "$@"
  else
    npm "$@"
  fi
}

confirm() {
  [[ "$ASSUME_YES" == "1" ]] && return 0
  local reply
  read -r -p "$1 [type yes to continue] " reply </dev/tty
  [[ "$reply" == "yes" ]] || die "Stopped at your request."
}

# Reads one key from the .env file. Values are taken literally: the file is not
# sourced, so a password containing $ or a backtick cannot be executed.
env_value() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$APP_ROOT/.env" \
    | tail -n 1 | sed "s/^['\"]//; s/['\"]$//"
}

# ---------------------------------------------------------------- 1 preflight
say 1 "Preflight"

[[ -d "$DEPLOY_DIR" ]] || die "Deploy directory $DEPLOY_DIR not found."
[[ -f "$NODE_ENV_ROOT/bin/activate" ]] || die "Node.js environment not found at $NODE_ENV_ROOT."
[[ -d "$APP_ROOT" ]] || die "Application root $APP_ROOT does not exist."
[[ -f "$DEPLOY_DIR/scripts/deploy-cpanel-git.sh" ]] || die "Deploy script missing from $DEPLOY_DIR."

[[ -f "$APP_ROOT/.env" ]] || die "No .env at $APP_ROOT/.env.

Upload it there first. It is not in Git and this script will not invent one."

set +u
# shellcheck disable=SC1091
source "$NODE_ENV_ROOT/bin/activate"
set -u
command -v node >/dev/null || die "node is not on PATH after activating the environment."

TARGET_URL="$(env_value DATABASE_URL)"
SOURCE_URL="$(env_value POSTGRES_SOURCE_URL)"

for key in MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE MYSQL_SOCKET; do
  declare "IN_$key=$(env_value "$key")"
done

# dotenv treats an unquoted # as the start of a comment, so a password
# containing one is silently truncated - the application reads a different
# password than the file appears to hold, and the only symptom is an access
# denied error that looks like the password is simply wrong.
RAW_PASSWORD_LINE="$(sed -n 's/^[[:space:]]*MYSQL_PASSWORD[[:space:]]*=//p' "$APP_ROOT/.env" | tail -n 1)"
if [[ "$RAW_PASSWORD_LINE" == *"#"* ]]; then
  case "$RAW_PASSWORD_LINE" in
    \"*\"|\'*\') : ;;
    *) die "MYSQL_PASSWORD in .env contains an unquoted # and will be cut short there.

Wrap the value in double quotes:
  MYSQL_PASSWORD=\"the#password\"" ;;
  esac
fi

case "$TARGET_URL" in
  postgres://*|postgresql://*)
    die "DATABASE_URL in .env still names PostgreSQL.

Remove that line, or replace it with the mysql:// URL. src/config/db.js ignores
any URL that is not mysql, so the application would silently fall back to the
MYSQL_* settings while this script used the URL - two different databases." ;;
  mysql://*)
    ok "target read from DATABASE_URL" ;;
  "")
    # The .env carries the discrete settings only, which is the form with no
    # percent-encoding to get wrong. db.js and apply-schema.js both read them
    # directly; the transfer script is URL-only, so it is built here instead of
    # being a second copy of the credentials in the file that can drift.
    [[ -n "$IN_MYSQL_USER" && -n "$IN_MYSQL_DATABASE" ]] \
      || die "No DATABASE_URL and no MYSQL_USER/MYSQL_DATABASE in $APP_ROOT/.env."
    TARGET_URL="$(node -e '
const [user, password, host, port, database] = process.argv.slice(1);
const credential = password
  ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
  : encodeURIComponent(user);
process.stdout.write(`mysql://${credential}@${host || "127.0.0.1"}:${port || "3306"}/${database}`);
' "$IN_MYSQL_USER" "$IN_MYSQL_PASSWORD" "$IN_MYSQL_HOST" "$IN_MYSQL_PORT" "$IN_MYSQL_DATABASE")"
    ok "target built from the MYSQL_* settings" ;;
  *)
    die "DATABASE_URL in .env is not a mysql:// URL." ;;
esac

if [[ "$SKIP_DATA" == "0" ]]; then
  case "$SOURCE_URL" in
    postgres://*|postgresql://*) ok "Supabase source read from .env" ;;
    *) die "No POSTGRES_SOURCE_URL in $APP_ROOT/.env.

Add the current Supabase URL as POSTGRES_SOURCE_URL so the data can be copied
across, or pass --skip-data to start an empty database and lose it." ;;
  esac
fi

# Everything below runs against these two, so they are exported once here rather
# than rebuilt per step. dotenv does not override variables that are already set,
# so these also win inside the migration scripts.
export DATABASE_URL="$TARGET_URL"
export POSTGRES_SOURCE_URL="$SOURCE_URL"
for key in MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE MYSQL_SOCKET; do
  name="IN_$key"
  [[ -n "${!name}" ]] && export "$key=${!name}"
done

# cPanel keeps the deployment output as the deploy log, so neither URL is
# printed as-is: both carry a live password.
summarise() {
  [[ -z "$1" ]] && { echo "(none)"; return; }
  node -e '
const u = new URL(process.argv[1]);
process.stdout.write(`${u.username}@${u.hostname}:${u.port || "default"}/${u.pathname.replace(/^\//, "")}`);
' "$1"
}

TARGET_SUMMARY="$(summarise "$TARGET_URL")"
SOURCE_SUMMARY="$(summarise "$SOURCE_URL")"

# With a socket the host and port in the URL are ignored by every client here,
# so showing them would misreport where the connection actually goes.
if [[ -n "${IN_MYSQL_SOCKET:-}" ]]; then
  TARGET_SUMMARY="${IN_MYSQL_USER}@${IN_MYSQL_SOCKET}/${IN_MYSQL_DATABASE}"
fi

mkdir -p "$CUTOVER_ROOT"
DUMP_DIR="$CUTOVER_ROOT/pg-dump"

echo
echo "=============================================="
echo " eduClub MySQL cutover"
echo " source : $SOURCE_SUMMARY"
echo " target : $TARGET_SUMMARY"
echo " data   : $([[ "$SKIP_DATA" == "1" ]] && echo 'NOT migrated (--skip-data)' || echo 'copied from PostgreSQL')"
echo " from   : step $FROM_STEP"
echo "=============================================="

# ------------------------------------------------------------------- 2 source
if running 2; then
  say 2 "Fetching $BRANCH and installing migration dependencies"
  if [[ "$NO_FETCH" == "0" && -d "$GIT_DIR_PATH" ]]; then
    [[ -f "$SSH_KEY" ]] && git --git-dir="$GIT_DIR_PATH" config core.sshCommand "ssh -i $SSH_KEY -o IdentitiesOnly=yes"
    git --git-dir="$GIT_DIR_PATH" fetch origin "$BRANCH:$BRANCH"
    git --git-dir="$GIT_DIR_PATH" --work-tree="$DEPLOY_DIR" checkout -f "$BRANCH"
  fi
  ok "source at $(git --git-dir="$GIT_DIR_PATH" rev-parse --short "$BRANCH" 2>/dev/null || echo unknown)"

  [[ -f "$DEPLOY_DIR/backend/scripts/mysql-migration/apply-schema.js" ]] \
    || die "The MySQL migration scripts are not in the checkout. Push the release first."

  # mysql2 and pg are both production dependencies, so --omit=dev is enough.
  # This installs into the source tree and leaves the running app alone.
  cd "$DEPLOY_DIR/backend"
  npm_cli install --omit=dev --no-audit --no-fund

  # Checked rather than assumed: the wrapper this works around fails by printing
  # "up to date" and installing nothing, which otherwise surfaces two steps later
  # as a missing module and looks like a broken release.
  for module in mysql2 pg dotenv; do
    [[ -d "node_modules/$module" ]] || die "npm reported success but node_modules/$module is not there.

Install it directly and re-run with --from 3:
  cd $DEPLOY_DIR/backend
  node \"\$(node -e 'console.log(require.resolve(\"npm/bin/npm-cli.js\"))')\" install --omit=dev"
  done
  ok "dependencies installed in the source tree"
fi

# ------------------------------------------------------------------- 3 schema
if running 3; then
  say 3 "Creating the tables in $TARGET_SUMMARY"
  cd "$DEPLOY_DIR/backend"
  node scripts/mysql-migration/apply-schema.js
  ok "schema applied (re-running it is a no-op)"
fi

# --------------------------------------------------------------------- 4 dump
if running 4 && [[ "$SKIP_DATA" == "0" ]]; then
  say 4 "Reading Supabase into $DUMP_DIR"
  cd "$DEPLOY_DIR/backend/scripts/mysql-migration"
  node postgres-data-transfer.js audit
  rm -rf "$DUMP_DIR"
  node postgres-data-transfer.js dump --dump "$DUMP_DIR"
  node postgres-data-transfer.js verify --dump "$DUMP_DIR"
  # Checked back against Supabase while Supabase is still authoritative: a short
  # read is only detectable from here.
  node postgres-data-transfer.js verify-source --dump "$DUMP_DIR"
  ok "dump written and verified against Supabase"
elif running 4; then
  say 4 "Skipping the data copy (--skip-data)"
fi

# ------------------------------------------------------------------- 5 import
if running 5 && [[ "$SKIP_DATA" == "0" ]]; then
  say 5 "Loading the dump into MySQL"
  cd "$DEPLOY_DIR/backend/scripts/mysql-migration"
  node postgres-data-transfer.js import --dump "$DUMP_DIR" --replace
  node postgres-data-transfer.js verify-target --dump "$DUMP_DIR"
  ok "row counts and foreign keys match the dump"
elif running 5; then
  say 5 "Seeding the system administrator"
  cd "$DEPLOY_DIR/backend"
  node scripts/mysql-migration/seed-admin.js
  ok "administrator seeded"
fi

# ------------------------------------------------------------------- 6 deploy
if running 6; then
  say 6 "Deploying the backend"
  echo
  echo "  Everything so far only read the live site. This step replaces it."
  echo "  Anything written to Supabase after step 4 is not in the copy."
  confirm "  Go live on MySQL now?"
  echo

  if bash "$DEPLOY_DIR/scripts/deploy-cpanel-git.sh"; then
    echo
    echo "=============================================="
    echo " CUTOVER COMPLETE"
    echo " database : $TARGET_SUMMARY"
    [[ "$SKIP_DATA" == "0" ]] && echo " dump     : $DUMP_DIR (keep until sign-off)"
    echo "=============================================="
    echo
    echo "Next:"
    echo "  1. Work through section 4 of docs/PRODUCTION_DEPLOYMENT.md."
    echo "  2. Remove POSTGRES_SOURCE_URL from $APP_ROOT/.env once signed off."
    echo "  3. From now on, releases are just:"
    echo "       bash scripts/deploy-cpanel-git.sh"
    exit 0
  fi

  echo
  echo "!! The deploy failed and restored the previous CODE by itself." >&2
  echo "!! That code speaks PostgreSQL and .env now points at MySQL, so it" >&2
  echo "!! cannot start. Put the Supabase DATABASE_URL back in $APP_ROOT/.env" >&2
  echo "!! and touch $APP_ROOT/tmp/restart.txt to bring the old site up." >&2
  echo "!!" >&2
  echo "!! The MySQL database still holds everything step 5 loaded, so a retry" >&2
  echo "!! skips straight to the deploy:" >&2
  echo "!!   bash scripts/mysql-cutover.sh --from 6" >&2
  exit 1
fi
