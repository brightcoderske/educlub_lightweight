const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("self-registration assigns a configured academic term in the same transaction", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../src/services/publicRegistration.service.js"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/public.routes.js"),
    "utf8",
  );

  assert.match(routes, /router\.get\("\/terms"/);
  assert.match(service, /async function listPublicTerms/);
  assert.match(
    service,
    /INSERT INTO learners \(user_id, school_id, full_name, email, grade, term, academic_year\)/,
  );
  assert.match(service, /CURRENT_DATE BETWEEN t\.start_date AND t\.end_date/);
});

test("self-registration schedules slow post-registration work after commit", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../src/services/publicRegistration.service.js"),
    "utf8",
  );

  assert.match(service, /function schedulePostRegistrationTasks/);
  assert.match(service, /setImmediate/);
  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /await client\.query\("COMMIT"\)/);
  assert.match(service, /schedulePostRegistrationTasks\(\{/);
});
