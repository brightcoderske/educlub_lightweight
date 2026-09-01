/**
 * Rewrites PostgreSQL's aggregate FILTER clause for MySQL:
 *
 *   COUNT(la.id) FILTER (WHERE cond)  ->  COUNT(CASE WHEN cond THEN la.id END)
 *   COUNT(*)     FILTER (WHERE cond)  ->  COUNT(CASE WHEN cond THEN 1 END)
 *
 * Aggregates skip NULLs, so a CASE with no ELSE reproduces FILTER exactly.
 *
 * This has to scan rather than pattern match: the conditions here contain their
 * own parentheses (COALESCE(...) = '...'), and a regex that stops at the first
 * closing paren silently truncates the condition and leaves the tail of it
 * dangling as broken SQL.
 */

// Reads a parenthesised group starting at `open` and returns its inner text
// plus the index just past the closing parenthesis.
function readGroup(sql, open) {
  let depth = 0;
  let inString = false;

  for (let i = open; i < sql.length; i += 1) {
    const char = sql[i];

    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return { inner: sql.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

// Walks back from the "(" of FILTER to the aggregate call before it.
function readAggregate(sql, filterAt) {
  let i = filterAt - 1;
  while (i >= 0 && /\s/.test(sql[i])) i -= 1;
  if (sql[i] !== ")") return null;

  const closeParen = i;
  let depth = 0;
  for (; i >= 0; i -= 1) {
    if (sql[i] === ")") depth += 1;
    if (sql[i] === "(") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (i < 0) return null;

  const openParen = i;
  while (i > 0 && /\w/.test(sql[i - 1])) i -= 1;
  const name = sql.slice(i, openParen);
  if (!name) return null;

  return { name, args: sql.slice(openParen + 1, closeParen), start: i };
}

function translateFilterClause(sql) {
  let out = sql;
  let guard = 0;

  for (;;) {
    if ((guard += 1) > 100) break;

    const match = /\bFILTER\s*\(/i.exec(out);
    if (!match) return out;

    const openParen = match.index + match[0].length - 1;
    const group = readGroup(out, openParen);
    const aggregate = readAggregate(out, match.index);
    if (!group || !aggregate) return out;

    const condition = group.inner.replace(/^\s*WHERE\s+/i, "").trim();
    const args = aggregate.args.trim();
    const value = args === "*" ? "1" : args;

    out =
      out.slice(0, aggregate.start) +
      `${aggregate.name}(CASE WHEN ${condition} THEN ${value} END)` +
      out.slice(group.end);
  }
  return out;
}

module.exports = { translateFilterClause };
