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
    "'true_false'",
  ].forEach((value) => assert.match(schema, new RegExp(value)));
});
