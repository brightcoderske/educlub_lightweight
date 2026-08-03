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
  assert.match(deploymentScript, /npm run db:migrate\s+mkdir -p "\$APP_ROOT\/tmp"/);
});
