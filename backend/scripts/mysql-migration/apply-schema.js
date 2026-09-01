#!/usr/bin/env node
/**
 * Applies schema.mysql.sql to a MySQL database, idempotently.
 *
 * PostgreSQL spells idempotency inline - ADD COLUMN IF NOT EXISTS, CREATE INDEX
 * IF NOT EXISTS, DROP CONSTRAINT IF EXISTS. MySQL supports none of those, so
 * the check moves here: each statement is compared against information_schema
 * and skipped when it would be a no-op. That keeps the generated SQL readable
 * and puts all the conditional logic in one place.
 *
 * Usage: node apply-schema.js [--database educlub] [--port 3306]
 */
const fs = require("fs");
const path = require("path");

// The deployment runs this through `npm run db:migrate`, where the only record
// of the connection settings is backend/.env - cPanel does not put them in the
// shell. Without this the fallbacks below would win and the release would
// migrate root@127.0.0.1/educlub, which is either nothing or the wrong database.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mysql = require("mysql2/promise");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

// One DATABASE_URL is the whole configuration for the running application, so
// it has to be enough here too. Anything that is not a mysql URL is ignored
// rather than guessed at, matching src/config/db.js.
function fromDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || !/^mysql:/i.test(value)) return {};

  const parsed = new URL(value);
  return {
    host: parsed.hostname || undefined,
    port: parsed.port || undefined,
    user: decodeURIComponent(parsed.username || "") || undefined,
    password: decodeURIComponent(parsed.password || "") || undefined,
    database: parsed.pathname.replace(/^\//, "") || undefined,
  };
}

const url = fromDatabaseUrl();

// Set from SELECT VERSION() once connected. cPanel ships MariaDB, which differs
// from MySQL 8 in ways the generated schema runs into.
let isMariaDb = false;

// cPanel grants the account as user@localhost, which MariaDB matches only over
// the unix socket. Once socketPath is set mysql2 ignores host and port, so they
// are left off entirely rather than being set to something misleading.
const socketPath = arg("socket", process.env.MYSQL_SOCKET);

const CONFIG = {
  ...(socketPath
    ? { socketPath }
    : {
        host: arg("host", process.env.MYSQL_HOST || url.host || "127.0.0.1"),
        port: Number(arg("port", process.env.MYSQL_PORT || url.port || 3306)),
      }),
  user: arg("user", process.env.MYSQL_USER || url.user || "root"),
  password: arg("password", process.env.MYSQL_PASSWORD ?? url.password ?? ""),
  database: arg("database", process.env.MYSQL_DATABASE || url.database || "educlub"),
  multipleStatements: false,
};

function splitStatements(sql) {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*--[^\n]*$/gm, "").trim())
    .filter(Boolean);
}

async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [CONFIG.database, table, column],
  );
  return rows.length > 0;
}

async function indexExists(db, table, index) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [CONFIG.database, table, index],
  );
  return rows.length > 0;
}

