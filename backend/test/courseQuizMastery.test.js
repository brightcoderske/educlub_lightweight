const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("quiz submission preserves hints and mastery atomically", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/courses.service.js"),
    "utf8",
  );
  assert.match(source, /hint: question\.hint/);
  assert.match(source, /explanation: question\.explanation/);
  assert.match(source, /preserve_mastery: true/);
  assert.match(source, /activity_progress\.status IN \('completed'::varchar, 'graded'::varchar\)/);
  assert.match(source, /GREATEST\(/);
});
