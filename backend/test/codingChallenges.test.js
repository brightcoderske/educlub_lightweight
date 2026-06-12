const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBooleanAnswer,
  validateCodingChallenge,
  evaluateSourceChecks,
} = require("../src/services/codingChallenges.service");

test("true false answers normalize consistently", () => {
  assert.equal(normalizeBooleanAnswer(true), true);
  assert.equal(normalizeBooleanAnswer("TRUE"), true);
  assert.equal(normalizeBooleanAnswer("false"), false);
});

test("coding check marks cannot exceed activity marks", () => {
  assert.throws(
    () =>
      validateCodingChallenge({
        points: 5,
        content: {
          challenge_mode: "debug",
          validation_checks: [{ type: "html_contains", value: "<main", points: 6 }],
        },
      }),
    /exceed/i,
  );
});

test("safe source checks inspect text without executing learner javascript", () => {
  const result = evaluateSourceChecks(
    { html: '<button id="save">Save</button>', css: "#save { color: red; }", js: "" },
    [
      { type: "html_contains", value: 'id="save"', points: 2 },
      { type: "css_contains", value: "color: red", points: 1 },
    ],
  );
  assert.equal(result.earned_points, 3);
  assert.equal(result.results.every((item) => item.passed), true);
});