async function constraintExists(db, table, name) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1`,
    [CONFIG.database, table, name],
  );
  return rows.length > 0;
}

// Returns "skip" when the statement is already satisfied, otherwise null.
async function reasonToSkip(db, statement) {
  const addColumn = statement.match(/^ALTER TABLE (\w+)\s+ADD COLUMN (\w+)/i);
  if (addColumn && (await columnExists(db, addColumn[1], addColumn[2]))) {
    return `column ${addColumn[1]}.${addColumn[2]} already present`;
  }

  const dropCheck = statement.match(/^ALTER TABLE (\w+)\s+DROP CHECK (\w+)/i);
  if (dropCheck && !(await constraintExists(db, dropCheck[1], dropCheck[2]))) {
    return `check ${dropCheck[2]} not present`;
  }

  const addConstraint = statement.match(/^ALTER TABLE (\w+)\s+ADD CONSTRAINT (\w+)/i);
  if (addConstraint && (await constraintExists(db, addConstraint[1], addConstraint[2]))) {
    return `constraint ${addConstraint[2]} already present`;
  }

  // MySQL names these automatically, so identity is the column they sit on.
  // Without this check a re-run stacks a second identical constraint.
  const foreignKey = statement.match(/^ALTER TABLE (\w+)\s+ADD FOREIGN KEY \((\w+)\)/i);
  if (foreignKey) {
    const [rows] = await db.query(
      `SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1`,
      [CONFIG.database, foreignKey[1], foreignKey[2]],
    );
    if (rows.length) return `foreign key on ${foreignKey[1]}.${foreignKey[2]} already present`;
  }

  const index = statement.match(/^CREATE (?:UNIQUE )?INDEX (\w+)\s+ON (\w+)/i);
  if (index && (await indexExists(db, index[2], index[1]))) {
    return `index ${index[1]} already present`;
  }

  return null;
}

// MariaDB has never supported indexing an expression - it offers generated
// columns instead - so the three LOWER() indexes the translation produces are
// rejected outright there. They are an optimisation for case-insensitive email
// and username lookups, not a correctness requirement, so the schema is applied
// without them rather than failing the release. They are reported separately
// from ordinary skips because losing an index quietly is how a fast login
// becomes a slow one months later with nothing to point at.
function unsupportedReason(statement) {
  if (!isMariaDb) return null;

  // The expression is not always the first key part, so the whole key list is
  // examined rather than just its start.
  const index = statement.match(/^CREATE (UNIQUE )?INDEX (\w+)\s+ON \w+\s*\(([\s\S]*)\)\s*$/i);
  if (index && index[3].includes("(")) {
    // A UNIQUE index is a rule the data obeys, not an optimisation. Skipping one
    // would quietly permit duplicates, so it is left to fail loudly instead -
    // translate-schema.js has an EXPRESSION_INDEXES entry for materialising it
    // into generated columns, which is where a new one should be handled.
    if (index[1]) return null;
    return `${index[2]} indexes an expression, which MariaDB cannot do`;
  }

  return null;
}

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
  const statements = splitStatements(sql);
  const db = await mysql.createConnection(CONFIG);

  const [versionRows] = await db.query("SELECT VERSION() AS version");
  const version = String(versionRows[0].version);
  isMariaDb = /mariadb/i.test(version);

  let applied = 0;
  let skipped = 0;
  let failures = [];
  const unsupported = [];

  // schema.sql carries ALTERs from later migrations near the top - the
  // audit_logs one sits 950 lines above the CREATE TABLE it depends on - so a
  // statement can fail on the first pass purely because its table does not
  // exist yet. Retrying what failed, after everything else has been created,
  // resolves that without reordering a file that is generated. Passes stop as
  // soon as one fixes nothing, so a genuine error still surfaces.
  let pending = statements;
  while (pending.length) {
    const retry = [];
    for (const statement of pending) {
      const unsupportedBy = unsupportedReason(statement);
      if (unsupportedBy) {
        unsupported.push(unsupportedBy);
        continue;
      }
      const skip = await reasonToSkip(db, statement);
      if (skip) {
        skipped += 1;
        continue;
      }
      try {
        await db.query(statement);
        applied += 1;
      } catch (error) {
        retry.push({ statement, message: error.message });
      }
    }

    if (retry.length === pending.length) {
      failures = retry.map((item) => ({
        statement: item.statement.replace(/\s+/g, " ").slice(0, 120),
        message: item.message,
      }));
      break;
    }
    failures = [];
    pending = retry.map((item) => item.statement);
  }

  await db.end();

  console.log(`database : ${CONFIG.database} @ ${CONFIG.host}:${CONFIG.port}`);
  console.log(`server   : ${version}`);
  console.log(`applied  : ${applied}`);
  console.log(`skipped  : ${skipped} (already present)`);
  console.log(`failed   : ${failures.length}`);
  for (const failure of failures) {
    console.log(`\n  ! ${failure.message}\n    ${failure.statement}`);
  }
  if (unsupported.length) {
    console.log(`\nnot created on this server (${unsupported.length}):`);
    for (const reason of unsupported) console.log(`  - ${reason}`);
    console.log("  Lookups still work; they scan instead of using an index.");
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
