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
