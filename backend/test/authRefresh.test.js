const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("refresh uses rotating hashed server-side sessions without requiring an access token", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/auth.routes.js"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../src/services/session.service.js"),
    "utf8",
  );

  assert.match(routes, /router\.post\("\/refresh"[\s\S]*authController\.refreshSession/);
  assert.doesNotMatch(routes, /router\.post\("\/refresh", authenticateToken/);
  assert.match(service, /async function rotateSession/);
  assert.match(service, /refresh_token_hash/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /token_reuse/);
});

test("MFA codes are hashed, attempt-limited, and compared in constant time", () => {
  const service = fs.readFileSync(path.join(__dirname, "../src/services/auth.service.js"), "utf8");
  assert.match(service, /createHmac\("sha256"/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /mfa_code_attempts[\s\S]*>= 5/);
  assert.doesNotMatch(service, /SET mfa_code = \$1/);
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
