const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { normalizeDraftContent } = require("../src/services/activityDrafts.service");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("a draft keeps only the editor fields, as text", () => {
  const stored = JSON.parse(
    normalizeDraftContent({ code: "print(1)\n", html: "<p>", js: 5, file: { url: "/x" }, role: "admin" }),
  );
  assert.deepEqual(stored, { code: "print(1)\n", html: "<p>" });
});

test("an oversized draft is refused with a message the learner can act on", () => {
  assert.throws(
    () => normalizeDraftContent({ code: "x".repeat(300 * 1024) }),
    (error) => error.statusCode === 413 && /too large/.test(error.message),
  );
});

test("a save only lands on the revision the page last saw", () => {
  const service = read("src/services/activityDrafts.service.js");
  assert.match(service, /WHERE learner_id = \$2 AND activity_id = \$3 AND revision = \$4/);
  assert.match(service, /httpError\(409/);
});

test("draft routes are learner-only and autosave skips the shared per-IP limit", () => {
  const routes = read("src/routes/courses.routes.js");
  assert.match(routes, /"\/activities\/:activityId\/draft",\s*authenticateToken,\s*requireRole\("learner"\),\s*draftSaveLimiter/);
  assert.match(routes, /"\/activities\/:activityId\/work",\s*authenticateToken,\s*requireRole\("learner"\)/);

  const server = read("src/server.js");
  const skip = server.match(/skip: \(req\) => (.+),\r?\n/)[1];
  const skipped = new Function("req", `return ${skip};`);
  assert.equal(skipped({ method: "PUT", path: "/courses/activities/42/draft" }), true);
  assert.equal(skipped({ method: "POST", path: "/courses/activities/42/submissions" }), false);
  assert.equal(skipped({ method: "PUT", path: "/courses/activities/42/draft/../progress" }), false);
});

test("the drafts table ships in the schema the deploy applies", () => {
  assert.match(read("src/database/schema.sql"), /CREATE TABLE IF NOT EXISTS activity_drafts/);
  assert.match(read("scripts/mysql-migration/schema.mysql.sql"), /CREATE TABLE IF NOT EXISTS activity_drafts/);
});
