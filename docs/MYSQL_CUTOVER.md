# MySQL cutover

One-off runbook for moving production from Supabase PostgreSQL to MySQL 8 on the
cPanel account. Everything here happens **before** the backend release that
contains the MySQL rewrite is deployed. The frontend is unaffected.

Read this end to end first. Step 6 is the only irreversible one, and it is the
only step that touches live traffic.

## What changes

The application keeps writing PostgreSQL SQL. `backend/src/config/sqlDialect.js`
translates it at the single choke point in `backend/src/config/db.js`, so the
cutover is a data and configuration exercise, not a rewrite of the queries.

The database stops being a network hop away. It runs on the same account, so the
connection is to `127.0.0.1` and every query saves the round trip to Supabase.

## 1. Create the database

In cPanel, **MySQL® Databases**:

1. Create a database, e.g. `codecham_educlub`.
2. Create a user, e.g. `codecham_educlub`, with a generated password.
3. Add the user to the database with **ALL PRIVILEGES**.

cPanel prefixes both names with the account name. Use the prefixed names
everywhere below. The schema needs no routines or triggers — it is 65 tables,
153 indexes and 6 seed inserts — so a normal database-scoped user is enough.

Check the account's `max_user_connections` in **MySQL® Databases**. `DB_POOL_MAX`
must stay at or below it; the production example ships `DB_POOL_MAX=4`.

## 2. Point a shell at both databases

Run the transfer from the cPanel shell, not a laptop: it reads every row from
Supabase and writes it back over the local socket. Export both URLs in that
shell — the scripts also read `backend/.env`, so do not edit the live `.env`
yet.

```sh
export DATABASE_URL='mysql://codecham_educlub:PASSWORD@127.0.0.1:3306/codecham_educlub'
export POSTGRES_SOURCE_URL='postgresql://USER:PASSWORD@HOST:6543/postgres?sslmode=require'
```

`DATABASE_URL` must name the `mysql` scheme. Anything else is ignored and the
discrete `MYSQL_*` settings are used instead, which is how a cutover ends up
silently writing to the wrong database.

`scripts/mysql-migration/apply-schema.js` reads only the discrete form, so set it
too:

```sh
export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306
export MYSQL_USER=codecham_educlub MYSQL_PASSWORD=PASSWORD
export MYSQL_DATABASE=codecham_educlub
```

## 3. Apply the schema

```sh
cd backend
npm ci
npm run db:migrate
npm run db:health
```

`db:migrate` compares each statement against `information_schema` and skips the
ones that would be no-ops, so it is safe to re-run. It is the same command the
deploy script runs on every release.

Do not use `npm run migrate`. That is the old PostgreSQL runner and it feeds
`schema.sql`, row-level-security statements included, to a MySQL server.

## 4. Transfer the data

`scripts/mysql-migration/postgres-data-transfer.js` runs in modes. Take them in
order and read the JSON each one prints.

```sh
cd backend/scripts/mysql-migration
node postgres-data-transfer.js audit
node postgres-data-transfer.js dump          --dump ./pg-dump
node postgres-data-transfer.js verify        --dump ./pg-dump
node postgres-data-transfer.js verify-source --dump ./pg-dump
```

`audit` reports what the source holds and resolves nothing. `dump` writes a
compressed logical dump. `verify` checks the dump against itself, and
`verify-source` checks it back against Supabase — run both before importing, so
a short read is caught while the source is still authoritative.

Keep `./pg-dump` until the cutover is signed off. It is the rollback.

## 5. Import and verify

```sh
node postgres-data-transfer.js import        --dump ./pg-dump --replace
node postgres-data-transfer.js verify-target --dump ./pg-dump
```

`--replace` is mandatory and the script refuses to import without it, because
rows already in matching MySQL tables are replaced. On a database created at
step 1 the only such rows are the schema's own seed inserts.

`verify-target` compares MySQL against the dump. Do not continue on a mismatch —
re-run the import rather than patching rows by hand.

Then confirm the application's own view of the database:

```sh
cd ../..
npm run db:health
```

## 6. Switch production over

This is the irreversible step. Everything above leaves the live site untouched.

1. Put the Supabase database in read-only or accept that writes after step 4 are
   lost. The dump is a point-in-time copy; anything a learner submits between the
   dump and this step is not in it. Do this outside teaching hours.
2. Re-run steps 4 and 5 if significant time has passed.
3. In cPanel, **Setup Node.js App**, replace `DATABASE_URL` with the `mysql://`
   URL from step 2. Remove nothing else.
4. Deploy the backend release: cPanel Git → **Update from Remote** → **Deploy
   HEAD Commit**. `scripts/deploy-cpanel-git.sh` runs `db:migrate`, restarts
   Passenger, and polls `https://learn.educlub.co.ke/health`.
5. Work through the smoke test in `PRODUCTION_DEPLOYMENT.md` section 4.

## Rollback

The deploy script restores the previous release automatically if a step fails,
but it restores **code only** — it does not revert migrations, and it does not
touch `DATABASE_URL`.

To go back to Supabase: set `DATABASE_URL` in cPanel to the PostgreSQL URL and
deploy the last commit that predates the MySQL rewrite. The two must move
together. PostgreSQL code cannot read the MySQL database and the MySQL code
cannot read Supabase, so a partial rollback fails on the first query.

Supabase still holds every row as of the dump, so this stays available until the
project is deleted. Keep it for a full teaching cycle before tearing it down.

## After the cutover

- Take a `mysqldump --single-transaction` before every release from now on. See
  `PRODUCTION_OPERATIONS.md`.
- `backend/uploads` is not in any database dump and still needs its own backup.
- `pg` remains in `backend/package.json` dependencies because
  `postgres-data-transfer.js` needs it. It can be dropped once Supabase is gone.
