const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("report card settings are school scoped and additive", () => {
  const schema = read("../src/database/schema.sql");
  const startup = read("../src/services/startupSchema.service.js");
  const routes = read("../src/routes/reports.routes.js");
  const controller = read("../src/controllers/reports.controller.js");
  const service = read("../src/services/reports.service.js");

  assert.match(schema, /report_card_settings JSONB/);
  assert.match(startup, /report_card_settings JSONB/);
  assert.match(routes, /\/settings/);
  assert.match(controller, /getReportCardSettings/);
  assert.match(controller, /saveReportCardSettings/);
  assert.match(service, /function normalizeReportCardSettings/);
  assert.match(service, /show_badges/);
  assert.match(service, /show_competitions/);
  assert.doesNotMatch(service, /show_certificates/);
});

test("report cards draw term badges and competitions without certificate sections", () => {
  const service = read("../src/services/reports.service.js");

  assert.match(service, /getTermBadges/);
  assert.match(service, /drawBadgeGrid/);
  assert.match(service, /getLearnerCompetitionResults/);
  assert.match(service, /COMPETITIONS/);
  assert.match(service, /BADGES EARNED THIS TERM/);
  assert.doesNotMatch(service, /CERTIFICATES/);
});

test("competition positions are live-calculated instead of using stored ranks", () => {
  const service = read("../src/services/competitions.service.js");

  assert.match(service, /RANK\(\) OVER/);
  assert.doesNotMatch(service, /COALESCE\(\s*cr\.rank/);
});
