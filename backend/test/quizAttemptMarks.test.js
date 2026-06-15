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

test("question marks calculate right, partial, wrong, and the quiz total", () => {
  const {
    normalizeQuestionMarks,
  } = require("../src/services/quizAttemptMarks");

  assert.deepEqual(
    normalizeQuestionMarks(
      [
        { id: 11, points: 2 },
        { id: 12, points: 2 },
        { id: 13, points: 1 },
      ],
      { 11: 2, 12: 1, 13: 0 },
    ),
    {
      earnedPoints: 3,
      totalPoints: 5,
      score: 60,
      feedback: {
        11: { correct: true, status: "right", points: 2, max_points: 2 },
        12: { correct: false, status: "partial", points: 1, max_points: 2 },
        13: { correct: false, status: "wrong", points: 0, max_points: 1 },
      },
    },
  );
  assert.throws(
    () => normalizeQuestionMarks([{ id: 11, points: 2 }], { 11: 3 }),
    /between 0 and 2/i,
  );
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
