const test = require("node:test");
const assert = require("node:assert/strict");

const { translateFilterClause } = require("../src/config/filterClause");
const { translateJsonPaths } = require("../src/config/jsonPaths");
const { parenthesiseExpressions } = require("../scripts/mysql-migration/indexExpressions");

test("FILTER becomes a CASE the aggregate can skip", () => {
  assert.equal(
    translateFilterClause("COUNT(la.id) FILTER (WHERE la.is_published = true)"),
    "COUNT(CASE WHEN la.is_published = true THEN la.id END)",
  );
  // COUNT(*) has no expression to carry through, so it counts a constant.
  assert.equal(
    translateFilterClause("COUNT(*) FILTER (WHERE x > 1)"),
    "COUNT(CASE WHEN x > 1 THEN 1 END)",
  );
});

test("a FILTER condition may contain its own parentheses", () => {
  // A regex that stops at the first ")" truncates this and leaves "= 'required'"
  // dangling outside the CASE, which is why this is scanned rather than matched.
  assert.equal(
    translateFilterClause(
      "COUNT(la.id) FILTER (WHERE COALESCE(la.mode, 'required') = 'required' AND la.ok = true)",
    ),
    "COUNT(CASE WHEN COALESCE(la.mode, 'required') = 'required' AND la.ok = true THEN la.id END)",
  );
});

test("several FILTER clauses in one expression are all rewritten", () => {
  assert.equal(
    translateFilterClause("SUM(a) FILTER (WHERE t = 'it''s') + COUNT(b) FILTER (WHERE u IS NULL)"),
    "SUM(CASE WHEN t = 'it''s' THEN a END) + COUNT(CASE WHEN u IS NULL THEN b END)",
  );
});

test("SQL without FILTER is left exactly as it was", () => {
  const sql = "SELECT COUNT(id) AS plain FROM t WHERE x = (SELECT MAX(y) FROM u)";
  assert.equal(translateFilterClause(sql), sql);
});

test("chained JSON key lookups collapse into one path, as a function call", () => {
  // MySQL would accept the -> and ->> operators, but MariaDB implements
  // neither, so the functions both engines share are emitted instead.
  assert.equal(
    translateJsonPaths("la.content->'module_badge'->>'name'"),
    "JSON_UNQUOTE(JSON_EXTRACT(la.content, '$.module_badge.name'))",
  );
  assert.equal(
    translateJsonPaths("content->>'name'"),
    "JSON_UNQUOTE(JSON_EXTRACT(content, '$.name'))",
  );
  // The final operator decides the result type and must survive: -> stays JSON.
  assert.equal(translateJsonPaths("a.b->'x'->'y'"), "JSON_EXTRACT(a.b, '$.x.y')");
});

test("a path already in MySQL form still becomes a function call", () => {
  // It is the operator MariaDB cannot parse, not the path, so this one is
  // rewritten too rather than passed through.
  assert.equal(
    translateJsonPaths("content->>'$.already'"),
    "JSON_UNQUOTE(JSON_EXTRACT(content, '$.already'))",
  );
});

test("index expressions get the parentheses MySQL requires", () => {
  assert.equal(
    parenthesiseExpressions("CREATE INDEX i ON users(LOWER(email))"),
    "CREATE INDEX i ON users((LOWER(email)))",
  );
  // certificates indexes two expressions; each needs its own wrapping.
  assert.equal(
    parenthesiseExpressions("ON certificates(learner_id, COALESCE(term, ''), COALESCE(year, ''))"),
    "ON certificates(learner_id, (COALESCE(term, '')), (COALESCE(year, '')))",
  );
});

test("a plain column index is untouched", () => {
  const sql = "CREATE INDEX i ON users(email, school_id)";
  assert.equal(parenthesiseExpressions(sql), sql);
});

const { translate } = require("../src/config/sqlDialect");

test("= ANY(array) becomes IN, which mysql2 expands from a JS array", () => {
  // MySQL has no array type, so ANY() has no meaning; IN (?) is the equivalent.
  assert.equal(translate("WHERE id = ANY($1::integer[])", [[1, 2]]).sql, "WHERE id IN (?)");
  assert.equal(translate("WHERE id <> ANY($1)", [[1]]).sql, "WHERE id NOT IN (?)");
});

test("an empty array binds as IN (NULL) rather than the syntax error IN ()", () => {
  // PostgreSQL's `= ANY('{}')` matches no rows; IN (NULL) is how MySQL says that.
  const { params } = translate("WHERE id = ANY($1)", [[]]);
  assert.deepEqual(params, [[null]]);
});

test("interval literals are rewritten to MySQL's keyword form", () => {
  assert.equal(
    translate("WHERE created_at >= NOW() - INTERVAL '1 hour'", []).sql,
    "WHERE created_at >= NOW() - INTERVAL 1 HOUR",
  );
  // The plural spelling PostgreSQL accepts has to be singularised.
  assert.equal(translate("NOW() - INTERVAL '5 seconds'", []).sql, "NOW() - INTERVAL 5 SECOND");
});

test("NULLS LAST only adds a sort key where MySQL's own ordering differs", () => {
  // MySQL sorts NULLs last on DESC already, so that combination is left alone.
  assert.equal(translate("ORDER BY score DESC NULLS LAST", []).sql, "ORDER BY score DESC");
  // Ascending puts NULLs first, so this one needs the extra key.
  assert.equal(
    translate("ORDER BY score ASC NULLS LAST", []).sql,
    "ORDER BY score IS NULL, score ASC",
  );
});

