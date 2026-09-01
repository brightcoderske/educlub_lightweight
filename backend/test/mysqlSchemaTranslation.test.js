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

// The generated schema is what actually runs on the server, so these assert the
// MariaDB incompatibilities that got through the first apply attempt.
const GENERATED = require("node:fs").readFileSync(
  require("node:path").join(__dirname, "../scripts/mysql-migration/schema.mysql.sql"),
  "utf8",
);

test("the schema carries no JSON operator MariaDB cannot parse", () => {
  assert.doesNotMatch(GENERATED, /->>?\s*'/, "MariaDB implements neither -> nor ->>");
});

test("no CHECK is attached to a column definition", () => {
  // MariaDB allows CONSTRAINT only on a table-level element; a named CHECK
  // written against a column rejects the whole CREATE TABLE.
  assert.doesNotMatch(
    GENERATED,
    /[^,(\s][ \t]*\r?\n\s*CONSTRAINT\s+\w+\s*\r?\n?\s*CHECK\s*\(/,
    "a named CHECK must be its own table-level element",
  );
});

test("no UNIQUE index is left indexing an expression", () => {
  // MariaDB cannot index an expression, and apply-schema.js refuses to skip a
  // UNIQUE one, so any left here would fail the release rather than quietly
  // dropping a rule the data depends on.
  // Normalised the way apply-schema.js does it, so this sees the statements the
  // server will actually be sent - block comments included, since a dropped
  // predicate is recorded as one after the key list.
  const unique = GENERATED.split(/;\s*$/m)
    .map((s) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*--[^\n]*$/gm, "")
        .trim(),
    )
    .filter((s) => /^CREATE UNIQUE INDEX/i.test(s));
  for (const statement of unique) {
    const keys = /ON \w+\s*\(([\s\S]*)\)\s*$/i.exec(statement);
    assert.ok(keys, `could not read the key list of: ${statement}`);
    assert.ok(
      !keys[1].includes("("),
      `${statement.split(/\s+/)[3]} indexes an expression and would be lost`,
    );
  }
});

test("the certificates award rule survives as generated columns", () => {
  // COALESCE(x, '') is how the PostgreSQL index made NULLs compare equal. The
  // uniqueness has to outlive the translation, or duplicate certificates become
  // possible with nothing to stop them.
  assert.match(GENERATED, /ADD COLUMN term_key VARCHAR\(50\) AS \(COALESCE\(term, ''\)\) PERSISTENT/);
  assert.match(GENERATED, /ADD COLUMN academic_year_key .* AS \(COALESCE\(CAST\(academic_year AS CHAR\), ''\)\) PERSISTENT/);
  assert.match(
    GENERATED,
    /CREATE UNIQUE INDEX idx_certificates_unique_award ON certificates\(learner_id, course_id, term_key, academic_year_key\)/,
  );
});
