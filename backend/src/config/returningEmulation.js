/**
 * MySQL has no RETURNING clause, and this codebase uses it 94 times - 60 on
 * INSERT, 34 on UPDATE - almost always to hand the freshly written row back to
 * the caller. Emulating it here keeps those call sites unchanged.
 *
 * Every plan runs inside one transaction in db.js. Without that, another
 * connection could modify the rows between the write and the read that fetches
 * them back, and the caller would be handed somebody else's data.
 */

// 61 of the 63 tables key on `id`. These two do not, and selecting the written
// row back by the wrong column would silently return nothing.
const PRIMARY_KEYS = { system_settings: "key", ai_role_limits: "role" };

function primaryKeyFor(table) {
  return PRIMARY_KEYS[table] || "id";
}

function quote(identifier) {
  return `\`${identifier}\``;
}

// Finds a top-level keyword, ignoring anything inside strings, comments,
// identifiers or parentheses - a WHERE belonging to a subquery is not ours.
function findTopLevel(sql, keyword) {
  const pattern = new RegExp(`\\b${keyword}\\b`, "i");
  let depth = 0;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    if (char === "'") {
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i += 1;
      }
      continue;
    }
    if (char === "`") {
      const end = sql.indexOf("`", i + 1);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (sql.slice(i, i + 2) === "--") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth !== 0) continue;

    const rest = sql.slice(i);
    const match = pattern.exec(rest);
    if (match && match.index === 0) return i;
  }
  return -1;
}

function countPlaceholders(sql) {
  let count = 0;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === "'") {
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i += 1;
      }
      continue;
    }
    if (char === "?") count += 1;
  }
  return count;
}

function splitReturning(sql) {
  const at = findTopLevel(sql, "RETURNING");
  if (at === -1) return null;
  return {
    body: sql.slice(0, at).trimEnd(),
    columns: sql.slice(at).replace(/^RETURNING\s+/i, "").trim(),
  };
}

function planInsert(sql, params) {
  const split = splitReturning(sql);
  if (!split) return null;

  const head = split.body.match(/^\s*INSERT\s+INTO\s+`?(\w+)`?\s*\(([^)]*)\)/i);
  if (!head) return null;

  const table = head[1];
  const key = primaryKeyFor(table);
  const columns = head[2].split(",").map((c) => c.trim().replace(/`/g, ""));
  const keyPosition = columns.indexOf(key);

  let body = split.body;
  let lookup;

  if (keyPosition === -1) {
    // Key is generated. For a plain insert LAST_INSERT_ID() is already right;
    // for an upsert that updated an existing row it is not, unless the update
    // list reassigns it - LAST_INSERT_ID(id) is the standard idiom for that.
    if (/ON DUPLICATE KEY UPDATE/i.test(body)) {
      body += `, ${quote(key)} = LAST_INSERT_ID(${quote(key)})`;
    }
    lookup = { byLastInsertId: true };
  } else {
    // Key is supplied explicitly, so read it straight back out of the params.
    const before = countPlaceholders(body.slice(0, body.indexOf("VALUES")));
    lookup = { value: params[before + keyPosition] };
  }

  return {
    kind: "insert",
    table,
    key,
    write: { sql: body, params },
    select: `SELECT ${split.columns} FROM ${quote(table)} WHERE ${quote(key)} = ?`,
    lookup,
  };
}

function planUpdate(sql, params) {
  const split = splitReturning(sql);
  if (!split) return null;

  const head = split.body.match(/^\s*UPDATE\s+`?(\w+)`?/i);
  if (!head) return null;

  const table = head[1];
  const key = primaryKeyFor(table);
  const whereAt = findTopLevel(split.body, "WHERE");
  if (whereAt === -1) return null;

  const where = split.body.slice(whereAt);
  // Parameters are positional across SET and WHERE, so the WHERE ones are
  // whatever follows the placeholders consumed by the SET clause.
  const setCount = countPlaceholders(split.body.slice(0, whereAt));

  return {
    kind: "update",
    table,
    key,
    // Which rows will be touched has to be captured before the write: the
    // update may change the very columns the WHERE clause matched on.
    before: { sql: `SELECT ${quote(key)} FROM ${quote(table)} ${where}`, params: params.slice(setCount) },
    write: { sql: split.body, params },
    select: (count) =>
      `SELECT ${split.columns} FROM ${quote(table)} WHERE ${quote(key)} IN (${Array(count).fill("?").join(", ")})`,
  };
}

function planReturning(sql, params) {
  if (!/\bRETURNING\b/i.test(sql)) return null;
  if (/^\s*INSERT/i.test(sql)) return planInsert(sql, params);
  if (/^\s*UPDATE/i.test(sql)) return planUpdate(sql, params);
  return null;
}

module.exports = { planReturning, primaryKeyFor, findTopLevel, countPlaceholders };
