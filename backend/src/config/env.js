const { loadEnv } = require("./loadEnv");
const { validateProductionEnv } = require("./validateProductionEnv");

const envFile = loadEnv();

const emailPort = parseInt(process.env.EMAIL_PORT, 10);
const emailSecure =
  process.env.EMAIL_SECURE === undefined
    ? emailPort === 465
    : process.env.EMAIL_SECURE === "true";

const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "DEFAULT_ADMIN_PASSWORD",
  "DEFAULT_SCHOOL_ADMIN_PASSWORD",
  "DEFAULT_LEARNER_PASSWORD",
  "SYSTEM_ADMIN_EMAIL",
  "FRONTEND_URL",
  "CORS_ORIGINS",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

validateProductionEnv(process.env);

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ||
    `http://127.0.0.1:${process.env.PORT || 4000}`,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  standaloneLmsEnabled: process.env.STANDALONE_LMS_ENABLED !== "false",
  // Timestamps are stored in UTC; this is the zone a learner's calendar day is
  // measured in, which is what a daily streak counts.
  learnerTimezone: process.env.LEARNER_TIMEZONE || "Africa/Nairobi",
  frontendUrl: process.env.FRONTEND_URL,
  corsOrigins: process.env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
  flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
  flutterwaveEncryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || "",
  flutterwaveWebhookSecretHash:
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH ||
    process.env.FLW_SECRET_HASH ||
    "",
  flutterwaveBaseUrl:
    process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3",
  // Where the settings were read from, so startup can say when a value in the
  // process environment (a hosting panel, the shell) is beating the one in .env.
  envFile: envFile.path,
  envFileFound: envFile.found,
  envShadowedKeys: envFile.shadowed,
  // Mail. Everything here comes from .env so moving between providers -
  // cPanel, a relay, anything - is a configuration change and never a code one.
  // No address or sender name is built into the code as a fallback: with no
  // EMAIL_FROM mail goes out as the mailbox that logs in, and with no
  // EMAIL_REPLY_TO there is no Reply-To header at all.
  emailHost: process.env.EMAIL_HOST,
  emailPort,
  emailSecure,
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  emailReplyTo: process.env.EMAIL_REPLY_TO || "",
  // STARTTLS on port 587: refuse to carry on in plain text if the upgrade
  // fails. Ignored when EMAIL_SECURE is true, which is already encrypted.
  emailRequireTls: process.env.EMAIL_REQUIRE_TLS === "true",
  // Shared hosting often presents a certificate for the server's own hostname
  // rather than mail.yourdomain. Naming it here keeps verification on.
  emailTlsServername: process.env.EMAIL_TLS_SERVERNAME || undefined,
  // Last resort for a host whose certificate cannot be matched at all. Opt-in,
  // because turning it off removes the protection against interception.
  emailTlsRejectUnauthorized:
    process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false",
  // Send EMAIL_FROM exactly as written, even when the mailbox that
  // authenticates cannot be shown to own it.
  emailAllowUnalignedFrom: process.env.EMAIL_ALLOW_UNALIGNED_FROM === "true",
  // Default passwords (required for initial setup)
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD,
  defaultSchoolAdminPassword: process.env.DEFAULT_SCHOOL_ADMIN_PASSWORD,
  defaultLearnerPassword: process.env.DEFAULT_LEARNER_PASSWORD,
  // System admin email
  systemAdminEmail: process.env.SYSTEM_ADMIN_EMAIL,
};
