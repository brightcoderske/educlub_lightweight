// Ownership rules for weekly typing tests and quiz tests.
//
// Weekly assessments belong to the school that authored them: its own staff
// create, publish, review and delete them, and nobody outside that school ever
// sees the questions or the answer key. The system administrator keeps the two
// things that are genuinely cross-school - eduClub competition assessments and
// the global library (school_id IS NULL) that every school may run - and is
// read-only over everything a school authored for itself. A school may also run
// competitions of its own; their assessments are the school's like any other.

const SCHOOL_STAFF_ROLES = ["school_admin", "teacher"];

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isSchoolStaff(user = {}) {
  return SCHOOL_STAFF_ROLES.includes(user.role);
}

function isCompetitionAssessment(assessment = {}) {
  return (
    assessment.quiz_type === "competition" ||
    assessment.test_type === "competition"
  );
}

// The school an assessment is written to. School staff can only ever write to
// their own school, so a school_id sent by the client is ignored rather than
// trusted. A system administrator authors for everyone, so their assessments
// are global; targeting one school from the system console is not a thing the
// role does any more.
function resolveAssessmentSchoolId(user = {}) {
  if (isSchoolStaff(user)) {
    const schoolId = positiveId(user.schoolId);
    if (!schoolId) {
      throw new Error("Your account is not linked to a school.");
    }
    return schoolId;
  }

  if (user.role === "system_admin") {
    return null;
  }

  throw new Error("You cannot author assessments.");
}

// School staff may make a competition assessment only for one of their own
// school's competitions: `competition` is the row competition_id names (null if
// none). Asking for any other competition - an eduClub one, another school's -
// gives a weekly assessment, as it always did, so a school cannot attach its
// questions to a competition it does not run.
function resolveAssessmentType(user = {}, requestedType, competition = null) {
  if (String(requestedType || "") !== "competition") return "weekly";
  if (!isSchoolStaff(user)) return "competition";
  const schoolId = positiveId(user.schoolId);
  return schoolId !== null && positiveId(competition?.school_id) === schoolId
    ? "competition"
    : "weekly";
}

function canManageAssessment(user = {}, assessment = {}) {
  const ownerSchoolId = positiveId(assessment.school_id);

  // Staff manage what their school owns, its competition assessments included.
  // eduClub competition assessments carry no school, so they stay out of reach.
  if (isSchoolStaff(user)) {
    const schoolId = positiveId(user.schoolId);
    return schoolId !== null && ownerSchoolId === schoolId;
  }

  if (user.role === "system_admin") {
    return ownerSchoolId === null || isCompetitionAssessment(assessment);
  }

  return false;
}

function assertAssessmentManageAccess(user = {}, assessment = {}, label = "assessment") {
  if (canManageAssessment(user, assessment)) {
    return true;
  }

  throw new Error(
    isSchoolStaff(user)
      ? `This ${label} belongs to another school.`
      : `This ${label} is owned by a school and is read-only here.`,
  );
}

module.exports = {
  SCHOOL_STAFF_ROLES,
  positiveId,
  isSchoolStaff,
  isCompetitionAssessment,
  resolveAssessmentSchoolId,
  resolveAssessmentType,
  canManageAssessment,
  assertAssessmentManageAccess,
};
