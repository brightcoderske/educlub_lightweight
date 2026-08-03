const test = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/validation/auth.validation");
const { formatIssues } = require("../src/middleware/validation.middleware");

test("authentication validation normalizes identifiers and rejects mass assignment", () => {
  const parsed = auth.login.parse({ email: "  USER@Example.COM ", password: "Password1!" });
  assert.equal(parsed.email, "user@example.com");
  assert.throws(
    () => auth.login.parse({ email: "user@example.com", password: "Password1!", role: "system_admin" }),
    /unrecognized key/i,
  );
});

test("MFA validation accepts exactly six digits", () => {
  const base = { tempToken: "x".repeat(40), rememberDevice: false };
  assert.equal(auth.verifyMfa.parse({ ...base, code: "012345" }).code, "012345");
  assert.throws(() => auth.verifyMfa.parse({ ...base, code: "12345" }));
  assert.throws(() => auth.verifyMfa.parse({ ...base, code: "12345a" }));
});

test("validation issues produce stable field-keyed errors", () => {
  const result = auth.passwordResetConfirm.safeParse({ token: "short", newPassword: "tiny" });
  assert.equal(result.success, false);
  const errors = formatIssues(result.error.issues);
  assert.ok(errors.token.length > 0);
  assert.ok(errors.newPassword.length > 0);
});
