const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("schema includes additive teacher assignment structures", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../src/database/schema.sql"),
    "utf8",
  );

  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_teacher_assignments/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_update_requests/);
  assert.match(schema, /idx_course_teacher_assignments_teacher_active/);
  assert.match(schema, /graduation_status/);
  assert.match(schema, /ALTER TABLE course_teacher_assignments ENABLE ROW LEVEL SECURITY/);
});

test("teacher scope helpers distinguish administrators and teachers", () => {
  const {
    canManageTeacherAssignments,
    teacherRequiresAssignment,
    normalizePositiveId,
  } = require("../src/services/teacherAssignmentPolicy");

  assert.equal(
    canManageTeacherAssignments(
      { role: "system_admin" },
      { school_id: 2 },
    ),
    true,
  );
  assert.equal(
    canManageTeacherAssignments(
      { role: "school_admin", schoolId: 2 },
      { school_id: 2 },
    ),
    true,
  );
  assert.equal(
    canManageTeacherAssignments(
      { role: "school_admin", schoolId: 3 },
      { school_id: 2 },
    ),
    false,
  );
  assert.equal(teacherRequiresAssignment({ role: "teacher" }), true);
  assert.equal(normalizePositiveId("7"), 7);
  assert.equal(normalizePositiveId("bad"), null);
});

test("staff account scope keeps school administrators inside their school", () => {
  const {
    resolveStaffAccountInput,
  } = require("../src/services/staffAccounts.service");

  assert.deepEqual(
    resolveStaffAccountInput(
      { role: "school_admin", schoolId: 8 },
      {
        role: "teacher",
        school_id: 99,
        full_name: "Jane Wanjiku",
        email: "Jane@School.test",
      },
    ),
    {
      role: "teacher",
      schoolId: 8,
      fullName: "Jane Wanjiku",
      email: "jane@school.test",
      username: "jane@school.test",
    },
  );

  assert.throws(
    () =>
      resolveStaffAccountInput(
        { role: "school_admin", schoolId: 8 },
        { role: "school_admin", full_name: "Other", email: "x@y.test" },
      ),
    /teachers only/i,
  );
});
