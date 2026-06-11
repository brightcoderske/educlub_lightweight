const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeProgress } = require("../src/services/progressMastery");

test("a failed retry cannot remove previously earned mastery", () => {
  assert.deepEqual(
    mergeProgress(
      { status: "graded", score: 90 },
      { status: "in_progress", score: 40 },
      true,
    ),
    { status: "graded", score: 90 },
  );
});

test("the best score wins regardless of concurrent completion order", () => {
  const failingThenPassing = mergeProgress(
    mergeProgress({}, { status: "in_progress", score: 40 }, true),
    { status: "graded", score: 90 },
    true,
  );
  const passingThenFailing = mergeProgress(
    mergeProgress({}, { status: "graded", score: 90 }, true),
    { status: "in_progress", score: 40 },
    true,
  );
  assert.deepEqual(failingThenPassing, { status: "graded", score: 90 });
  assert.deepEqual(passingThenFailing, { status: "graded", score: 90 });
});

test("ordinary progress updates may replace status and score", () => {
  assert.deepEqual(
    mergeProgress(
      { status: "completed", score: 100 },
      { status: "in_progress", score: 20 },
      false,
    ),
    { status: "in_progress", score: 20 },
  );
});
