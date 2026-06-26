const crypto = require("crypto");
const { query } = require("../config");

const VALID_ROLES = ["system_admin", "school_admin", "teacher", "learner"];
const DEFAULT_PROVIDERS = [
  {
    provider_key: "openai",
    display_name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4.1-mini",
  },
  {
    provider_key: "deepseek",
    display_name: "DeepSeek",
    base_url: "https://api.deepseek.com/v1",
    default_model: "deepseek-chat",
  },
  {
    provider_key: "anthropic",
    display_name: "Anthropic",
    base_url: "https://api.anthropic.com/v1",
    default_model: "claude-3-5-haiku-latest",
  },
  {
    provider_key: "gemini",
    display_name: "Google Gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    default_model: "gemini-1.5-flash",
  },
];

function numberOrDefault(value, fallback, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

function getEncryptionKey() {
  const secret = String(process.env.AI_KEY_ENCRYPTION_SECRET || "");
  if (secret.length < 32) {
    throw new Error(
      "AI_KEY_ENCRYPTION_SECRET must be at least 32 characters before saving AI provider keys.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecretForStorage(secret) {
  if (!secret || !String(secret).trim()) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(secret).trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecretFromStorage(ciphertext) {
  if (!ciphertext) return "";
  const parts = String(ciphertext).split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported AI provider key format.");
  }
  const [, ivText, tagText, encryptedText] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function sanitizeProviderForClient(provider) {
  const {
    api_key: apiKey,
    api_key_ciphertext: apiKeyCiphertext,
    ...safeProvider
  } = provider || {};

  return {
    ...safeProvider,
    is_enabled: Boolean(safeProvider.is_enabled),
    is_default: Boolean(safeProvider.is_default),
    api_key_configured: Boolean(
      safeProvider.api_key_configured || apiKeyCiphertext,
    ),
  };
}

async function getActiveProvider(providerKey = "") {
  await ensureAiDefaults();
  const settingsResult = await query("SELECT * FROM ai_settings WHERE id = 1");
  const settings = settingsResult.rows[0];
  if (!settings?.is_enabled) {
    throw new Error("AI is currently disabled by the system admin.");
  }

  const selectedProviderKey =
    providerKey ||
    settings.default_provider_key ||
    settings.fallback_provider_key ||
    "";
  if (!selectedProviderKey) {
    throw new Error("Choose a default AI provider before generating content.");
  }

  const providerResult = await query(
    `SELECT *
     FROM ai_providers
     WHERE provider_key = $1
       AND is_enabled = true`,
    [selectedProviderKey],
  );
  const provider = providerResult.rows[0];
  if (!provider) {
    throw new Error("The selected AI provider is not enabled.");
  }
  if (!provider.api_key_ciphertext) {
    throw new Error("The selected AI provider does not have an API key saved.");
  }

  return {
    settings,
    provider: {
      ...provider,
      api_key: decryptSecretFromStorage(provider.api_key_ciphertext),
    },
  };
}

async function ensureAiDefaults() {
  await query(
    `INSERT INTO ai_settings (id, is_enabled, enabled_roles)
     VALUES (1, false, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
  );

  for (const provider of DEFAULT_PROVIDERS) {
    await query(
      `INSERT INTO ai_providers (
        provider_key, display_name, base_url, default_model, is_enabled
       )
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (provider_key) DO NOTHING`,
      [
        provider.provider_key,
        provider.display_name,
        provider.base_url,
        provider.default_model,
      ],
    );
  }

  for (const role of VALID_ROLES) {
    await query(
      `INSERT INTO ai_role_limits (
        role, is_enabled, requests_per_hour, tokens_per_hour,
        requests_per_day, tokens_per_day
       )
       VALUES ($1, false, 10, 20000, 40, 80000)
       ON CONFLICT (role) DO NOTHING`,
      [role],
    );
  }
}

function normalizeSettings(row) {
  return {
    is_enabled: Boolean(row?.is_enabled),
    default_provider_key: row?.default_provider_key || "",
    fallback_provider_key: row?.fallback_provider_key || "",
    max_requests_per_hour: Number(row?.max_requests_per_hour || 50),
    max_tokens_per_hour: Number(row?.max_tokens_per_hour || 100000),
    max_requests_per_day: Number(row?.max_requests_per_day || 250),
    max_tokens_per_day: Number(row?.max_tokens_per_day || 500000),
    retain_prompt_days: Number(row?.retain_prompt_days || 0),
    debug_logging_enabled: Boolean(row?.debug_logging_enabled),
    updated_at: row?.updated_at,
  };
}

async function getAiSettings() {
  await ensureAiDefaults();
  const [settingsResult, providersResult, roleLimitsResult] = await Promise.all([
    query("SELECT * FROM ai_settings WHERE id = 1"),
    query(
      `SELECT
        id, provider_key, display_name, base_url, default_model, fallback_model,
        is_enabled, is_default, api_key_ciphertext IS NOT NULL AS api_key_configured,
        updated_at
       FROM ai_providers
       ORDER BY display_name`,
    ),
    query(
      `SELECT role, is_enabled, requests_per_hour, tokens_per_hour,
        requests_per_day, tokens_per_day, updated_at
       FROM ai_role_limits
       ORDER BY array_position($1::text[], role)`,
      [VALID_ROLES],
    ),
  ]);

  return {
    settings: normalizeSettings(settingsResult.rows[0]),
    providers: providersResult.rows.map(sanitizeProviderForClient),
    role_limits: roleLimitsResult.rows.map((limit) => ({
      role: limit.role,
      is_enabled: Boolean(limit.is_enabled),
      requests_per_hour: Number(limit.requests_per_hour || 0),
      tokens_per_hour: Number(limit.tokens_per_hour || 0),
      requests_per_day: Number(limit.requests_per_day || 0),
      tokens_per_day: Number(limit.tokens_per_day || 0),
    })),
  };
}

async function updateAiSettings(payload, user) {
  await ensureAiDefaults();
  const settings = payload?.settings || {};
  const providers = Array.isArray(payload?.providers) ? payload.providers : [];
  const roleLimits = Array.isArray(payload?.role_limits)
    ? payload.role_limits
    : [];

  await query(
    `UPDATE ai_settings
     SET is_enabled = $1,
         default_provider_key = NULLIF($2, ''),
         fallback_provider_key = NULLIF($3, ''),
         max_requests_per_hour = $4,
         max_tokens_per_hour = $5,
         max_requests_per_day = $6,
         max_tokens_per_day = $7,
         retain_prompt_days = $8,
         debug_logging_enabled = $9,
         updated_by_user_id = $10,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      Boolean(settings.is_enabled),
      String(settings.default_provider_key || "").trim(),
      String(settings.fallback_provider_key || "").trim(),
      numberOrDefault(settings.max_requests_per_hour, 50, 1),
      numberOrDefault(settings.max_tokens_per_hour, 100000, 1000),
      numberOrDefault(settings.max_requests_per_day, 250, 1),
      numberOrDefault(settings.max_tokens_per_day, 500000, 1000),
      numberOrDefault(settings.retain_prompt_days, 0, 0),
      Boolean(settings.debug_logging_enabled),
      user?.userId || user?.id || null,
    ],
  );

  for (const provider of providers) {
    const providerKey = String(provider.provider_key || "").trim();
    if (!providerKey) continue;
    const encryptedKey = encryptSecretForStorage(provider.api_key);
    const shouldClearKey = Boolean(provider.clear_api_key);

    await query(
      `INSERT INTO ai_providers (
        provider_key, display_name, base_url, default_model, fallback_model,
        is_enabled, is_default, api_key_ciphertext, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (provider_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         base_url = EXCLUDED.base_url,
         default_model = EXCLUDED.default_model,
         fallback_model = EXCLUDED.fallback_model,
         is_enabled = EXCLUDED.is_enabled,
         is_default = EXCLUDED.is_default,
         api_key_ciphertext = CASE
           WHEN $9::boolean THEN NULL
           WHEN $8::text IS NOT NULL THEN $8::text
           ELSE ai_providers.api_key_ciphertext
         END,
         updated_at = CURRENT_TIMESTAMP`,
      [
        providerKey,
        String(provider.display_name || providerKey).trim(),
        String(provider.base_url || "").trim(),
        String(provider.default_model || "").trim(),
        String(provider.fallback_model || "").trim() || null,
        Boolean(provider.is_enabled),
        Boolean(provider.is_default),
        encryptedKey,
        shouldClearKey,
      ],
    );
  }

  for (const limit of roleLimits) {
    const role = String(limit.role || "").trim();
    if (!VALID_ROLES.includes(role)) continue;
    await query(
      `INSERT INTO ai_role_limits (
        role, is_enabled, requests_per_hour, tokens_per_hour,
        requests_per_day, tokens_per_day, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (role) DO UPDATE SET
         is_enabled = EXCLUDED.is_enabled,
         requests_per_hour = EXCLUDED.requests_per_hour,
         tokens_per_hour = EXCLUDED.tokens_per_hour,
         requests_per_day = EXCLUDED.requests_per_day,
         tokens_per_day = EXCLUDED.tokens_per_day,
         updated_at = CURRENT_TIMESTAMP`,
      [
        role,
        Boolean(limit.is_enabled),
        numberOrDefault(limit.requests_per_hour, 10, 1),
        numberOrDefault(limit.tokens_per_hour, 20000, 1000),
        numberOrDefault(limit.requests_per_day, 40, 1),
        numberOrDefault(limit.tokens_per_day, 80000, 1000),
      ],
    );
  }

  return getAiSettings();
}

async function getAiAvailability(user) {
  await ensureAiDefaults();
  const result = await query(
    `SELECT s.is_enabled AS global_enabled, r.is_enabled AS role_enabled,
      r.requests_per_hour, r.tokens_per_hour, r.requests_per_day, r.tokens_per_day
     FROM ai_settings s
     LEFT JOIN ai_role_limits r ON r.role = $1
     WHERE s.id = 1`,
    [user?.role || ""],
  );
  const row = result.rows[0] || {};
  return {
    enabled: Boolean(row.global_enabled && row.role_enabled),
    role: user?.role || "",
    limits: {
      requests_per_hour: Number(row.requests_per_hour || 0),
      tokens_per_hour: Number(row.tokens_per_hour || 0),
      requests_per_day: Number(row.requests_per_day || 0),
      tokens_per_day: Number(row.tokens_per_day || 0),
    },
  };
}

module.exports = {
  DEFAULT_PROVIDERS,
  VALID_ROLES,
  decryptSecretFromStorage,
  ensureAiDefaults,
  encryptSecretForStorage,
  getActiveProvider,
  getAiAvailability,
  getAiSettings,
  sanitizeProviderForClient,
  updateAiSettings,
};
