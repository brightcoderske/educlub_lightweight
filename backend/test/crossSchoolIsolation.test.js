const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The application connects to Postgres as a BYPASSRLS role (see migration 008),
// so the row level security policies in schema.sql protect only the Supabase
// API roles. Every tenant boundary the API itself relies on has to be in the
// request path, which is what these assertions pin down.
function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

function handler(text, name) {
  const start = text.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const next = text.indexOf("\nasync function ", start + 1);
  return text.slice(start, next === -1 ? text.length : next);
}

test("the school directory is scoped to the caller's own school", () => {
  const controller = source("src/controllers/schools.controller.js");

  const list = handler(controller, "getAllSchools");
  assert.match(list, /req\.user\.role !== "system_admin"/);
  assert.match(list, /WHERE s\.id = \$\$\{params\.length\}::integer/);

  const single = handler(controller, "getSchoolById");
  assert.match(single, /Number\(req\.params\.id\) !== ownSchoolId\(req\.user\)/);
  assert.match(single, /School is outside your access/);
});

test("course reports are staff only and cannot cross a school boundary", () => {
  const reports = handler(
    source("src/controllers/reports.controller.js"),
    "getCourseReports",
  );

  assert.match(reports, /req\.user\.role === "learner"/);
  assert.match(reports, /Course reports are staff only/);
  assert.match(reports, /Number\(course\.school_id\) !== Number\(req\.user\.schoolId\)/);
});

test("per-learner leaderboard lookups check access before answering", () => {
  const controller = source("src/controllers/leaderboard.controller.js");

  for (const name of [
    "getLearnerPosition",
    "getLearnerTrend",
    "getLearnerWeeklySummary",
    "getLearnerCourseProgress",
  ]) {
    assert.match(
      handler(controller, name),
      /ensureLearnerAccess\(req, (Number\()?learnerId\)?\)/,
      `${name} answers without an access check`,
    );
  }
});

test("weekly result sync and the weekly course list stay inside one school", () => {
  const controller = source("src/controllers/weeklyLearning.controller.js");

  const sync = handler(controller, "syncWeeklyResults");
  assert.match(sync, /req\.user\.role !== "system_admin"/);
  assert.match(sync, /l\.school_id = \$\$\{params\.length\}::integer/);

  const courses = handler(controller, "getWeeklyCourses");
  assert.match(courses, /c\.school_id = \$\$\{params\.length\}::integer/);
});

test("a school admin without a school sees nobody rather than everybody", () => {
  const users = handler(source("src/controllers/users.controller.js"), "getUsers");

  assert.match(users, /if \(!Number\.isInteger\(schoolId\) \|\| schoolId <= 0\)/);
  assert.match(users, /return res\.json\(\[\]\)/);
});

test("school id comparisons are numeric so a string token cannot slip through", () => {
  const files = [
    "src/controllers/learners.controller.js",
    "src/controllers/reports.controller.js",
    "src/controllers/leaderboard.controller.js",
    "src/controllers/users.controller.js",
  ];

  for (const file of files) {
    const text = source(file);
    assert.doesNotMatch(
      text,
      /(learner|user)\.school_id !== req\.user\.schoolId/,
      `${file} compares school ids without normalising`,
    );
    assert.doesNotMatch(
      text,
      /(learner|user)\.school_id === (req\.)?user\.schoolId/,
      `${file} compares school ids without normalising`,
    );
  }
});
