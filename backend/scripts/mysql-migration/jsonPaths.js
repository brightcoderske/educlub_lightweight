/**
 * PostgreSQL walks JSON one key at a time and takes bare key names:
 *
 *   la.content -> 'module_badge' ->> 'name'
 *
 * MySQL takes a single JSON path expression instead, so the whole chain
 * collapses into one operator:
 *
 *   la.content ->> '$.module_badge.name'
 *
 * The final operator decides the result type - `->>` unquotes to text, `->`
 * stays JSON - so the chain keeps whichever one it ended with.
 */

// column (optionally table-qualified) followed by one or more -> / ->> steps
const CHAIN = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)((?:\s*->>?\s*'[^']+')+)/g;
const STEP = /->(>?)\s*'([^']+)'/g;

function translateJsonPaths(sql) {
  return sql.replace(CHAIN, (match, column, steps) => {
    const keys = [];
    let unquote = false;

    for (const step of steps.matchAll(STEP)) {
      unquote = step[1] === ">";
      keys.push(step[2]);
    }
    if (!keys.length) return match;

    // Already a MySQL path expression - leave it alone.
    if (keys.length === 1 && keys[0].startsWith("$")) return match;

    return `${column}${unquote ? "->>" : "->"}'$.${keys.join(".")}'`;
  });
}

module.exports = { translateJsonPaths };
