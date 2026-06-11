const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("generic progress cannot complete a quiz without a passing attempt", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/courses.service.js"),
    "utf8",
  );
  assert.match(source, /Quiz completion requires a passing quiz attempt/);
  assert.match(source, /options\.allowQuizCompletion !== true/);
  assert.match(source, /options\.preserveMastery === true/);
  assert.doesNotMatch(source, /data\.preserve_mastery/);
});
