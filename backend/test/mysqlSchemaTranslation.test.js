const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TRANSLATOR = path.join(__dirname, "../scripts/mysql-migration/translate-schema.js");
const OUTPUT = path.join(__dirname, "../scripts/mysql-migration/schema.mysql.sql");

function generate() {
  execFileSync(process.execPath, [TRANSLATOR], { stdio: "pipe" });
  return fs.readFileSync(OUTPUT, "utf8");
}

// The generated file explains in prose what was left out, so assertions about
// what the database will execute have to ignore comments.
function executableSql() {
  return generate()
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

test("row level security does not survive into the MySQL schema", () => {
  const sql = executableSql();

  // These guarded Supabase's REST endpoint, never the API, which connects as a
  // BYPASSRLS role. MySQL has no equivalent and none is needed.
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /ROW LEVEL SECURITY/i);
  assert.doesNotMatch(sql, /current_setting|set_config|educlub_role/i);
});

test("no PostgreSQL-only syntax reaches the MySQL schema", () => {
  const sql = executableSql();

  assert.doesNotMatch(sql, /\bJSONB\b/i);
  assert.doesNotMatch(sql, /::[a-z]/i, "type casts must be stripped");
  assert.doesNotMatch(sql, /ON CONFLICT|EXCLUDED\./i);
  // MySQL's own SERIAL is BIGINT UNSIGNED and would not match the INT foreign
  // keys pointing at these primary keys.
  assert.doesNotMatch(sql, /\bSERIAL\b/i);
  assert.match(sql, /id INT AUTO_INCREMENT PRIMARY KEY/);
});

test("MySQL cannot index TEXT without a prefix, so none may be indexed", () => {
  const sql = generate();
  const textColumns = new Map();

  for (const table of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)) {
    const columns = [...table[2].matchAll(/^\s{2}(\w+) +TEXT/gm)].map((m) => m[1]);
    if (columns.length) textColumns.set(table[1], columns);
  }

  for (const index of sql.matchAll(/CREATE (?:UNIQUE )?INDEX[^;]*? ON (\w+)\s*\(([^)]*)\)/g)) {
    const indexed = index[2].split(",").map((c) => c.trim());
    const text = textColumns.get(index[1]) || [];
    const clash = indexed.filter((c) => text.includes(c));
    assert.deepEqual(clash, [], `${index[1]} indexes TEXT column(s) ${clash.join(", ")}`);
  }
});

test("the one unique partial index that changes meaning is emulated", () => {
  const sql = generate();

  // A plain UNIQUE(term_type) would permit only one term per type ever - no
  // Term 1 in both 2024 and 2025. The generated column is NULL for inactive
  // terms, and MySQL allows repeated NULLs in a unique index.
  assert.match(sql, /GENERATED ALWAYS AS \(IF\(is_active = 1, term_type, NULL\)\) STORED/);
  assert.match(sql, /CREATE UNIQUE INDEX idx_terms_one_active_per_type ON terms\(active_term_type\)/);
  assert.doesNotMatch(sql, /CREATE UNIQUE INDEX idx_terms_one_active_per_type ON terms\(term_type\)/);
});

test("an unknown unique partial index stops the build instead of silently widening", () => {
  const schemaPath = path.join(__dirname, "../src/database/schema.sql");
  const original = fs.readFileSync(schemaPath, "utf8");

  try {
    fs.writeFileSync(
      schemaPath,
      `${original}\nCREATE UNIQUE INDEX IF NOT EXISTS idx_guard_probe ON schools(code) WHERE is_active = true;\n`,
    );
    assert.throws(
      () => execFileSync(process.execPath, [TRANSLATOR], { stdio: "pipe" }),
      /idx_guard_probe/,
    );
  } finally {
    fs.writeFileSync(schemaPath, original);
  }
});

test("every table in the source schema reaches the MySQL schema", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/database/schema.sql"), "utf8");
  const sql = generate();

  const names = (text) =>
    [...text.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]).sort();

  assert.deepEqual(names(sql), names(source));
});
