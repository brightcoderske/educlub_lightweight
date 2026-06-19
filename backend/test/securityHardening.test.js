const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

Object.assign(process.env, {
  DATABASE_URL: "postgres://localhost/educlub_test",
  JWT_SECRET: "test-secret",
  EMAIL_HOST: "localhost",
  EMAIL_PORT: "1025",
  EMAIL_USER: "test@example.com",
  EMAIL_PASSWORD: "test-password",
  DEFAULT_ADMIN_PASSWORD: "test-password",
  DEFAULT_SCHOOL_ADMIN_PASSWORD: "test-password",
  DEFAULT_LEARNER_PASSWORD: "test-password",
  SYSTEM_ADMIN_EMAIL: "admin@example.com",
  FRONTEND_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3000",
});

const { isAllowedSubmissionFile } = require("../src/controllers/courses.controller");
const { sanitizeRichHtml } = require("../src/utils/richTextSanitizer");
const { isSuspiciousPath } = require("../src/middleware/security.middleware");

test("security middleware configures browser hardening and blocked paths", () => {
  const server = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");
  const middleware = fs.readFileSync(
    path.join(__dirname, "../src/middleware/security.middleware.js"),
    "utf8",
  );

  assert.match(server, /securityHeaders/);
  assert.match(server, /blockSuspiciousPaths/);
  assert.match(middleware, /"frame-ancestors": \["'self'"\]/);
  assert.match(middleware, /hsts:/);
  assert.match(middleware, /Permissions-Policy/);
  assert.equal(isSuspiciousPath("/wp-login.php"), true);
  assert.equal(isSuspiciousPath("/uploads/shell.exe"), true);
  assert.equal(isSuspiciousPath("/api/courses"), false);
});

test("login failures use a generic response and audit attempts", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../src/controllers/auth.controller.js"),
    "utf8",
  );

  assert.match(controller, /Invalid login details/);
  assert.match(controller, /recordSecurityEvent/);
  const loginStart = controller.indexOf("async function login");
  const verifyStart = controller.indexOf("async function verify2FA");
  const loginFunction = controller.slice(loginStart, verifyStart);
  assert.match(loginFunction, /Invalid login details/);
  assert.doesNotMatch(loginFunction, /error: error\.message/);
});

test("file submission policy rejects dangerous extension spoofing", () => {
  assert.equal(isAllowedSubmissionFile("avatar.php", "image/png"), false);
  assert.equal(isAllowedSubmissionFile("installer.exe", "application/pdf"), false);
  assert.equal(isAllowedSubmissionFile("notes.pdf", "application/pdf"), true);
  assert.equal(isAllowedSubmissionFile("maze.sb3", "application/zip"), true);
});

test("rich HTML sanitizer strips scriptable content but keeps eduClub blocks", () => {
  const encodedSandbox = encodeURIComponent(
    JSON.stringify({
      html: "<button>Run</button>",
      css: "button { color: teal; }",
      js: "document.body.dataset.ready = '1';",
    }),
  );
  const html = sanitizeRichHtml(
    `<div data-interactive-block="flash_card" data-block-title="Card" onclick="steal()">
       <button data-interactive-toggle="true">Show answer</button>
       <div data-interactive-answer="true">Answer</div>
     </div>
     <div data-executable-code="${encodedSandbox}" data-code-title="Sandboxed demo"></div>
     <img src="javascript:alert(1)" onerror="steal()">
     <a href="javascript:alert(1)">Bad</a>
     <script>alert(1)</script>`,
  );

  assert.match(html, /data-interactive-block="flash_card"/);
  assert.match(html, /data-interactive-toggle="true"/);
  assert.match(html, /data-executable-code="/);
  assert.match(html, /data-code-title="Sandboxed demo"/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /onclick/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /javascript:/i);
});

test("rich HTML sanitizer removes unsafe CSS execution", () => {
  const html = sanitizeRichHtml(`<p style="color:red;background:url(javascript:alert(1))">Hi</p>`);

  assert.match(html, /style="color:red;background:/);
  assert.doesNotMatch(html, /javascript:/i);
});
