/**
 * Database Migration Script
 * Runs the schema.sql file to create/initialize the database
 */

const fs = require("fs");
const path = require("path");
require("../backend/node_modules/dotenv").config({
  path: path.join(__dirname, "../backend/.env"),
});
const { query, pool } = require("../backend/src/config/db");

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    current += char;

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        current += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += sql.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (quote) {
      if (char === quote && next === quote) {
        current += next;
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += next;
      i += 1;
      lineComment = true;
      continue;
    }

    if (char === "/" && next === "*") {
      current += next;
      i += 1;
      blockComment = true;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        current += match[0].slice(1);
        i += match[0].length - 1;
        dollarTag = match[0];
      }
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function runMigration() {
  try {
    console.log("Starting database migration...");

    // Read the schema file
    const schemaPath = path.join(
      __dirname,
      "../backend/src/database/schema.sql"
    );
    const schema = fs.readFileSync(schemaPath, "utf8");

    const statements = splitSqlStatements(schema);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        await query(statements[i]);
        console.log(
          `Statement ${i + 1}/${statements.length} executed successfully`
        );
      } catch (error) {
        // Ignore errors for "IF NOT EXISTS" statements
        if (!error.message.includes("already exists")) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
        }
      }
    }

    console.log("Database migration completed successfully");

    // Close the pool
    await pool.end();

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
