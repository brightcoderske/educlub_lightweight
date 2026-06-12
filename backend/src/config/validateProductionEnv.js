function parseHttpsUrl(name, value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }

  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(`${name} cannot use a local hostname in production`);
  }

  return parsed;
}

function extractEmailAddress(value) {
  const text = String(value || "").trim();
  const bracketed = text.match(/<([^<>]+)>$/);
  return bracketed ? bracketed[1].trim() : text;
}

function validateEmailAddress(name, value) {
  const address = extractEmailAddress(value);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error(`${name} must contain a valid email address`);
  }
}

function validateProductionEnv(environment) {
  if (environment.NODE_ENV !== "production") {
    return;
  }

  if (!environment.JWT_SECRET || environment.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  parseHttpsUrl("FRONTEND_URL", environment.FRONTEND_URL);
  parseHttpsUrl("PUBLIC_BASE_URL", environment.PUBLIC_BASE_URL);

  const origins = String(environment.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const explicitHttpsOrigins =
    origins.length > 0 &&
    origins.every((origin) => {
      if (origin === "*" || origin.includes("*")) {
        return false;
      }

      try {
        const parsed = parseHttpsUrl("CORS_ORIGINS", origin);
        return parsed.origin === origin && parsed.pathname === "/";
      } catch (error) {
        return false;
      }
    });

  if (!explicitHttpsOrigins) {
    throw new Error(
      "CORS_ORIGINS must contain only explicit HTTPS origins in production",
    );
  }

  const emailPort = Number(environment.EMAIL_PORT);
  if (![465, 587].includes(emailPort)) {
    throw new Error("EMAIL_PORT must be 465 or 587 in production");
  }

  if (
    environment.EMAIL_SECURE !== undefined &&
    !["true", "false"].includes(environment.EMAIL_SECURE)
  ) {
    throw new Error("EMAIL_SECURE must be true or false");
  }

  const emailSecure =
    environment.EMAIL_SECURE === undefined
      ? emailPort === 465
      : environment.EMAIL_SECURE === "true";
  if (emailPort === 465 && !emailSecure) {
    throw new Error("EMAIL_SECURE must be true when EMAIL_PORT is 465");
  }
  if (emailPort === 587 && emailSecure) {
    throw new Error("EMAIL_SECURE must be false when EMAIL_PORT is 587");
  }

  validateEmailAddress(
    "EMAIL_FROM",
    environment.EMAIL_FROM || environment.EMAIL_USER,
  );
  validateEmailAddress(
    "EMAIL_REPLY_TO",
    environment.EMAIL_REPLY_TO || "support@educlub.co.ke",
  );
}

module.exports = { validateProductionEnv };
