const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("learner password reset supports staff-provided temporary passwords", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../src/controllers/learners.controller.js"),
    "utf8"
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/learners.routes.js"),
    "utf8"
  );

  assert.match(routes, /:id\/reset-password/);
  assert.match(routes, /requireRole\("system_admin", "school_admin"\)/);
  assert.match(controller, /temporary_password/);
  assert.match(controller, /force_password_reset = true/);
  assert.match(controller, /learner_temporary_password_issued/);
});
