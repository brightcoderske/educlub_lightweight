const test = require("node:test");
const assert = require("node:assert/strict");

test("quiz mark validation keeps staff marks inside the quiz total", () => {
  const {
    normalizeAttemptMarks,
  } = require("../src/services/quizAttemptMarks");

  assert.deepEqual(normalizeAttemptMarks("4", 5), {
    earnedPoints: 4,
    totalPoints: 5,
    score: 80,
  });
  assert.throws(() => normalizeAttemptMarks(6, 5), /between 0 and 5/i);
  assert.throws(() => normalizeAttemptMarks("bad", 5), /valid mark/i);
});

test("quiz routes expose a staff-only attempt mark update", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/quizTests.routes.js"),
    "utf8",
  );

  assert.match(routes, /attempts\/:attemptId\/marks/);
  assert.match(routes, /updateAttemptMarks/);
});
