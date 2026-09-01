const academicService = require("./academic.service");

function scopeError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function academicYearForTerm(term) {
  const explicitYear = Number(term?.academic_year);
  if (Number.isInteger(explicitYear) && explicitYear > 0) return explicitYear;
  if (!term?.start_date) return null;
  const derivedYear = new Date(term.start_date).getUTCFullYear();
  return Number.isInteger(derivedYear) ? derivedYear : null;
}

function requestedScope(filters = {}) {
  const term = String(filters.term || "").trim();
  const rawYear = filters.academic_year ?? filters.academicYear;
  const hasYear = rawYear !== undefined && rawYear !== null && String(rawYear).trim() !== "";

  if (Boolean(term) !== hasYear) {
    throw scopeError("Term and academic year must be provided together.");
  }
  if (!term) return null;

  const academicYear = Number(rawYear);
  if (!Number.isInteger(academicYear) || academicYear < 1) {
    throw scopeError("Academic year must be a valid year.");
  }
  return { term, academicYear };
}

async function currentScope(academic = academicService) {
  const activeTerm = await academic.getActiveTerm("regular");
  const academicYear = academicYearForTerm(activeTerm);
  if (!activeTerm?.name || !academicYear) return null;
  return { term: activeTerm.name, academicYear };
}

function sameScope(left, right) {
  return (
    left?.term === right?.term &&
    Number(left?.academicYear) === Number(right?.academicYear)
  );
}

async function resolveAssessmentScope(user, filters = {}, academic = academicService) {
  const requested = requestedScope(filters);

  // Staff may explicitly inspect one historical term, but an omitted period
  // always means the real date-based current term. Learners can never request
  // a historical period by changing query parameters.
  if (requested && user?.role !== "learner") return requested;

  const current = await currentScope(academic);
  if (!current) return null;
  if (requested && !sameScope(requested, current)) return null;
  return current;
}

async function requireConfiguredAssessmentScope(data = {}, academic = academicService) {
  const requested = requestedScope(data);
  if (!requested) {
    throw scopeError("Term and academic year are required for every assessment.");
  }
  const resolved = await academic.resolveTerm(requested.term, requested.academicYear);
  return { term: resolved.term, academicYear: Number(resolved.academic_year) };
}

module.exports = {
  academicYearForTerm,
  requestedScope,
  currentScope,
  sameScope,
  resolveAssessmentScope,
  requireConfiguredAssessmentScope,
};
