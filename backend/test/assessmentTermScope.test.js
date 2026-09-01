const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  requestedScope,
  resolveAssessmentScope,
  requireConfiguredAssessmentScope,
} = require("../src/services/assessmentTermScope");

test("assessment periods require term and academic year together", () => {
  assert.deepEqual(requestedScope({ term: "Term 3", academic_year: "2026" }), {
    term: "Term 3",
    academicYear: 2026,
  });
  assert.throws(() => requestedScope({ term: "Term 3" }), /provided together/i);
  assert.throws(() => requestedScope({ academic_year: 2026 }), /provided together/i);
});

test("an unqualified assessment list returns nothing when there is no current term", async () => {
  const scope = await resolveAssessmentScope(
    { role: "school_admin" },
    {},
    { getActiveTerm: async () => null },
  );
  assert.equal(scope, null);
});

test("learners cannot request an expired term explicitly", async () => {
  const scope = await resolveAssessmentScope(
    { role: "learner" },
    { term: "Term 2", academic_year: 2026 },
    {
      getActiveTerm: async () => ({ name: "Term 3", academic_year: 2026 }),
    },
  );
  assert.equal(scope, null);
});

test("staff may explicitly inspect one historical term", async () => {
  const scope = await resolveAssessmentScope(
    { role: "school_admin" },
    { term: "Term 2", academic_year: 2026 },
    { getActiveTerm: async () => null },
  );
  assert.deepEqual(scope, { term: "Term 2", academicYear: 2026 });
});

test("assessment writes resolve a configured term instead of storing free text", async () => {
  const scope = await requireConfiguredAssessmentScope(
    { term: "Term 3", academic_year: 2026 },
    {
      resolveTerm: async (term, year) => ({ term, academic_year: year }),
    },
  );
  assert.deepEqual(scope, { term: "Term 3", academicYear: 2026 });
});

test("expired is_active rows are not a current-term fallback", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/academic.service.js"),
    "utf8",
  );
  assert.doesNotMatch(source, /const fallback = await query/);
  assert.match(source, /CURRENT_DATE BETWEEN t\.start_date AND t\.end_date/);
});

test("quiz and typing reads apply the shared assessment period scope", () => {
  const quizSource = fs.readFileSync(
    path.join(__dirname, "../src/services/quizTests.service.js"),
    "utf8",
  );
  const typingSource = fs.readFileSync(
    path.join(__dirname, "../src/services/typing.service.js"),
    "utf8",
  );

  for (const source of [quizSource, typingSource]) {
    assert.match(source, /resolveAssessmentScope\(user, filters\)/);
    assert.match(source, /requireConfiguredAssessmentScope\(data\)/);
  }
  assert.match(quizSource, /qt\.term = \$1 AND qt\.academic_year = \$2/);
  assert.match(typingSource, /tt\.term = \$1 AND tt\.academic_year = \$2/);
});
