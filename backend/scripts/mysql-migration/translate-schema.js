#!/usr/bin/env node
/**
 * Translates the PostgreSQL schema into MySQL 8 DDL.
 *
 * Two thirds of the source file is row level security. Those policies only
 * ever guarded Supabase's PostgREST endpoint - the application connects as a
 * BYPASSRLS role and does its own authorisation - so they are dropped rather
 * than emulated. MySQL has no equivalent and losing them costs nothing that
 * was protecting the API.
 *
 * Emits schema.mysql.sql. Idempotency (IF NOT EXISTS on indexes and columns,
 * which MySQL does not support) is handled by apply-schema.js, not here, so
 * the generated SQL stays readable.
 */
const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "../../src/database/schema.sql");
const TARGET = path.join(__dirname, "schema.mysql.sql");

// --- statement splitting -----------------------------------------------
// Dollar-quoted function bodies contain semicolons, so a naive split breaks.
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;
  let inLineComment = false;
  let inString = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const rest = sql.slice(i, i + 2);

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (!inString && !inDollar && rest === "--") {
      inLineComment = true;
      current += char;
      continue;
    }
    if (!inString && rest === "$$") {
      inDollar = !inDollar;
      current += rest;
      i += 1;
      continue;
    }
    if (!inDollar && char === "'") {
      // '' is an escaped quote inside a string literal
      if (inString && sql[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
    }
    if (char === ";" && !inDollar && !inString) {
      statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(Boolean);
}

// --- what disappears ----------------------------------------------------
const DROPPED = [
  { test: /^DROP POLICY/i, reason: "row level security" },
  { test: /^CREATE POLICY/i, reason: "row level security" },
  { test: /ENABLE ROW LEVEL SECURITY/i, reason: "row level security" },
  { test: /^CREATE OR REPLACE FUNCTION public\.educlub_/i, reason: "RLS helper function" },
];

// --- type and expression rewrites ---------------------------------------
function translateTypes(sql) {
  return (
    sql
      // MySQL's own SERIAL means BIGINT UNSIGNED, which would not match the
      // INTEGER foreign keys that point at these primary keys.
      .replace(/\bBIGSERIAL\b/gi, "BIGINT AUTO_INCREMENT")
      .replace(/\bSERIAL\b/gi, "INT AUTO_INCREMENT")
      .replace(/\bJSONB\b/gi, "JSON")
      .replace(/\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b/gi, "DATETIME")
      .replace(/\bTIMESTAMPTZ\b/gi, "DATETIME")
      // DATETIME rather than MySQL TIMESTAMP: no 2038 ceiling, and no implicit
      // ON UPDATE CURRENT_TIMESTAMP on the first such column, which would
      // silently overwrite the updated_at values the app sets itself.
      .replace(/\bTIMESTAMP\b/gi, "DATETIME")
      .replace(/\bNUMERIC\s*\(/gi, "DECIMAL(")
      .replace(/\bINTEGER\b/gi, "INT")
      .replace(/\bBOOLEAN\b/gi, "TINYINT(1)")
      // No MySQL address type. 45 characters is the longest possible textual
      // IPv6, including the IPv4-mapped form the app can store from req.ip.
      .replace(/\bINET\b/gi, "VARCHAR(45)")
      // No MySQL UUID type. The application generates canonical 36-character
      // UUID strings, so CHAR(36) stores them exactly.
      .replace(/\bUUID\b/gi, "CHAR(36)")
  );
}

// Anything not on this list is a type MySQL will reject or, worse, silently
// reinterpret. Better to stop the build than to discover it in the data load.
const MYSQL_TYPES =
  /^(INT|BIGINT|SMALLINT|TINYINT|DECIMAL|DOUBLE|FLOAT|VARCHAR|CHAR|TEXT|LONGTEXT|MEDIUMTEXT|JSON|DATE|DATETIME|TIME|YEAR|BLOB)\b/i;

function assertTypesAreMysql(statements) {
  const unmapped = new Map();

  for (const statement of statements) {
    const table = statement.match(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*)\)$/);
    if (!table) continue;

    for (const line of table[2].split("\n")) {
      const column = line.match(/^\s{2}(\w+)\s+([A-Za-z][A-Za-z0-9_ ]*(\([^)]*\))?)/);
      if (!column) continue;
      if (/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)$/i.test(column[1])) continue;

      const type = column[2]
        .trim()
        .split(/\s+(?:NOT|NULL|DEFAULT|REFERENCES|UNIQUE|PRIMARY|CHECK|GENERATED)/)[0];
      if (!MYSQL_TYPES.test(type)) {
        unmapped.set(type, `${table[1]}.${column[1]}`);
      }
    }
  }

  if (unmapped.size) {
    const detail = [...unmapped].map(([type, where]) => `${type} (${where})`).join(", ");
    throw new Error(`Unmapped column type(s) for MySQL: ${detail}. Add a rule to translateTypes().`);
  }
}

