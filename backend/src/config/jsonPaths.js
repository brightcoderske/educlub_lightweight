/**
 * PostgreSQL walks JSON one key at a time and takes bare key names:
 *
 *   la.content -> 'module_badge' ->> 'name'
 *
 * MySQL collapses that into a single path expression with the -> and ->>
 * operators, but MariaDB has neither: its JSON support is function-based, and
 * its parser rejects the operator outright. cPanel ships MariaDB, so the whole
 * chain becomes the functions both engines accept:
 *
 *   JSON_UNQUOTE(JSON_EXTRACT(la.content, '$.module_badge.name'))
 *
 * The final operator decides the result type - `->>` unquotes to text, `->`
 * stays JSON - so the chain keeps whichever one it ended with.
 *
 * Shared by the schema translation and the runtime rewrite in sqlDialect.js,
 * because the application writes this syntax in its own queries too.
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

    // A single step that is already a MySQL path keeps it; anything else is a
    // PostgreSQL key chain and becomes one.
    const path =
      keys.length === 1 && keys[0].startsWith("$") ? keys[0] : `$.${keys.join(".")}`;

    const extract = `JSON_EXTRACT(${column}, '${path}')`;
    return unquote ? `JSON_UNQUOTE(${extract})` : extract;
  });
}

module.exports = { translateJsonPaths };
