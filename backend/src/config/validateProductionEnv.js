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
}

module.exports = { validateProductionEnv };
