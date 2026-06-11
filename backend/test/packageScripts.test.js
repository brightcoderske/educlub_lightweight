const test = require("node:test");
const assert = require("node:assert/strict");
const packageJson = require("../package.json");

test("exposes backend tests and the Web Development 1 importer", () => {
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
  assert.equal(
    packageJson.scripts["import:web-development-1"],
    "node scripts/import-web-development-1.js",
  );
});
