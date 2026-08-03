const test = require("node:test");
const assert = require("node:assert/strict");
const packageJson = require("../package.json");

test("exposes backend tests and the Web Development 1 importer", () => {
  assert.equal(packageJson.scripts.test, "node --require ./test/setup-env.js --test test/*.test.js");
  assert.equal(packageJson.scripts["db:migrate"], "node src/database/migrationRunner.js");
  assert.equal(packageJson.scripts["email:verify"], "node scripts/verify-email.js");
  assert.equal(
    packageJson.scripts["import:web-development-1"],
    "node scripts/import-web-development-1.js",
  );
  assert.equal(
    packageJson.scripts["import:scratch-pathway"],
    "node scripts/import-scratch-pathway.js",
  );
});

test("Scratch pathway importer includes all four Scratch templates", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../scripts/import-scratch-pathway.js"),
    "utf8",
  );
  for (const templateName of [
    "scratchIntermediate.template",
    "scratchExplorer.template",
    "scratchCreator.template",
    "scratchInnovator.template",
  ]) {
    assert.match(source, new RegExp(templateName.replace(".", "\\.")));
  }
});
