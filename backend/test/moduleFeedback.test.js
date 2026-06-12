const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateFeedback,
  anonymizeFeedbackRow,
  normalizeReportFilters,
  resolveReportSchoolScope,
  getTemplateFeedbackReport,
  getCourseFeedbackReport,
} = require("../src/services/moduleFeedback.service");

test("module feedback requires a rating from one to five", () => {
  assert.throws(() => validateFeedback({ rating: 0 }), /1 and 5/);
  assert.throws(() => validateFeedback({ rating: 6 }), /1 and 5/);
  assert.equal(validateFeedback({ rating: 5, comment: "Helpful" }).rating, 5);
});

test("school feedback views never expose learner identity", () => {
  const row = anonymizeFeedbackRow({
    id: 1,
    learner_id: 44,
    learner_name: "Private Learner",
    rating: 4,
    comment: "More examples please.",
  });
  assert.equal(row.learner_id, undefined);
  assert.equal(row.learner_name, undefined);
  assert.equal(row.comment, "More examples please.");
});

test("course review filters are bounded and normalized", () => {
  assert.deepEqual(
    normalizeReportFilters({
      page: "0",
      pageSize: "1000",
      rating: "4",
      moduleId: "12",
      schoolId: "7",
      search: "  River School  ",
      from: "2026-01-02",
      to: "2026-03-31",
    }),
    {
      page: 1,
      pageSize: 50,
      rating: 4,
      moduleId: 12,
      schoolId: 7,
      search: "River School",
      from: "2026-01-02",
      to: "2026-03-31",
    },
  );
  assert.throws(
    () => normalizeReportFilters({ rating: "6" }),
    /Rating filter must be between 1 and 5/,
  );
});

test("course review school scope cannot be expanded by school staff", () => {
  assert.equal(
    resolveReportSchoolScope(
      { role: "teacher", schoolId: 9 },
      25,
    ),
    9,
  );
  assert.equal(
    resolveReportSchoolScope(
      { role: "school_admin", schoolId: 11 },
      null,
    ),
    11,
  );
  assert.equal(
    resolveReportSchoolScope(
      { role: "system_admin", schoolId: null },
      25,
    ),
    25,
  );
  assert.throws(
    () => resolveReportSchoolScope({ role: "learner", schoolId: 9 }, 9),
    /Staff access is required/,
  );
});

test("template-wide reviews are restricted to system administrators", async () => {
  await assert.rejects(
    getTemplateFeedbackReport(1, { role: "teacher", schoolId: 2 }),
    /System administrator access is required/,
  );
});

test("course review reports reject learner access before querying", async () => {
  await assert.rejects(
    getCourseFeedbackReport(1, { role: "learner", schoolId: 2 }),
    /Staff access is required/,
  );
});
