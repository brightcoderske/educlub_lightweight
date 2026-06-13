const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeActivityGrade } = require("../src/services/gradingPolicy");
const { answersMatch } = require("../src/services/quizAnswerPolicy");

test("activity grades cannot exceed the configured maximum", () => {
  assert.equal(normalizeActivityGrade("7.5", 10), 7.5);
  assert.equal(normalizeActivityGrade("", 10), null);
  assert.throws(() => normalizeActivityGrade(11, 10), /cannot exceed 10/i);
});

test("short answers accept any configured equivalent answer", () => {
  assert.equal(
    answersMatch(["CPU", "Central Processing Unit"], " central   processing unit ", "short_answer"),
    true,
  );
  assert.equal(
    answersMatch(["CPU", "Central Processing Unit"], "processor", "short_answer"),
    false,
  );
});