function translateJsonDefaults(sql) {
  // MySQL requires a JSON default to be a parenthesised expression.
  return sql.replace(/DEFAULT\s+('(?:[^']|'')*')::jsonb/gi, "DEFAULT ($1)");
}

function stripCasts(sql) {
  return sql.replace(/::[a-z_]+(\[\])?/gi, "");
}

// Sourced from information_schema.KEYWORDS on MySQL 8.4. PostgreSQL accepts
// several of these as bare identifiers where MySQL will not - system_settings
// has a column called "key", competition_results one called "rank".
const RESERVED = new Set(require("./mysql-reserved-words.json"));

function quoteIdentifierList(list) {
  return list
    .split(",")
    .map((entry) => {
      const name = entry.trim();
      return RESERVED.has(name.toUpperCase()) ? entry.replace(name, `\`${name}\``) : entry;
    })
    .join(",");
}

// Quoting has to be surgical. A reserved word is only an identifier in three
// places; everywhere else it is doing its job as a keyword - ON, AND, and the
// literal TRUE all matched an earlier, looser version of this and broke the
// statements they appeared in.
function quoteReservedColumns(sql) {
  return (
    sql
      // 1. Column definitions: two-space indent, a name, then a MySQL type.
      .replace(
        new RegExp(`^(\\s{2})(\\w+)(\\s+)(?=${MYSQL_TYPES.source.slice(1)})`, "gim"),
        (match, indent, name, space) =>
          RESERVED.has(name.toUpperCase()) ? `${indent}\`${name}\`${space}` : match,
      )
      // 2. The column list of an INSERT.
      .replace(
        /(INSERT INTO\s+\w+\s*\()([^)]*)(\))/i,
        (match, head, columns, tail) => head + quoteIdentifierList(columns) + tail,
      )
      // 3. The column list of an index.
      .replace(
        /(CREATE (?:UNIQUE )?INDEX\s+\w+\s+ON\s+\w+\s*\()([^)]*)(\))/i,
        (match, head, columns, tail) => head + quoteIdentifierList(columns) + tail,
      )
  );
}

// InnoDB parses a column-level REFERENCES clause and then silently ignores it.
// Left alone, all 126 foreign keys - and every ON DELETE CASCADE the app leans
// on to clean up child rows - would simply not exist, with no error to show for
// it. Only a table-level FOREIGN KEY clause creates a real constraint.
function hoistForeignKeys(sql) {
  const table = sql.match(/^(CREATE TABLE IF NOT EXISTS \w+ \()([\s\S]*)(\n\))$/);
  if (!table) return sql;

  const reference = /\s*REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)((?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT))*)/i;
  const constraints = [];

  const body = table[2]
    .split("\n")
    .map((line) => {
      const match = line.match(reference);
      if (!match) return line;

      const column = (line.match(/^\s{2}(\w+)\s/) || [])[1];
      if (!column) return line;

      const [, target, targetColumn, actions] = match;
      constraints.push(
        `  FOREIGN KEY (${column}) REFERENCES ${target}(${targetColumn})${actions.replace(/\s+/g, " ").replace(/^ /, " ")}`,
      );
      // Keep the rest of the column definition intact - NOT NULL, UNIQUE and
      // DEFAULT can sit on either side of the REFERENCES clause.
      return line.replace(reference, "");
    })
    .join("\n");

  if (!constraints.length) return sql;

  const separator = body.trimEnd().endsWith(",") ? "" : ",";
  return `${table[1]}${body.trimEnd()}${separator}\n${constraints.join(",\n")}${table[3]}`;
}

const { translateJsonPaths } = require("./jsonPaths");

