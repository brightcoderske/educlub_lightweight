const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeActivityGrade } = require("../src/services/gradingPolicy");
const fs = require("node:fs");
const path = require("node:path");
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

test("a skipped question is never marked correct", () => {
  // A false-answer true/false question used to score full marks when the
  // learner submitted nothing, because both sides collapsed to `false`.
  assert.equal(answersMatch(false, undefined, "true_false"), false);
  assert.equal(answersMatch("False", undefined, "true_false"), false);
  assert.equal(answersMatch("B", undefined, "multiple_choice"), false);
  assert.equal(answersMatch(["a", "b"], undefined, "multi_select"), false);
  assert.equal(answersMatch({ ram: "memory" }, undefined, "matching"), false);
  assert.equal(answersMatch("cpu", "   ", "short_answer"), false);
});

test("a question with no configured answer awards no marks", () => {
  assert.equal(answersMatch("", undefined, "multiple_choice"), false);
  assert.equal(answersMatch("", "anything", "multiple_choice"), false);
  assert.equal(answersMatch("", "", "short_answer"), false);
  assert.equal(answersMatch(undefined, "true", "true_false"), false);
});

test("true and false answers are graded on their own merits", () => {
  assert.equal(answersMatch(false, "false", "true_false"), true);
  assert.equal(answersMatch(false, true, "true_false"), false);
  assert.equal(answersMatch(true, "TRUE", "true_false"), true);
  assert.equal(answersMatch(true, "maybe", "true_false"), false);
});

test("matching questions require every pair to be answered", () => {
  assert.equal(
    answersMatch({ cpu: "processor", ram: "memory" }, { cpu: "processor", ram: "memory" }, "matching"),
    true,
  );
  assert.equal(
    answersMatch({ cpu: "processor", ram: "memory" }, { cpu: "processor", ram: "" }, "matching"),
    false,
  );
  assert.equal(
    answersMatch({ cpu: "processor", ram: "memory" }, { cpu: "processor" }, "matching"),
    false,
  );
});

test("ordering respects sequence while multi-select does not", () => {
  assert.equal(answersMatch(["1", "2", "3"], ["2", "1", "3"], "ordering"), false);
  assert.equal(answersMatch(["1", "2", "3"], ["1", "2", "3"], "ordering"), true);
  assert.equal(answersMatch(["a", "b"], ["b", "a"], "multi_select"), true);
  assert.equal(answersMatch(["a", "b"], ["a"], "multi_select"), false);
});

test("module lesson quizzes grade through the same shared policy", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/courses.service.js"),
    "utf8",
  );
  assert.match(source, /require\("\.\/quizAnswerPolicy"\)/);
  assert.doesNotMatch(source, /function answersMatch/);
});
