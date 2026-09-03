const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Schema belongs to the migration, which translates PostgreSQL into the dialect
 * MariaDB accepts. Anything that issues DDL from a request path bypasses that
 * translation and runs raw PostgreSQL against production.
 *
 * This is not hypothetical: report_feedback used to be re-created on every
 * report read, and "CREATE INDEX IF NOT EXISTS" - which MariaDB has never
 * supported - made generating a learner report fail outright in production.
 */
const REQUEST_PATH_DIRECTORIES = ["src/services", "src/controllers"];

// The migration runner and the dialect layer legitimately contain schema SQL.
const ALLOWED = new Set(["src/services/startupSchema.service.js"]);

const POSTGRES_ONLY = [
  [/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i, "CREATE INDEX IF NOT EXISTS (MariaDB has no such form)"],
  [/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i, "row level security (PostgreSQL only)"],
  [/CREATE\s+POLICY/i, "CREATE POLICY (PostgreSQL only)"],
  [/\bpg_policies\b|\bpg_catalog\b|to_regclass/i, "PostgreSQL catalog access"],
  [/DO\s+\$\$/i, "DO $$ block (PostgreSQL only)"],
];

function sourceFiles(directory) {
  const root = path.join(__dirname, "..", directory);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".js"))
    .map((name) => `${directory}/${name}`);
}

// Comments describe the problem; only executable lines are checked.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

test("no service or controller issues PostgreSQL-only DDL on a request path", () => {
  const offenders = [];

  for (const directory of REQUEST_PATH_DIRECTORIES) {
    for (const file of sourceFiles(directory)) {
      if (ALLOWED.has(file)) continue;
      const code = withoutComments(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));

      for (const [pattern, description] of POSTGRES_ONLY) {
        if (pattern.test(code)) offenders.push(`${file}: ${description}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These run raw PostgreSQL against production MariaDB. Move the schema into schema.sql:\n${offenders.join("\n")}`,
  );
});

test("report feedback reads no longer create their own table", () => {
  const reports = fs.readFileSync(
    path.join(__dirname, "..", "src/services/reports.service.js"),
    "utf8",
  );

  assert.doesNotMatch(reports, /await ensureReportFeedbackTable\(\)/);
  // The table is still expected to exist - it is defined in schema.sql.
  const schema = fs.readFileSync(
    path.join(__dirname, "..", "src/database/schema.sql"),
    "utf8",
  );
  assert.match(schema, /CREATE TABLE IF NOT EXISTS report_feedback \(/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_report_feedback_period/);
});