function translateArrays(sql) {
  // PostgreSQL arrays have no MySQL column type; the app already stores and
  // reads these as lists, so JSON is the faithful shape.
  return sql.replace(/\b(TEXT|VARCHAR\(\d+\)|INT|INTEGER)\s*\[\]/gi, "JSON");
}

const { translateFilterClause } = require("../../src/config/filterClause");

function translateUpdateFrom(sql) {
  // PostgreSQL: UPDATE t alias SET ... FROM other o WHERE ...
  // MySQL:      UPDATE t alias JOIN other o SET ... WHERE ...
  const match = sql.match(
    /^UPDATE\s+(\w+)\s+(\w+)\s+SET\s+([\s\S]+?)\s+FROM\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)$/i,
  );
  if (!match) return sql;
  const [, table, alias, assignments, from, where] = match;
  return `UPDATE ${table} ${alias}\n  JOIN ${from.trim()}\n  SET ${assignments.trim()}\n  WHERE ${where.trim()}`;
}

// MySQL has no partial indexes. Dropping the predicate from a NON-unique index
// costs index size only. Dropping it from a UNIQUE index changes what the
// database enforces, so each one needs a deliberate decision recorded here.
const UNIQUE_PARTIAL_RULES = [
  {
    name: "idx_terms_one_active_per_type",
    // UNIQUE(term_type) would allow only one term per type ever - no Term 1 in
    // both 2024 and 2025. Emulated with a stored generated column that is NULL
    // for inactive terms: MySQL permits repeated NULLs in a unique index, so
    // exactly one active term per type survives.
    // The trailing semicolon on the ALTER is deliberate: main() appends one
    // terminator per emitted statement, and this rule emits two.
    replacement: [
      "ALTER TABLE terms",
      "  ADD COLUMN active_term_type VARCHAR(50)",
      "    GENERATED ALWAYS AS (IF(is_active = 1, term_type, NULL)) STORED;",
      "",
      "CREATE UNIQUE INDEX idx_terms_one_active_per_type ON terms(active_term_type)",
    ].join("\n"),
  },
  {
    name: "idx_courses_school_code",
    // Predicate was WHERE code IS NOT NULL. A MySQL unique index already treats
    // NULLs as distinct, so a plain UNIQUE(school_id, code) enforces the same
    // rule. Safe to drop.
    dropPredicate: true,
  },
  {
    name: "idx_course_templates_code",
    // Same reasoning as idx_courses_school_code.
    dropPredicate: true,
  },
];

const { parenthesiseExpressions } = require("./indexExpressions");

function translateIndex(sql) {
  let out = sql.replace(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/i, "CREATE $1INDEX");

  // GIN indexes have no MySQL equivalent. This one covered competitions
  // .eligible_grades, which no query filters in SQL - grade eligibility is
  // decided in JavaScript by gradeAllowed() - so nothing depends on it.
  if (/USING\s+GIN/i.test(out)) {
    const name = (out.match(/CREATE (?:UNIQUE )?INDEX (\w+)/i) || [])[1];
    return `-- dropped ${name}: GIN index, unused (eligible_grades is filtered in application code)`;
  }

  const partial = /\sWHERE\s+[\s\S]+$/i;
  if (!partial.test(out)) {
    return parenthesiseExpressions(out);
  }

  const predicate = out.match(partial)[0].replace(/\s+/g, " ").trim();
  const isUnique = /CREATE UNIQUE INDEX/i.test(out);
  const name = (out.match(/CREATE (?:UNIQUE )?INDEX (\w+)/i) || [])[1];

  if (isUnique) {
    const rule = UNIQUE_PARTIAL_RULES.find((r) => r.name === name);
    if (!rule) {
      // Refusing here is the point: a unique partial index silently widened
      // into a plain unique index changes what the database enforces.
      throw new Error(
        `No rule for unique partial index ${name} (${predicate}). ` +
          "Decide explicitly whether the predicate can be dropped, then add it " +
          "to UNIQUE_PARTIAL_RULES.",
      );
    }
    if (rule.replacement) return rule.replacement;
  }

  out = out.replace(partial, "");
  out = parenthesiseExpressions(out);
  out += ` /* predicate dropped: ${predicate} */`;
  return out;
}

