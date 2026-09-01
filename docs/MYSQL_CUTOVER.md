# MySQL cutover

One-time move of production from Supabase PostgreSQL to MySQL 8 on the cPanel
account. Run it once. Afterwards every release is `scripts/deploy-cpanel-git.sh`
and nothing else.

There are three things to do: create the database, upload the `.env`, run one
script.

## What changes

The application keeps writing PostgreSQL SQL. `backend/src/config/sqlDialect.js`
translates it at the single choke point in `backend/src/config/db.js`, so this is
a data and configuration exercise, not a rewrite of the queries.

The database stops being a network hop away. It runs on the same account, so the
connection is to `127.0.0.1` and every query saves the round trip to Supabase.

## 1. Create the database

cPanel → **MySQL® Databases**:

1. Create a database, e.g. `educlub`.
2. Create a user, e.g. `educlub`, with a generated password.
3. Add the user to the database with **ALL PRIVILEGES**.

cPanel prefixes both names with the account name, so they become
`codecham_educlub`. Use the prefixed names in the `.env`.

The schema needs no routines or triggers — 65 tables, 153 indexes, 6 seed
inserts — so a normal database-scoped user is enough.

Check `max_user_connections` on the same page. `DB_POOL_MAX` must stay at or
below it; the shipped value is 4.

## 2. Upload the .env

The file goes to:

```text
/home/codecham/educlub-backend/.env
```

It is not in Git and never has been. Start from
`backend/.env.production.example` and set the database block:

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=codecham_educlub
MYSQL_PASSWORD=the-generated-password
MYSQL_DATABASE=codecham_educlub

POSTGRES_SOURCE_URL=postgresql://...the current Supabase URL...
```

Three things about this file are easy to get wrong and hard to diagnose:

**Do not set `DATABASE_URL` as well.** `src/config/db.js` prefers it over the
discrete settings while `scripts/mysql-migration/apply-schema.js` prefers the
discrete settings. Keeping both invites them drifting apart, with the
application and the migration step talking to different databases.

**Quote a password containing `#`.** dotenv reads an unquoted `#` as the start of
a comment and drops the rest, so the application reads a shorter password than
the file appears to hold and fails with an access denied error that looks like a
wrong password. `MYSQL_PASSWORD="the#password"` is safe.

**Carry the existing secrets across.** `JWT_SECRET` and
`AI_KEY_ENCRYPTION_SECRET` must keep the values already on the server. Changing
`JWT_SECRET` signs every user out; changing `AI_KEY_ENCRYPTION_SECRET` makes
stored AI keys undecryptable.

`POSTGRES_SOURCE_URL` is read only by the cutover script, only during step 4 of
its run. The application never looks at it. Delete the line once the cutover is
signed off — it is a live credential to a database that still holds every row.

## 3. Run the cutover

From the cPanel shell, in the deploy directory:

```bash
bash scripts/mysql-cutover.sh
```

No arguments, and no password typed at a prompt or left in shell history — it
reads everything from the `.env` uploaded in step 2.

It runs six steps and stops at the first failure:

| Step | Does | Touches the live site |
| --- | --- | --- |
| 1 preflight | paths, `.env`, both databases reachable | no |
| 2 source | fetch `main`, install migration dependencies | no |
| 3 schema | create the tables in MySQL | no |
| 4 dump | read Supabase out, verify the copy against it | no, reads only |
| 5 import | load into MySQL, verify row counts and foreign keys | no |
| 6 deploy | hand over to `deploy-cpanel-git.sh` | **yes** |

Step 6 asks for confirmation first. Everything before it writes only to the new
database and reads the old one, so a failure in steps 1–5 leaves the running
site exactly as it was.

A failed run resumes without repeating the slow parts:

```bash
bash scripts/mysql-cutover.sh --from 5
```

`--skip-data` starts an empty database and seeds only the system administrator.
Do not use it on an account that already holds real learner records.

### Timing

Step 4 reads every row out of Supabase over the network, so run the whole thing
outside teaching hours. Anything written to Supabase after step 4 is not in the
copy — if a long gap opens between the dump and step 6, re-run `--from 4`.

## 4. After it reports complete

1. Work through the smoke test in `PRODUCTION_DEPLOYMENT.md` section 4.
2. Delete `POSTGRES_SOURCE_URL` from the `.env`.
3. Take a `mysqldump --single-transaction` before every release from now on. See
   `PRODUCTION_OPERATIONS.md`.

`backend/uploads` is not in any database dump and still needs its own backup.

## Rollback

The deploy script restores the previous release automatically if a step fails,
but it restores **code only** — it does not revert migrations and it does not
touch the `.env`.

Code and configuration have to move together. PostgreSQL code cannot read the
MySQL database and the MySQL code cannot read Supabase, so a partial rollback
fails on the first query. To go back:

1. Put the Supabase `DATABASE_URL` back in `/home/codecham/educlub-backend/.env`.
2. Deploy the last commit before the MySQL rewrite.
3. `touch /home/codecham/educlub-backend/tmp/restart.txt`.

Supabase still holds every row as of the dump, so this stays available until the
project is deleted. Keep it for a full teaching cycle before tearing it down.

`pg` remains in `backend/package.json` dependencies because
`postgres-data-transfer.js` needs it. It can be dropped once Supabase is gone.
