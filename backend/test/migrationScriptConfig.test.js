const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// scripts/deploy-cpanel-git.sh runs `npm run db:migrate` on every release, from
// a shell where cPanel has put nothing in the environment. backend/.env is the
// only record of the connection settings, so a migration script that does not
// load it silently migrates root@127.0.0.1/educlub instead of the real
// database. These assertions exist because that failure is invisible: the
// script connects to something, and reports success against the wrong target.
function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

const SCRIPTS = [
  "scripts/mysql-migration/apply-schema.js",
  "scripts/mysql-migration/seed-admin.js",
];

for (const relativePath of SCRIPTS) {
  test(`${path.basename(relativePath)} loads backend/.env`, () => {
    const text = source(relativePath);
    assert.match(
      text,
      /require\("dotenv"\)\.config\(\{\s*path:\s*path\.resolve\(__dirname,\s*"\.\.\/\.\.\/\.env"\)/,
      "must read backend/.env, which is where the deployment keeps the settings",
    );
  });

  test(`${path.basename(relativePath)} accepts a single DATABASE_URL`, () => {
    const text = source(relativePath);
    assert.match(text, /function fromDatabaseUrl\(\)/);
    // Matching src/config/db.js: a URL that is not mysql is ignored rather than
    // guessed at, so a leftover postgresql:// URL cannot be read as a target.
    assert.match(text, /\/\^mysql:\/i\.test\(value\)/);
    assert.match(text, /decodeURIComponent\(parsed\.password/);
  });
}

test("the discrete settings still win over the URL", () => {
  // The cutover writes both forms. If the URL took precedence, correcting a
  // single setting in cPanel would appear to do nothing.
  for (const relativePath of SCRIPTS) {
    const text = source(relativePath);
    assert.match(text, /process\.env\.MYSQL_HOST \|\| url\.host/);
    assert.match(text, /process\.env\.MYSQL_DATABASE \|\| url\.database/);
  }
});

test("an empty password in the URL does not become the string 'undefined'", () => {
  for (const relativePath of SCRIPTS) {
    const text = source(relativePath);
    assert.match(text, /password:.*\?\?\s*url\.password\s*\?\?\s*""/);
  }
});
