const MIN_GRADE = 1;
const MAX_GRADE = 12;

/**
 * Grades are stored in one canonical form: "Grade N" for N between 1 and 12.
 *
 * Values reach the API from a dropdown ("Grade 7"), from spreadsheet uploads
 * where operators type whatever they like ("7", " grade 7 ", "GRADE 7"), and
 * from older records. Without a single normaliser the same class splits into
 * several distinct strings, which then breaks grouping, filtering and reports.
 *
 * Anything outside 1-12 or not grade-shaped returns null rather than being
 * stored as-is, so an unusable value never becomes a new phantom grade.
 */
function normalizeGrade(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  const match = text.match(/^(?:grade\s*)?(\d{1,2})$/i);
  if (!match) return null;

  const number = Number(match[1]);
  if (number < MIN_GRADE || number > MAX_GRADE) return null;

  return `Grade ${number}`;
}

function gradeOptions() {
  return Array.from({ length: MAX_GRADE }, (_, index) => `Grade ${index + 1}`);
}

module.exports = { normalizeGrade, gradeOptions, MIN_GRADE, MAX_GRADE };
