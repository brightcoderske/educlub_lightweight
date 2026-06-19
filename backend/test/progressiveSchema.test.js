const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schema = fs.readFileSync(
  path.join(__dirname, "../src/database/schema.sql"),
  "utf8",
);

test("schema includes additive progressive learning structures", () => {
  [
    "availability_mode",
    "school_module_schedules",
    "learning_availability_overrides",
    "learner_module_badges",
    "module_feedback",
    "feedback_identity_audits",
    "typing_practice_attempts",
    "'true_false'",
  ].forEach((value) => assert.match(schema, new RegExp(value)));
});

test("typing practice is stored outside report-card weekly marks", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS typing_practice_attempts/);
  assert.doesNotMatch(
    schema,
    /typing_practice_attempts[\s\S]{0,600}weekly_marks/,
  );
});

test("typing practice has staff-readable learner scoped progress", () => {
  assert.match(schema, /typing_practice_attempts_role_access/);
  assert.match(schema, /typing_practice_attempts_learner_insert/);
});
