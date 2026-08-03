# Production operations

## Database changes

Back up the database before every release. Apply immutable migrations as a deployment step before starting the application:

```sh
pg_dump --format=custom --no-owner --file educlub-before-release.dump "$DATABASE_URL"
cd backend
npm ci
npm run db:migrate:status
npm run db:migrate
npm run db:health
```

Normal server startup verifies the schema and never changes it. A checksum mismatch means an applied migration was edited; stop the deployment and add a new migration instead.

Restore into a newly created empty database first, verify it, and then switch application traffic:

```sh
createdb educlub_restore
pg_restore --clean --if-exists --no-owner --dbname educlub_restore educlub-before-release.dump
```

Migrations are forward-only because PostgreSQL DDL and data transformations are not always safely reversible. Roll back application code only when it remains schema-compatible. Otherwise restore the pre-release backup into a new database and switch the connection string; never reset the live database destructively.

## Local verification

Copy `backend/.env.example` to `backend/.env`, replace every placeholder, create the PostgreSQL database, then run:

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
