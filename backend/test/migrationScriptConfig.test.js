const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

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

// cPanel grants the database account as user@localhost, and MariaDB honours
// that only for connections over the unix socket. A TCP connection to
// 127.0.0.1 or ::1 reports a different host, matches no grant, and is refused
// with the same "access denied" message a wrong password produces - which is
// why this cost an afternoon to identify the first time.
test("every entry point can connect over a unix socket", () => {
  for (const relativePath of [...SCRIPTS, "src/config/db.js"]) {
    const text = source(relativePath);
    assert.match(
      text,
      /MYSQL_SOCKET/,
      `${relativePath} must honour MYSQL_SOCKET`,
    );
    assert.match(
      text,
      /socketPath/,
      `${relativePath} must pass socketPath to mysql2`,
    );
  }
});

// Asserted against the pool mysql2 actually builds rather than the source, so
// this keeps holding if the settings are rearranged. Creating a pool opens no
// connection, so nothing here needs a database.
function poolConfig(env) {
  // db.js exports a wrapper presenting the node-postgres surface, so the mysql2
  // pool it was built from is one level down.
  const script =
    'const { pool } = require("./src/config/db");' +
    'const c = pool.pool.config.connectionConfig;' +
    'console.log(JSON.stringify({ socketPath: c.socketPath, host: c.host, port: c.port, database: c.database }));';
  const output = execFileSync(process.execPath, ["-e", script], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return JSON.parse(output.trim().split("\n").pop());
}

test("MYSQL_SOCKET makes the pool connect over the socket, not TCP", () => {
  const config = poolConfig({
    MYSQL_SOCKET: "/var/lib/mysql/mysql.sock",
    MYSQL_USER: "educlub",
    MYSQL_DATABASE: "educlub",
    DATABASE_URL: "mysql://educlub:pw@127.0.0.1:3306/educlub",
  });

  // The socket has to win even though DATABASE_URL names a host, because that
  // URL is what the cutover builds and the grant is still user@localhost.
  // mysql2 leaves its own default in host and ignores it once socketPath is
  // set, so the socket being present is the property that matters.
  assert.equal(config.socketPath, "/var/lib/mysql/mysql.sock");
  assert.equal(config.database, "educlub");
});

test("without MYSQL_SOCKET the pool still connects over TCP", () => {
  const config = poolConfig({
    MYSQL_SOCKET: "",
    MYSQL_HOST: "127.0.0.1",
    MYSQL_PORT: "3306",
    MYSQL_USER: "educlub",
    MYSQL_DATABASE: "educlub",
    DATABASE_URL: "",
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3306);
  assert.ok(!config.socketPath, "socketPath should be unset");
});
