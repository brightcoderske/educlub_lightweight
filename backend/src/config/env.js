require("dotenv").config();
const { validateProductionEnv } = require("./validateProductionEnv");

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
  // Email configuration for MFA (required)
  emailHost: process.env.EMAIL_HOST,
  emailPort,
  emailSecure,
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom:
    process.env.EMAIL_FROM || `eduClub <${process.env.EMAIL_USER}>`,
  emailReplyTo: process.env.EMAIL_REPLY_TO || "support@educlub.co.ke",
  // Default passwords (required for initial setup)
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD,
  defaultSchoolAdminPassword: process.env.DEFAULT_SCHOOL_ADMIN_PASSWORD,
  defaultLearnerPassword: process.env.DEFAULT_LEARNER_PASSWORD,
  // System admin email
  systemAdminEmail: process.env.SYSTEM_ADMIN_EMAIL,
};
