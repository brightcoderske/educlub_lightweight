import {
  canAuthorAssessments,
  canManageAssessment,
} from "../layouts/weekly-learning/assessmentAccess";

const schoolStaff = { isSystemAdmin: false, isSchoolStaff: true, schoolId: 3 };
const systemAdmin = { isSystemAdmin: true, isSchoolStaff: false, schoolId: null };
const learner = { isSystemAdmin: false, isSchoolStaff: false, schoolId: 3 };

test("weekly authoring is open to school staff, not to learners", () => {
  expect(canAuthorAssessments(schoolStaff)).toBe(true);
  expect(canAuthorAssessments(systemAdmin)).toBe(true);
  expect(canAuthorAssessments(learner)).toBe(false);
});

test("a school gets edit controls on its own weekly assessments only", () => {
  expect(canManageAssessment({ school_id: 3, quiz_type: "weekly" }, schoolStaff)).toBe(true);
  expect(canManageAssessment({ school_id: 3, test_type: "weekly" }, schoolStaff)).toBe(true);
  expect(canManageAssessment({ school_id: 8, quiz_type: "weekly" }, schoolStaff)).toBe(false);
});

test("the centrally published library is runnable by a school but not editable", () => {
  expect(canManageAssessment({ school_id: null, quiz_type: "weekly" }, schoolStaff)).toBe(false);
  expect(canManageAssessment({ school_id: null, quiz_type: "weekly" }, systemAdmin)).toBe(true);
});

test("competitions stay with the system console on both sides", () => {
  const competition = { school_id: 3, quiz_type: "competition" };
  expect(canManageAssessment(competition, schoolStaff)).toBe(false);
  expect(canManageAssessment(competition, systemAdmin)).toBe(true);
});

test("a school's own weekly assessment is read-only from the system console", () => {
  expect(canManageAssessment({ school_id: 5, quiz_type: "weekly" }, systemAdmin)).toBe(false);
  expect(canManageAssessment({ school_id: 5, test_type: "weekly" }, systemAdmin)).toBe(false);
});

test("nothing is manageable without an assessment or by a learner", () => {
  expect(canManageAssessment(null, systemAdmin)).toBe(false);
  expect(canManageAssessment({ school_id: 3, quiz_type: "weekly" }, learner)).toBe(false);
});

test("staff with no school on the token get no edit controls", () => {
  const unlinked = { isSystemAdmin: false, isSchoolStaff: true, schoolId: null };
  expect(canManageAssessment({ school_id: 3, quiz_type: "weekly" }, unlinked)).toBe(false);
});
