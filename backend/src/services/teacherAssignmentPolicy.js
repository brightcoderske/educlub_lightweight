function normalizePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function teacherRequiresAssignment(user = {}) {
  return user.role === "teacher";
}

function canManageTeacherAssignments(user = {}, course = {}) {
  if (user.role === "system_admin") return true;
  return (
    user.role === "school_admin" &&
    normalizePositiveId(user.schoolId) === normalizePositiveId(course.school_id)
  );
}

module.exports = {
  normalizePositiveId,
  teacherRequiresAssignment,
  canManageTeacherAssignments,
};
