/**
 * Translates the PostgreSQL SQL the application is written in into MySQL.
 *
 * Every query in this codebase goes through config/db.js, so doing the
 * translation here means the 1464 `$n` placeholders and 432 `::type` casts
 * spread across 527 call sites keep working untouched.
 *
 * The work is a scan rather than a set of regexes because both rewrites are
 * unsafe inside string literals: a quoted 'a::b' or a message containing '$1'
 * must survive verbatim.
 */

const { translateFilterClause } = require("./filterClause");

// PostgreSQL numbers its placeholders, so one value can be referenced several
// times and in any order. MySQL's `?` is strictly positional, so the parameter
// array has to be rebuilt to match the order the placeholders appear in -
// 39 queries here reuse a placeholder and 18 order them differently from their
// numbering, and a naive swap binds the wrong value to every one of them.
function translate(sql, params = []) {
  let out = "";
  let index = 0;
  const order = [];

  while (index < sql.length) {
    const char = sql[index];
    const pair = sql.slice(index, index + 2);

    // -- line comment
    if (pair === "--") {
      const end = sql.indexOf("\n", index);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(index, stop);
      index = stop;
      continue;
    }

    // /* block comment */
    if (pair === "/*") {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(index, stop);
      index = stop;
      continue;
    }

    // 'string literal', with '' as the escaped quote
    if (char === "'") {
      out += char;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          out += "''";
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          out += "'";
          index += 1;
          break;
        }
        out += sql[index];
        index += 1;
      }
      continue;
    }

    // "quoted identifier" in PostgreSQL is a backtick in MySQL
    if (char === '"') {
      const end = sql.indexOf('"', index + 1);
      if (end === -1) {
        out += sql.slice(index);
        break;
      }
      out += `\`${sql.slice(index + 1, end)}\``;
      index = end + 1;
      continue;
    }

    // `already a MySQL identifier`
    if (char === "`") {
      const end = sql.indexOf("`", index + 1);
      const stop = end === -1 ? sql.length : end + 1;
      out += sql.slice(index, stop);
      index = stop;
      continue;
    }

    // $n placeholder
    if (char === "$" && /\d/.test(sql[index + 1] || "")) {
      let digits = "";
      let cursor = index + 1;
      while (cursor < sql.length && /\d/.test(sql[cursor])) {
        digits += sql[cursor];
        cursor += 1;
      }
      order.push(Number(digits) - 1);
      out += "?";
      index = cursor;
      continue;
    }

    // ::type cast - MySQL infers these, and CAST() would change NULL handling
    if (pair === "::") {
      let cursor = index + 2;
      while (cursor < sql.length && /[A-Za-z_]/.test(sql[cursor])) cursor += 1;
      // an optional length or precision, e.g. ::varchar(50) or ::numeric(8, 2)
      if (sql[cursor] === "(") {
        const close = sql.indexOf(")", cursor);
        if (close !== -1) cursor = close + 1;
      }
      // an array cast, e.g. ::int[]
      if (sql.slice(cursor, cursor + 2) === "[]") cursor += 2;
      index = cursor;
      continue;
    }

    out += char;
    index += 1;
  }

  // SQL written with plain `?` has no $n ordering to rebuild from, so its
  // parameters pass through as given. Without this, such a statement would be
  // sent with an empty parameter list and fail as a syntax error.
  const reordered =
    order.length === 0 && params.length > 0 ? params : order.map((position) => params[position]);

  // An empty array would render as `IN ()`, which is a syntax error. PostgreSQL's
  // `= ANY('{}')` matches no rows, and `IN (NULL)` is the MySQL spelling of that.
  const bound = reordered.map((value) =>
    Array.isArray(value) && value.length === 0 ? [null] : value,
  );

  return { sql: applyDialectRewrites(out), params: bound };
}

// ON CONFLICT (cols) DO UPDATE SET x = EXCLUDED.x  ->  ON DUPLICATE KEY UPDATE x = VALUES(x)
// ON CONFLICT (col) DO NOTHING                     ->  a self-assignment, MySQL's idiom for
//                                                      "leave the existing row alone"
function translateUpsert(sql) {
  if (!/\bON CONFLICT\b/i.test(sql)) return sql;

  const doNothing = sql.replace(
    /ON CONFLICT\s*(?:\(\s*(\w+)[^)]*\))?\s*DO NOTHING/i,
    (match, column) => {
      const target = column || "id";
      return `ON DUPLICATE KEY UPDATE \`${target}\` = \`${target}\``;
    },
  );
  if (doNothing !== sql) return doNothing;

  return sql.replace(
    /ON CONFLICT\s*\([^)]*\)\s*(?:WHERE\s+[^\n]*?)?\s*DO UPDATE\s+SET\s/i,
    "ON DUPLICATE KEY UPDATE ",
  ).replace(/\bEXCLUDED\.(\w+)/gi, "VALUES($1)");
}

// The database collation is accent- and case-sensitive so it matches what
// PostgreSQL did, which means a plain LIKE is case-SENSITIVE here. ILIKE has to
// force an insensitive collation or it would quietly stop matching. Attaching
// COLLATE to the left operand covers patterns built with || on the right.
const CASE_INSENSITIVE = "utf8mb4_0900_ai_ci";

// MySQL has no NULLS LAST/FIRST. Its own ordering puts NULLs first ascending
// and last descending, so only the combinations that differ need an extra
// sort key - `expr IS NULL` sorts 0 before 1, which places non-nulls first.
function translateNullOrdering(sql) {
  return sql.replace(
    /([\w.`()']+)\s+(ASC|DESC)?\s*NULLS\s+(LAST|FIRST)/gi,
    (match, expression, direction, placement) => {
      const order = (direction || "ASC").toUpperCase();
      const wantsLast = placement.toUpperCase() === "LAST";
      const alreadyCorrect = (order === "ASC") !== wantsLast;
      if (alreadyCorrect) return `${expression} ${order}`;
      return `${expression} IS NULL${wantsLast ? "" : " DESC"}, ${expression} ${order}`;
    },
  );
}

// MySQL has no array type, so `= ANY($n)` has no meaning. IN (?) is the
// equivalent, and mysql2 expands a JavaScript array bound to a single `?` into
// the comma-separated list it needs.
function translateArrayMembership(sql) {
  return sql.replace(/(<>|!=|=)\s*ANY\s*\(\s*\?\s*\)/gi, (match, operator) =>
    operator === "=" ? "IN (?)" : "NOT IN (?)",
  );
}

// PostgreSQL writes INTERVAL '1 hour'; MySQL writes INTERVAL 1 HOUR.
function translateIntervals(sql) {
  return sql.replace(
    /\bINTERVAL\s+'(\d+)\s+([A-Za-z]+?)s?'/gi,
    (match, amount, unit) => `INTERVAL ${amount} ${unit.toUpperCase()}`,
  );
}

function applyDialectRewrites(sql) {
  let out = translateUpsert(sql);
  out = translateFilterClause(out);
  out = translateNullOrdering(out);
  out = translateArrayMembership(out);
  out = translateIntervals(out);
  out = out.replace(/\s+ILIKE\s+/gi, ` COLLATE ${CASE_INSENSITIVE} LIKE `);
  return out;
}

module.exports = { translate, translateUpsert, applyDialectRewrites, CASE_INSENSITIVE };
