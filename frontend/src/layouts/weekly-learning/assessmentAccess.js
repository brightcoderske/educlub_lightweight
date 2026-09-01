// Mirror of the server's assessment ownership rules (see
// backend/src/services/assessmentOwnership.js). The server is the authority;
// this only decides which buttons are worth rendering, so the two must agree
// or staff get controls that fail with a 403 when clicked.

function schoolId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isCompetitionAssessment(assessment = {}) {
  return (
    assessment.quiz_type === "competition" || assessment.test_type === "competition"
  );
}

export function canAuthorAssessments({ isSystemAdmin, isSchoolStaff } = {}) {
  return Boolean(isSystemAdmin || isSchoolStaff);
}

export function canManageAssessment(assessment, viewer = {}) {
  if (!assessment) return false;

  const owner = schoolId(assessment.school_id);
  const competition = isCompetitionAssessment(assessment);

  if (viewer.isSchoolStaff) {
    const own = schoolId(viewer.schoolId);
    return !competition && own !== null && owner === own;
  }

  // The system console keeps competitions and the global library it publishes
  // to every school; a school's own weekly assessment is read-only there.
  return Boolean(viewer.isSystemAdmin) && (owner === null || competition);
}
