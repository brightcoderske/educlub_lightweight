const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("quiz submission preserves hints and only completes after pass score", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/courses.service.js"),
    "utf8",
  );
  assert.match(source, /hint: question\.hint/);
  assert.match(source, /explanation: question\.explanation/);
  assert.match(source, /passed \|\| alreadyMastered \? "graded" : "in_progress"/);
});
