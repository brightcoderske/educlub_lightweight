const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scoreTypingAttempt,
  clampDurationSeconds,
  editDistance,
} = require("../src/services/typingScoring");

const PASSAGE = "the quick brown fox jumps over the lazy dog and runs far away today";

test("accuracy is measured against the passage, not against what was typed", () => {
  // Typing three of fourteen words used to score 100% accuracy because the
  // denominator was the learner's own word count.
  const partial = scoreTypingAttempt(PASSAGE, "the quick brown", 60);
  assert.ok(partial.accuracy < 25, `expected a low mark, got ${partial.accuracy}`);
  assert.equal(partial.mistakes, 0);

  const complete = scoreTypingAttempt(PASSAGE, PASSAGE, 60);
  assert.equal(complete.accuracy, 100);
});

test("one dropped word costs one mark instead of failing the rest of the line", () => {
  const dropped = "the brown fox jumps over the lazy dog and runs far away today";
  const score = scoreTypingAttempt(PASSAGE, dropped, 60);
  // Positional comparison used to misalign every later word, scoring 7% for a
  // single omission. Alignment charges the omission and nothing more.
  assert.ok(score.word_errors <= 2, `expected a small error count, got ${score.word_errors}`);
  assert.ok(score.accuracy > 70, `expected a fair mark, got ${score.accuracy}`);
});

test("accuracy is per character so a single slipped key is not a total loss", () => {
  const drill = scoreTypingAttempt("asdf", "asxf", 60);
  assert.equal(drill.accuracy, 75);
  assert.equal(drill.mistakes, 1);
});

test("net words per minute deducts whole mistyped words, not each character", () => {
  const oneTypo = scoreTypingAttempt(PASSAGE, `${PASSAGE.slice(0, -2)}ya`, 60);
  assert.equal(oneTypo.word_errors, 1);
  assert.ok(
    oneTypo.final_score > oneTypo.raw_wpm - 2,
    `one mistyped word should cost about one word per minute, got ${oneTypo.final_score}`,
  );
});

test("a forged elapsed time cannot inflate words per minute", () => {
  const honest = scoreTypingAttempt(PASSAGE, PASSAGE, 60);
  for (const forged of [1, 0.01, -999, "0", null]) {
    const score = scoreTypingAttempt(PASSAGE, PASSAGE, forged);
    assert.ok(
      score.raw_wpm < 100,
      `duration ${forged} produced ${score.raw_wpm} wpm`,
    );
    assert.ok(score.raw_wpm >= honest.raw_wpm);
  }
});

test("the lesson time limit still caps a slow attempt", () => {
  assert.equal(clampDurationSeconds(PASSAGE, 600, 120), 120);
  assert.equal(clampDurationSeconds(PASSAGE, 45, 120), 45);
});

test("edit distance counts substitutions, omissions and insertions once each", () => {
  assert.equal(editDistance(["a", "b", "c"], ["a", "b", "c"]), 0);
  assert.equal(editDistance(["a", "b", "c"], ["a", "x", "c"]), 1);
  assert.equal(editDistance(["a", "b", "c"], ["a", "c"]), 1);
  assert.equal(editDistance(["a", "c"], ["a", "b", "c"]), 1);
  assert.equal(editDistance("asdf", "asxf"), 1);
  assert.equal(editDistance("asdf", "asf"), 1);
});

test("an empty attempt scores nothing", () => {
  const score = scoreTypingAttempt(PASSAGE, "", 60);
  assert.equal(score.raw_wpm, 0);
  assert.equal(score.final_score, 0);
  assert.equal(score.accuracy, 0);
});
