const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("AI settings routes are authenticated and system-admin controlled", () => {
  const routes = read("../src/routes/ai.routes.js");
  const server = read("../src/server.js");

  assert.match(server, /app\.use\("\/api\/ai", aiRoutes\)/);
  assert.match(routes, /router\.get\("\/availability", authenticateToken/);
  assert.match(
    routes,
    /router\.get\([\s\S]*"\/settings"[\s\S]*requireRole\("system_admin"\)/,
  );
  assert.match(
    routes,
    /router\.put\([\s\S]*"\/settings"[\s\S]*requireRole\("system_admin"\)/,
  );
  assert.match(
    routes,
    /router\.get\([\s\S]*"\/school-settings"[\s\S]*requireRole\("school_admin", "teacher"\)/,
  );
  assert.match(
    routes,
    /router\.put\([\s\S]*"\/school-settings"[\s\S]*requireRole\("school_admin"\)/,
  );
  assert.match(
    routes,
    /router\.post\([\s\S]*"\/course-builder\/activity"[\s\S]*requireRole\("system_admin", "school_admin", "teacher"\)/,
  );
});

test("AI startup schema is additive and keeps provider secrets server-side", () => {
  const startupSchema = read("../src/services/startupSchema.service.js");
  const service = read("../src/services/aiSettings.service.js");
  const controller = read("../src/controllers/ai.controller.js");

  assert.match(startupSchema, /CREATE TABLE IF NOT EXISTS ai_settings/);
  assert.match(startupSchema, /CREATE TABLE IF NOT EXISTS ai_providers/);
  assert.match(startupSchema, /CREATE TABLE IF NOT EXISTS ai_role_limits/);
  assert.match(startupSchema, /CREATE TABLE IF NOT EXISTS school_ai_settings/);
  assert.match(startupSchema, /CREATE TABLE IF NOT EXISTS ai_usage_logs/);
  assert.match(startupSchema, /ENABLE ROW LEVEL SECURITY/);
  assert.match(startupSchema, /ai_settings_authenticated_read/);
  assert.match(startupSchema, /school_ai_settings_school_admin_update/);
  assert.match(startupSchema, /school_ai_settings_school_read/);
  assert.match(service, /api_key_ciphertext IS NOT NULL AS api_key_configured/);
  assert.match(service, /teacher_enabled/);
  assert.match(service, /learner_enabled/);
  assert.match(service, /createCipheriv\("aes-256-gcm"/);
  assert.doesNotMatch(controller, /api_key_ciphertext/);
});

test("AI provider secrets are encrypted for storage and stripped from client payloads", () => {
  const previousSecret = process.env.AI_KEY_ENCRYPTION_SECRET;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.AI_KEY_ENCRYPTION_SECRET = "a".repeat(40);
  process.env.DATABASE_URL =
    previousDatabaseUrl || "postgres://user:pass@localhost:5432/test";
  delete require.cache[require.resolve("../src/services/aiSettings.service")];
  const {
    encryptSecretForStorage,
    sanitizeProviderForClient,
  } = require("../src/services/aiSettings.service");

  const first = encryptSecretForStorage("sk-live-educlub-secret");
  const second = encryptSecretForStorage("sk-live-educlub-secret");
  const safeProvider = sanitizeProviderForClient({
    id: 1,
    provider_key: "openai",
    display_name: "OpenAI",
    api_key: "sk-live-educlub-secret",
    api_key_ciphertext: first,
    api_key_configured: true,
  });

  assert.match(first, /^v1:/);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /sk-live-educlub-secret/);
  assert.equal(safeProvider.api_key, undefined);
  assert.equal(safeProvider.api_key_ciphertext, undefined);
  assert.equal(safeProvider.api_key_configured, true);

  if (previousSecret === undefined) {
    delete process.env.AI_KEY_ENCRYPTION_SECRET;
  } else {
    process.env.AI_KEY_ENCRYPTION_SECRET = previousSecret;
  }
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("AI encryption requires an explicit strong secret instead of a hard-coded fallback", () => {
  const service = read("../src/services/aiSettings.service.js");

  assert.doesNotMatch(service, /educlub-ai/);
  assert.match(service, /AI_KEY_ENCRYPTION_SECRET/);
  assert.match(service, /at least 32 characters/);
});
