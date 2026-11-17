#!/usr/bin/env node
/**
 * Rewrites stored upload addresses from a full address to the path alone:
 *   https://learn.educlub.co.ke/uploads/school-logos/a.png  ->  /uploads/school-logos/a.png
 *
 * Uploads used to be saved with the host they were uploaded on, which tied
 * every logo, banner, activity image and learner's file to that domain. Once
 * the site and the API share one address, the path alone is all a page needs.
 *
 * Every text and JSON column in the database is checked, so nothing that holds
 * an upload address is missed (course HTML, quiz images, submissions...). The
 * same replacement is made everywhere, so a course and the template it was
 * copied from stay identical.
 *
 *   node scripts/rewrite-upload-urls.js            list what would change; change nothing
 *   node scripts/rewrite-upload-urls.js --apply    make the change
 *   ... --host other.example.com                   also rewrite that host (repeatable)
 *
 * Running it again changes nothing: a path alone no longer matches.
 */
require("../src/config/loadEnv").loadEnv();
const { query, pool } = require("../src/config/db");

const DEFAULT_HOSTS = ["learn.educlub.co.ke", "educlub.co.ke", "www.educlub.co.ke"];

function options(argv) {
  const hosts = [...DEFAULT_HOSTS];
  argv.forEach((arg, index) => {
    if (arg === "--host" && argv[index + 1]) hosts.push(argv[index + 1]);
  });
  return { apply: argv.includes("--apply"), hosts };
}

// Each old prefix and its replacement, in plain and in JSON-escaped form
// (JSON may store "/" as "\/").
function replacements(hosts) {
  return hosts.flatMap((host) =>
    ["https", "http"].flatMap((scheme) => [
      [`${scheme}://${host}/uploads/`, "/uploads/"],
      [`${scheme}:\\/\\/${host}\\/uploads\\/`, "\\/uploads\\/"],
    ]),
  );
}

const quoteId = (name) => `\`${String(name).replace(/`/g, "``")}\``;

async function main() {
  const { apply, hosts } = options(process.argv.slice(2));
  const pairs = replacements(hosts);

  const columns = await query(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND DATA_TYPE IN ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'json')
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  );

  const matches = pairs.map(() => "INSTR(col, ?) > 0").join(" OR ");
  let total = 0;
  for (const { table_name: table, column_name: column } of columns.rows) {
    const col = `${quoteId(table)}.${quoteId(column)}`;
    const where = matches.replace(/col/g, col);
    const found = await query(
      `SELECT COUNT(*) AS count FROM ${quoteId(table)} WHERE ${where}`,
      pairs.map(([from]) => from),
    );
    const count = Number(found.rows[0].count);
    if (!count) continue;
    total += count;
    console.log(`${String(count).padStart(6)}  ${table}.${column}`);

    if (apply) {
      const replaced = pairs.reduce((expression) => `REPLACE(${expression}, ?, ?)`, col);
      await query(
        `UPDATE ${quoteId(table)} SET ${col} = ${replaced} WHERE ${where}`,
        [...pairs.flat(), ...pairs.map(([from]) => from)],
      );
    }
  }

  if (!total) {
    console.log("No stored upload addresses use those hosts. Nothing to do.");
  } else if (apply) {
    console.log(`\nRewrote ${total} value(s) to /uploads/... paths.`);
  } else {
    console.log(`\n${total} value(s) would change. Run again with --apply to rewrite them.`);
  }
}

main()
  .catch((error) => {
    console.error("Rewrite failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