test("ILIKE forces a case-insensitive collation, since the database is case-sensitive", () => {
  // A plain LIKE here would be case-SENSITIVE and silently stop matching.
  const { CASE_INSENSITIVE } = require("../src/config/sqlDialect");
  assert.match(
    translate("WHERE name ILIKE $1", ["a%"]).sql,
    new RegExp(`COLLATE ${CASE_INSENSITIVE} LIKE`),
  );
});

test("the case-insensitive collation exists on MariaDB as well as MySQL", () => {
  // cPanel runs MariaDB, which has no utf8mb4_0900_ai_ci - naming it here would
  // make every ILIKE query fail on the production server while passing locally.
  const { CASE_INSENSITIVE } = require("../src/config/sqlDialect");
  assert.doesNotMatch(
    CASE_INSENSITIVE,
    /_0900_/,
    "the _0900_ collation family is MySQL 8 only",
  );
});

test("ON CONFLICT becomes ON DUPLICATE KEY UPDATE with VALUES()", () => {
  assert.equal(
    translate("INSERT INTO t (a,b) VALUES ($1,$2) ON CONFLICT (a) DO UPDATE SET b = EXCLUDED.b", [1, 2]).sql,
    "INSERT INTO t (a,b) VALUES (?,?) ON DUPLICATE KEY UPDATE b = VALUES(b)",
  );
  // DO NOTHING has to name a real column of the table, not always id.
  assert.equal(
    translate("INSERT INTO t (code) VALUES ($1) ON CONFLICT (code) DO NOTHING", [1]).sql,
    "INSERT INTO t (code) VALUES (?) ON DUPLICATE KEY UPDATE `code` = `code`",
  );
});

test("PostgreSQL JSON operators become functions MariaDB understands", () => {
  // MariaDB implements no -> or ->> operator at all; its JSON support is
  // function-based, and its parser rejects the operator outright. These two
  // shapes are what the services actually write.
  assert.equal(
    translate("SELECT NULLIF(pc.progress_data->>'completion_percent', '') FROM x", []).sql,
    "SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pc.progress_data, '$.completion_percent')), '') FROM x",
  );
  assert.equal(
    translate("SELECT MAX(la.content->'module_badge'->>'name') FROM y", []).sql,
    "SELECT MAX(JSON_UNQUOTE(JSON_EXTRACT(la.content, '$.module_badge.name'))) FROM y",
  );
});

test("-> keeps JSON, ->> unquotes to text", () => {
  // The final operator decides the result type, so the chain has to keep it.
  assert.equal(
    translate("SELECT c.content->'meta' FROM z", []).sql,
    "SELECT JSON_EXTRACT(c.content, '$.meta') FROM z",
  );
});

test("no query reaches the driver still carrying a JSON operator", () => {
  for (const sql of [
    "SELECT a->>'b' FROM t",
    "SELECT a->'b'->>'c' FROM t",
    "SELECT a->>'$.b.c' FROM t",
  ]) {
    assert.doesNotMatch(translate(sql, []).sql, /->>?/, `left an operator in: ${sql}`);
  }
});

// --------------------------------------------------- MySQL-8-only constructs

const fs = require("node:fs");
const path = require("node:path");

/**
 * Production runs MariaDB; development commonly runs MySQL 8. SQL that only
 * MySQL 8 accepts therefore passes every local check and fails in production
 * only, which is how `CAST(? AS JSON)` reached live and broke the course
 * learning overview: MariaDB has no JSON cast target and rejects the statement
 * with a parse error.
 */
const MYSQL8_ONLY = [
  [/\bCAST\s*\([^)]*\bAS\s+JSON\s*\)/i, "CAST(... AS JSON) - MariaDB has no JSON cast target"],
  [/\bJSON_TABLE\s*\(/i, "JSON_TABLE() - MySQL 8 only"],
  [/\bJSON_OVERLAPS\s*\(/i, "JSON_OVERLAPS() - MySQL 8 only"],
  [/\bJSON_SCHEMA_VALID\s*\(/i, "JSON_SCHEMA_VALID() - MySQL 8 only"],
  [/\bLATERAL\s+\(/i, "LATERAL - MySQL 8.0.14+, not in MariaDB"],
];

function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (entry.name.endsWith(".js")) found.push(full);
  }
  return found;
}

test("no application SQL uses syntax MariaDB cannot parse", () => {
  const root = path.join(__dirname, "..", "src");
  const offenders = [];

  for (const file of sourceFiles(root)) {
    const code = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");

    for (const [pattern, description] of MYSQL8_ONLY) {
      if (pattern.test(code)) {
        offenders.push(`${path.relative(root, file)}: ${description}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These parse on MySQL 8 and fail on the MariaDB in production:\n${offenders.join("\n")}`,
  );
});

test("a learner id is matched against a JSON array without casting", () => {
  const courses = fs.readFileSync(
    path.join(__dirname, "..", "src/services/courses.service.js"),
    "utf8",
  );

  // The needle goes in as JSON text. A bare number is valid JSON, so this
  // satisfies JSON_CONTAINS on both engines without a cast.
  assert.match(courses, /JSON_CONTAINS\(COALESCE\(o\.target_learner_ids, JSON_ARRAY\(\)\), \$\d+\)/);
  assert.match(courses, /String\(Number\(learner\.id\)\)/);
});
