const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveLearnerSchoolScope } = require("../src/services/learnerScope");

test("school staff are always scoped to their authenticated school", () => {
  assert.equal(
    resolveLearnerSchoolScope(
      { role: "school_admin", schoolId: 12 },
      99,
    ),
    12,
  );
  assert.equal(
    resolveLearnerSchoolScope({ role: "teacher", schoolId: 7 }, 99),
    7,
  );
});

test("system administrators may explicitly filter learners by school", () => {
  assert.equal(
    resolveLearnerSchoolScope({ role: "system_admin" }, "24"),
    24,
  );
  assert.equal(resolveLearnerSchoolScope({ role: "system_admin" }), null);
});

test("invalid staff school scope is rejected", () => {
  assert.throws(
    () => resolveLearnerSchoolScope({ role: "teacher", schoolId: null }),
    /school scope/i,
  );
});
