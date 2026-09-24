/**
 * The application was written against PostgreSQL and now runs on MySQL, so a
 * duplicate key arrives with a different code depending on which database is
 * underneath. Callers that turn a clash into a 409 need both spellings, or the
 * user is told "internal error" when they simply picked an email somebody else
 * already has.
 */
const UNIQUE_VIOLATION = new Set(["23505", "ER_DUP_ENTRY"]);
const FOREIGN_KEY_VIOLATION = new Set(["23503", "ER_NO_REFERENCED_ROW", "ER_NO_REFERENCED_ROW_2"]);

const isUniqueViolation = (error) =>
  Boolean(error) && (UNIQUE_VIOLATION.has(error.code) || error.errno === 1062);

const isForeignKeyViolation = (error) =>
  Boolean(error) && (FOREIGN_KEY_VIOLATION.has(error.code) || error.errno === 1452);

module.exports = { isUniqueViolation, isForeignKeyViolation };
