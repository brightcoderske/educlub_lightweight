const test = require("node:test");
const assert = require("node:assert/strict");

const { planReturning, countPlaceholders, findTopLevel } = require("../src/config/returningEmulation");
const { translate } = require("../src/config/sqlDialect");

test("placeholders are renumbered, reused and reordered to match MySQL", () => {
  assert.deepEqual(translate("a = $1 AND b = $2", ["A", "B"]), {
    sql: "a = ? AND b = ?",
    params: ["A", "B"],
  });
  // Out of order: MySQL binds positionally, so the values must be resequenced.
  assert.deepEqual(translate("a = $2 AND b = $1", ["ONE", "TWO"]), {
    sql: "a = ? AND b = ?",
    params: ["TWO", "ONE"],
  });
  // Reused: the value has to be supplied once per occurrence.
  assert.deepEqual(translate("a = $1 AND b = $2 AND c = $1", ["X", "Y"]), {
    sql: "a = ? AND b = ? AND c = ?",
    params: ["X", "Y", "X"],
  });
});

test("casts are dropped but string literals are left alone", () => {
  assert.equal(translate("SELECT $1::integer, $2::varchar(50), $3::int[]", [1, 2, 3]).sql,
    "SELECT ?, ?, ?");
  // A literal that happens to contain $1 or :: is data, not syntax.
  const literal = translate("SELECT 'keep $1 and a::b' AS t, $1 AS v", ["V"]);
  assert.equal(literal.sql, "SELECT 'keep $1 and a::b' AS t, ? AS v");
  assert.deepEqual(literal.params, ["V"]);
});

test("a generated key is read back with LAST_INSERT_ID", () => {
  const plan = planReturning("INSERT INTO learners (school_id, full_name) VALUES (?, ?) RETURNING *", [7, "Ann"]);
  assert.equal(plan.kind, "insert");
  assert.deepEqual(plan.lookup, { byLastInsertId: true });
  assert.equal(plan.select, "SELECT * FROM `learners` WHERE `id` = ?");
});

test("an upsert reassigns the key so LAST_INSERT_ID survives the update branch", () => {
  const plan = planReturning(
    "INSERT INTO weekly_marks (learner_id, week_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE week_number = VALUES(week_number) RETURNING *",
    [3, 5],
  );
  // Without this the id of an updated row is not reported and the row read
  // back would be the wrong one, or none at all.
  assert.match(plan.write.sql, /`id` = LAST_INSERT_ID\(`id`\)/);
});

test("a table keyed on something other than id is read back by that key", () => {
  const sql =
    "INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value) RETURNING *";
  const plan = planReturning(sql, ["mfa_policy", "{}"]);

  assert.equal(plan.key, "key");
  assert.equal(plan.select, "SELECT * FROM `system_settings` WHERE `key` = ?");
  // The key is supplied in the statement, so it comes from the parameters
  // rather than from LAST_INSERT_ID, which is meaningless for a non-generated key.
  assert.deepEqual(plan.lookup, { value: "mfa_policy" });
});

test("UPDATE captures the affected rows before writing", () => {
  const plan = planReturning(
    "UPDATE learners SET full_name = ?, grade = ? WHERE id = ? AND school_id = ? RETURNING id, full_name",
    ["Bo", "G7", 12, 4],
  );

  assert.equal(plan.kind, "update");
  // The SET clause consumes the first two parameters; the WHERE gets the rest.
  assert.deepEqual(plan.before.params, [12, 4]);
  assert.equal(plan.before.sql, "SELECT `id` FROM `learners` WHERE id = ? AND school_id = ?");
  assert.equal(plan.select(2), "SELECT id, full_name FROM `learners` WHERE `id` IN (?, ?)");
});

test("a WHERE inside a subquery is not mistaken for the statement's own", () => {
  const sql = "UPDATE t SET a = (SELECT x FROM u WHERE u.id = ?) WHERE t.id = ? RETURNING *";
  const plan = planReturning(sql, [1, 2]);

  // The subquery's WHERE consumes one placeholder; only the outer one is ours.
  assert.deepEqual(plan.before.params, [2]);
  assert.equal(plan.before.sql, "SELECT `id` FROM `t` WHERE t.id = ?");
});

test("statements without RETURNING produce no plan", () => {
  assert.equal(planReturning("SELECT * FROM t WHERE id = ?", [1]), null);
  assert.equal(planReturning("DELETE FROM t WHERE id = ?", [1]), null);
});

test("placeholder counting and keyword finding ignore string literals", () => {
  assert.equal(countPlaceholders("a = ? AND b = 'not a ? mark'"), 1);
  assert.equal(findTopLevel("SELECT 'WHERE' FROM t WHERE x = 1", "WHERE"), 22);
});
