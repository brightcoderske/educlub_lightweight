# Production operations

## Database changes

Back up the database before every release. Apply immutable migrations as a deployment step before starting the application:

```sh
mysqldump --single-transaction --routines --triggers \
  --result-file=educlub-before-release.sql \
  -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE"
cd backend
npm ci
npm run db:migrate
npm run db:health
```

`--single-transaction` keeps the dump consistent without locking the tables the
live application is reading.

Normal server startup verifies the schema and never changes it. A checksum mismatch means an applied migration was edited; stop the deployment and add a new migration instead.

Restore into a newly created empty database first, verify it, and then switch application traffic:

```sh
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p -e "CREATE DATABASE educlub_restore"
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p educlub_restore < educlub-before-release.sql
```

Migrations are forward-only because DDL and data transformations are not always safely reversible, and MySQL additionally commits DDL implicitly, so a failed release cannot be unwound inside a transaction. Roll back application code only when it remains schema-compatible. Otherwise restore the pre-release backup into a new database and switch the connection string; never reset the live database destructively.

## Sign-in codes (MFA)

After their password, system admins and school admins are asked for a six-digit
code that is emailed to them. It is on for both roles until a System Admin says
otherwise, and the System Admin decides: **System Admin dashboard > Administrator
MFA** has a switch for each role. Someone who ticks "remember this device" is not
asked again on that browser for up to twelve hours. Teachers and learners are
never asked.

The code goes out through the same mail login as every other email. When mail is
not working, sign-in fails with "We could not email your verification code" -
closed on purpose, because a code nobody can receive must not be skippable.
`npm run email:verify`, and step 8 of every deploy, says whether mail works.

If mail is down and an administrator cannot get in, a System Admin who still can
switches the role off from the dashboard. When the System Admin is the one locked
out, switch both roles off in the database, sign in, fix mail, and switch them
back on from the dashboard:

```sql
UPDATE system_settings SET value = '{"system_admin": false, "school_admin": false}' WHERE `key` = 'mfa_policy';
```

## Local verification

Copy `backend/.env.example` to `backend/.env`, replace every placeholder, create the MySQL 8 database, then run:

```sh
cd backend
npm ci
npm run db:migrate
npm test
npm start

cd ../frontend
npm ci
npm test -- --runInBand
npm run build
npm start
```

Readiness is exposed at `/health/ready`; liveness is exposed at `/health/live`. Built-in course imports are explicit maintenance commands and are no longer performed during web-server startup.
