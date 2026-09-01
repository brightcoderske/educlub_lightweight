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
