const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("authenticated users can refresh an active session without a refresh-token table", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/auth.routes.js"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../src/services/auth.service.js"),
    "utf8",
  );

  assert.match(routes, /router\.post\("\/refresh", authenticateToken/);
  assert.match(service, /async function refreshSession/);
  assert.match(service, /WHERE u\.id = \$1[\s\S]*u\.is_active = true/);
  assert.doesNotMatch(service, /INSERT INTO refresh_tokens/);
});

test("password reset tokens are handled through the internal RLS context", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../src/services/auth.service.js"),
    "utf8",
  );

  assert.match(service, /runWithDbContext/);
  assert.match(
    service,
    /async function createPasswordResetToken[\s\S]*runWithDbContext[\s\S]*INSERT INTO password_reset_tokens/,
  );
  assert.match(
    service,
    /async function confirmPasswordReset[\s\S]*runWithDbContext[\s\S]*FROM password_reset_tokens/,
  );
  assert.match(
    service,
    /async function confirmPasswordReset[\s\S]*runWithDbContext[\s\S]*UPDATE password_reset_tokens SET used_at/,
  );
});
