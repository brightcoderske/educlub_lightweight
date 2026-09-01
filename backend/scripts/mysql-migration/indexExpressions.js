/**
 * MySQL requires a functional index expression to carry its own parentheses:
 * PostgreSQL's `ON users(LOWER(email))` has to become `ON users((LOWER(email)))`.
 *
 * Kept in its own module because these patterns are pure and worth testing
 * directly, and because an index column list can hold several expressions -
 * certificates indexes on two COALESCE calls, and each needs wrapping.
 */

const EXPRESSION = /\b(?:LOWER|UPPER|COALESCE)\s*\((?:[^()]|\([^()]*\))*\)/gi;

function parenthesiseExpressions(sql) {
  return sql.replace(EXPRESSION, (expression) => `(${expression})`);
}

module.exports = { parenthesiseExpressions, EXPRESSION };
