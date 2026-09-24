const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const deploymentScript = fs.readFileSync(
  path.join(__dirname, "../../scripts/deploy-cpanel-git.sh"),
  "utf8",
);

test("cPanel deployment copies and restores backend utility scripts", () => {
  assert.match(deploymentScript, /cp -a "\$APP_ROOT\/scripts" "\$BACKUP_DIR\/scripts"/);
  assert.match(deploymentScript, /rm -rf "\$APP_ROOT\/scripts"/);
  assert.match(deploymentScript, /cp -a "\$BACKUP_DIR\/scripts" "\$APP_ROOT\/scripts"/);
  assert.match(
    deploymentScript,
    /cp -a "\$SOURCE_ROOT\/backend\/scripts" "\$APP_ROOT\/scripts"/,
  );
});

test("cPanel deployment migrates the database before restarting", () => {
  // Assert the ordering itself rather than the two commands being adjacent, so
  // that adding progress output between them does not fail the deployment.
  // Only the deployment body counts: the rollback function is defined earlier in
  // the file but runs on failure, and it restarts without migrating on purpose.
  const trapAt = deploymentScript.indexOf("trap rollback ERR");
  assert.ok(trapAt > -1, "the deployment must install its rollback trap");
  const deploymentBody = deploymentScript.slice(trapAt);

  const migrateAt = deploymentBody.indexOf("npm run db:migrate");
  const restartAt = deploymentBody.indexOf('touch "$APP_ROOT/tmp/restart.txt"');
  assert.ok(migrateAt > -1, "the deployment must run database migrations");
  assert.ok(restartAt > -1, "the deployment must request a Passenger restart");
  assert.ok(
    migrateAt < restartAt,
    "migrations must finish before the application is restarted",
  );
});

test("cPanel deployment reports on outgoing mail without ever rolling back for it", () => {
  // The deploy log is the only record an operator sees, and "deployed but email
  // still does not work" is answered by the mail settings and the server's own
  // reply appearing in it. A mail problem must never undo a healthy release, so
  // the check runs after the rollback trap is cleared and cannot fail the script.
  const trapClearedAt = deploymentScript.indexOf("trap - ERR");
  const mailCheckAt = deploymentScript.indexOf("npm run --silent email:verify");
  assert.ok(trapClearedAt > -1, "the trap is cleared once the release is healthy");
  assert.ok(mailCheckAt > -1, "the deployment must check outgoing mail");
  assert.ok(
    trapClearedAt < mailCheckAt,
    "the mail check runs after the rollback trap is cleared",
  );
  assert.match(
    deploymentScript,
    /if ! npm run --silent email:verify; then/,
    "a refused mail login must be handled, not left to set -e",
  );
});

test("every step the deployment announces is counted in TOTAL_STEPS", () => {
  const announced = deploymentScript.match(/^\s*step "/gm) || [];
  const declared = Number(deploymentScript.match(/^TOTAL_STEPS=(\d+)/m)[1]);
  assert.equal(declared, announced.length);
});
