/**
 * MariaDB keeps a CHECK written on a column (`sender_role VARCHAR(50) CHECK
 * (...)`) as part of that column, named after it. `ALTER TABLE ... DROP
 * CONSTRAINT sender_role` refuses it ("Can't DROP CONSTRAINT ... check that it
 * exists") even though information_schema lists it. The only way to remove it
 * is to redefine the column without the CHECK, keeping everything else.
 *
 * Kept in its own module because the rewrite is pure and worth testing
 * directly: it is applied to a live production table.
 */

// The column's line from SHOW CREATE TABLE, e.g.
//   `sender_role` varchar(50) NOT NULL CHECK (`sender_role` in ('a','b')),
function columnDefinition(createTable, column) {
  const prefix = `\`${column}\` `;
  const line = createTable.split("\n").find((row) => row.trim().startsWith(prefix));
  return line ? line.trim().replace(/,$/, "") : null;
}

// The definition with its CHECK (...) removed. Parentheses inside quoted
// strings do not count, so a rule mentioning ')' cannot cut it short.
function withoutColumnCheck(definition) {
  const start = definition.search(/\sCHECK\s*\(/i);
  if (start === -1) return definition;
  let index = definition.indexOf("(", start);
  let depth = 0;
  let quote = null;
  for (; index < definition.length; index += 1) {
    const char = definition[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`Unbalanced CHECK in column definition: ${definition}`);
  return `${definition.slice(0, start)}${definition.slice(index + 1)}`.replace(/\s+/g, " ").trim();
}

// The statement that removes a column-level CHECK on MariaDB.
function dropColumnCheckStatement(table, createTable, column) {
  const definition = columnDefinition(createTable, column);
  if (!definition) throw new Error(`Column ${table}.${column} not found in SHOW CREATE TABLE`);
  return `ALTER TABLE \`${table}\` MODIFY COLUMN ${withoutColumnCheck(definition)}`;
}

module.exports = { columnDefinition, withoutColumnCheck, dropColumnCheckStatement };
