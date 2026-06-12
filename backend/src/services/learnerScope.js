function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function resolveLearnerSchoolScope(user = {}, requestedSchoolId = null) {
  if (user.role === "school_admin" || user.role === "teacher") {
    const schoolId = positiveId(user.schoolId);
    if (!schoolId) {
      throw new Error("Authenticated user has no valid school scope");
    }
    return schoolId;
  }

  if (user.role === "system_admin") {
    return positiveId(requestedSchoolId);
  }

  return null;
}

module.exports = {
  resolveLearnerSchoolScope,
};
