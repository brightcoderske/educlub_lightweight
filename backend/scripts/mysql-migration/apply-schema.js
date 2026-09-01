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
const mysql = require("mysql2/promise");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const CONFIG = {
  host: arg("host", process.env.MYSQL_HOST || "127.0.0.1"),
  port: Number(arg("port", process.env.MYSQL_PORT || 3306)),
  user: arg("user", process.env.MYSQL_USER || "root"),
  password: arg("password", process.env.MYSQL_PASSWORD || ""),
  database: arg("database", process.env.MYSQL_DATABASE || "educlub"),
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

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
  const statements = splitStatements(sql);
  const db = await mysql.createConnection(CONFIG);

  let applied = 0;
  let skipped = 0;
  const failures = [];

  for (const statement of statements) {
    const skip = await reasonToSkip(db, statement);
    if (skip) {
      skipped += 1;
      continue;
    }
    try {
      await db.query(statement);
      applied += 1;
    } catch (error) {
      failures.push({ statement: statement.replace(/\s+/g, " ").slice(0, 120), message: error.message });
    }
  }

  await db.end();

  console.log(`database : ${CONFIG.database} @ ${CONFIG.host}:${CONFIG.port}`);
  console.log(`applied  : ${applied}`);
  console.log(`skipped  : ${skipped} (already present)`);
  console.log(`failed   : ${failures.length}`);
  for (const failure of failures) {
    console.log(`\n  ! ${failure.message}\n    ${failure.statement}`);
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
