const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  resolveAssessmentSchoolId,
  resolveAssessmentType,
  canManageAssessment,
  assertAssessmentManageAccess,
} = require("../src/services/assessmentOwnership");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("school staff author against their own school and never another", () => {
  assert.equal(
    resolveAssessmentSchoolId({ role: "school_admin", schoolId: 4 }),
    4,
  );
  assert.equal(resolveAssessmentSchoolId({ role: "teacher", schoolId: 9 }), 9);
  assert.throws(
    () => resolveAssessmentSchoolId({ role: "school_admin", schoolId: null }),
    /not linked to a school/i,
  );
});

test("system administrator assessments are global, never targeted at a school", () => {
  assert.equal(resolveAssessmentSchoolId({ role: "system_admin" }), null);
  assert.throws(
    () => resolveAssessmentSchoolId({ role: "learner" }),
    /cannot author/i,
  );
});

test("only the system console can create a competition assessment", () => {
  assert.equal(
    resolveAssessmentType({ role: "system_admin" }, "competition"),
    "competition",
  );
  assert.equal(
    resolveAssessmentType({ role: "school_admin", schoolId: 2 }, "competition"),
    "weekly",
  );
  assert.equal(
    resolveAssessmentType({ role: "teacher", schoolId: 2 }, "competition"),
    "weekly",
  );
  assert.equal(resolveAssessmentType({ role: "system_admin" }, "weekly"), "weekly");
});

test("a school manages its own weekly assessments and nobody else's", () => {
  const staff = { role: "school_admin", schoolId: 3 };
  const teacher = { role: "teacher", schoolId: 3 };

  assert.equal(canManageAssessment(staff, { school_id: 3, quiz_type: "weekly" }), true);
  assert.equal(canManageAssessment(teacher, { school_id: 3, test_type: "weekly" }), true);
  assert.equal(canManageAssessment(staff, { school_id: 8, quiz_type: "weekly" }), false);
  // The global library is published centrally, so a school may run it but not edit it.
  assert.equal(canManageAssessment(staff, { school_id: null, quiz_type: "weekly" }), false);
  assert.equal(
    canManageAssessment(staff, { school_id: 3, quiz_type: "competition" }),
    false,
  );
});

test("the system console keeps competitions and the global library only", () => {
  const admin = { role: "system_admin" };

  assert.equal(canManageAssessment(admin, { school_id: null, quiz_type: "weekly" }), true);
  assert.equal(
    canManageAssessment(admin, { school_id: 5, test_type: "competition" }),
    true,
  );
  // A school's own weekly assessment is read-only from the system console.
  assert.equal(canManageAssessment(admin, { school_id: 5, quiz_type: "weekly" }), false);
  assert.equal(canManageAssessment({ role: "learner" }, { school_id: null }), false);
});

test("refusals explain which side of the boundary the caller is on", () => {
  assert.throws(
    () =>
      assertAssessmentManageAccess(
        { role: "school_admin", schoolId: 1 },
        { school_id: 2, quiz_type: "weekly" },
        "quiz",
      ),
    /another school/i,
  );
  assert.throws(
    () =>
      assertAssessmentManageAccess(
        { role: "system_admin" },
        { school_id: 2, quiz_type: "weekly" },
        "quiz",
      ),
    /read-only/i,
  );
});

test("quiz and typing authoring routes are open to school staff", () => {
  const quizRoutes = source("src/routes/quizTests.routes.js");
  const typingRoutes = source("src/routes/typing.routes.js");

  for (const routes of [quizRoutes, typingRoutes]) {
    assert.doesNotMatch(routes, /requireRole\("system_admin"\)/);
    assert.match(
      routes,
      /requireRole\("system_admin", "school_admin", "teacher"\)/,
    );
  }
});

test("quiz lookup no longer escalates the caller to system administrator", () => {
  const service = source("src/services/quizTests.service.js");

  assert.doesNotMatch(service, /role: user\.role === "learner" \? "learner" : "system_admin"/);
  assert.doesNotMatch(service, /getTest\(testId, \{ \.\.\.user, role: "system_admin" \}\)/);
  assert.match(
    service,
    /const tests = await listTests\(user, \{ \.\.\.filters, id: testId \}\)/,
  );
});

test("typing writes assert ownership instead of escalating the caller", () => {
  const service = source("src/services/typing.service.js");

  assert.doesNotMatch(service, /\{ \.\.\.user, role: "system_admin" \}/);
  assert.match(service, /assertAssessmentManageAccess\(user, existing, "typing test"\)/);
  assert.match(service, /assertAssessmentManageAccess\(user, allowed, "typing test"\)/);
});

test("deleting a weekly typing test clears marks for its school only", () => {
  const service = source("src/services/typing.service.js");
  const wipe = service.slice(
    service.indexOf("SET typing_score = NULL"),
    service.indexOf("SET typing_score = NULL") + 600,
  );

  assert.match(wipe, /SELECT id FROM learners WHERE school_id = \$4::integer/);
});