function translateAlter(sql) {
  let out = sql.replace(/ALTER TABLE IF EXISTS/i, "ALTER TABLE");
  out = out.replace(/ADD COLUMN IF NOT EXISTS/i, "ADD COLUMN");
  // A named CHECK is dropped with DROP CHECK in MySQL, not DROP CONSTRAINT.
  out = out.replace(/DROP CONSTRAINT IF EXISTS (\w+)/i, "DROP CHECK $1");

  // ADD COLUMN ignores an inline REFERENCES for exactly the same reason
  // CREATE TABLE does. Two of these columns exist only here and nowhere in a
  // CREATE TABLE, so without splitting the clause out they end up with no
  // foreign key at all.
  const inline = out.match(
    /^(ALTER TABLE (\w+)\s+ADD COLUMN (\w+)[\s\S]*?)\s*REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)((?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT))*)\s*$/i,
  );
  if (inline) {
    const [, columnClause, table, column, target, targetColumn, actions] = inline;
    return [
      `${columnClause.trimEnd()};`,
      "",
      `ALTER TABLE ${table}`,
      `  ADD FOREIGN KEY (${column}) REFERENCES ${target}(${targetColumn})${actions.replace(/\s+/g, " ").replace(/^ /, " ")}`,
    ].join("\n");
  }

  return out;
}

function translateUpsert(sql) {
  // ON CONFLICT (cols) DO UPDATE SET a = EXCLUDED.a  ->  ON DUPLICATE KEY UPDATE
  const match = sql.match(/ON CONFLICT\s*\([^)]*\)\s*DO UPDATE\s+SET\s+([\s\S]+)$/i);
  if (!match) {
    return sql.replace(
      /ON CONFLICT\s*\((\w+)[^)]*\)\s*DO NOTHING/i,
      // A self-assignment is the MySQL idiom for "leave the existing row
      // alone"; it has to name a real column of this table, not always id.
      (match, column) => `ON DUPLICATE KEY UPDATE \`${column}\` = \`${column}\``,
    );
  }
  const assignments = match[1].replace(/\bEXCLUDED\.(\w+)/gi, "VALUES($1)");
  return sql.slice(0, match.index) + "ON DUPLICATE KEY UPDATE " + assignments;
}

function translate(statement) {
  let out = statement;
  if (/^CREATE (UNIQUE )?INDEX/i.test(out)) out = translateIndex(out);
  if (/^ALTER TABLE/i.test(out)) out = translateAlter(out);
  if (/ON CONFLICT/i.test(out)) out = translateUpsert(out);
  if (/^UPDATE\s/i.test(out)) out = translateUpdateFrom(out);
  out = translateFilterClause(out);
  out = translateJsonPaths(out);
  out = translateJsonDefaults(out);
  out = translateArrays(out);
  out = translateTypes(out);
  out = stripCasts(out);
  if (/^(CREATE TABLE|CREATE (UNIQUE )?INDEX|INSERT INTO)/i.test(out)) {
    out = quoteReservedColumns(out);
  }
  if (/^CREATE TABLE/i.test(out)) out = hoistForeignKeys(out);
  return out;
}

function main() {
  const source = fs.readFileSync(SOURCE, "utf8");
  const statements = splitStatements(source);

  const kept = [];
  const dropped = new Map();

  for (const statement of statements) {
    const bare = statement.replace(/^(--[^\n]*\n)+/, "").trim();
    if (!bare) continue;

    const rule = DROPPED.find((r) => r.test.test(bare));
    if (rule) {
      dropped.set(rule.reason, (dropped.get(rule.reason) || 0) + 1);
      continue;
    }
    kept.push(translate(bare) + ";");
  }

  assertTypesAreMysql(kept);

  const header = [
    "-- Generated by scripts/mysql-migration/translate-schema.js. Do not edit.",
    "-- Source: src/database/schema.sql",
    "--",
    "-- Row level security is intentionally absent: those policies guarded the",
    "-- Supabase REST endpoint only, and the application already authorises every",
    "-- request itself. MySQL has no equivalent and none is needed.",
    "",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
  ].join("\n");

  fs.writeFileSync(TARGET, header + kept.join("\n\n") + "\n\nSET FOREIGN_KEY_CHECKS = 1;\n");

  console.log(`statements in source : ${statements.length}`);
  for (const [reason, count] of dropped) console.log(`  dropped (${reason}): ${count}`);
  console.log(`statements emitted   : ${kept.length}`);
  console.log(`written              : ${path.relative(process.cwd(), TARGET)}`);
}

main();
