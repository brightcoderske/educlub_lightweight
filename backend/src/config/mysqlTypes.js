// Preserve the boolean contract used by strict frontend and service checks.
// mysql2 already decodes MySQL JSON and MariaDB's extended JSON metadata.
function typeCast(field, next) {
  if (field.type === "TINY" && field.length === 1) {
    const value = field.string();
    return value === null ? null : value === "1";
  }
  return next();
}

module.exports = { typeCast };
