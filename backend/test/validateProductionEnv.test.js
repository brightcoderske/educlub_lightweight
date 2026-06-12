const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateProductionEnv,
} = require("../src/config/validateProductionEnv");

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    JWT_SECRET: "a".repeat(64),
    FRONTEND_URL: "https://educlub.co.ke",
    PUBLIC_BASE_URL: "https://learn.educlub.co.ke",
    CORS_ORIGINS: "https://educlub.co.ke,https://www.educlub.co.ke",
    EMAIL_HOST: "mail.educlub.co.ke",
    EMAIL_PORT: "465",
    EMAIL_SECURE: "true",
    EMAIL_USER: "noreply@educlub.co.ke",
    EMAIL_FROM: "eduClub <noreply@educlub.co.ke>",
    EMAIL_REPLY_TO: "support@educlub.co.ke",
    ...overrides,
  };
}

test("accepts the eduClub production URL layout", () => {
  assert.doesNotThrow(() => validateProductionEnv(productionEnv()));
});

test("rejects a weak production JWT secret", () => {
  assert.throws(
    () => validateProductionEnv(productionEnv({ JWT_SECRET: "password" })),
    /JWT_SECRET must be at least 32 characters/,
  );
});

test("requires HTTPS public URLs in production", () => {
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ PUBLIC_BASE_URL: "http://learn.educlub.co.ke" }),
      ),
    /PUBLIC_BASE_URL must use HTTPS/,
  );
});

test("rejects localhost and wildcard CORS origins in production", () => {
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({
          CORS_ORIGINS: "https://educlub.co.ke,http://localhost:3000,*",
        }),
      ),
    /CORS_ORIGINS must contain only explicit HTTPS origins/,
  );
});

test("rejects malformed production email addresses", () => {
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ EMAIL_REPLY_TO: "support-at-educlub.co.ke" }),
      ),
    /EMAIL_REPLY_TO must contain a valid email address/,
  );
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ EMAIL_FROM: "eduClub noreply-at-educlub.co.ke" }),
      ),
    /EMAIL_FROM must contain a valid email address/,
  );
});

test("rejects unsupported or inconsistent SMTP security settings", () => {
  assert.throws(
    () => validateProductionEnv(productionEnv({ EMAIL_PORT: "25" })),
    /EMAIL_PORT must be 465 or 587/,
  );
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ EMAIL_PORT: "465", EMAIL_SECURE: "false" }),
      ),
    /EMAIL_SECURE must be true when EMAIL_PORT is 465/,
  );
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ EMAIL_PORT: "587", EMAIL_SECURE: "true" }),
      ),
    /EMAIL_SECURE must be false when EMAIL_PORT is 587/,
  );
  assert.throws(
    () =>
      validateProductionEnv(
        productionEnv({ EMAIL_PORT: "587", EMAIL_SECURE: "sometimes" }),
      ),
    /EMAIL_SECURE must be true or false/,
  );
});
