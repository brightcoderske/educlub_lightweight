const helmet = require("helmet");

const BLOCKED_EXTENSIONS = /\.(?:php[0-9]?|phtml|phar|asp|aspx|jsp|cgi|pl|exe|dll|bat|cmd|sh|ps1|scr|com)(?:$|[?#])/i;
const BLOCKED_PATHS = [
  /\/wp-admin(?:\/|$)/i,
  /\/wp-login\.php(?:$|[?#])/i,
  /\/xmlrpc\.php(?:$|[?#])/i,
  /\/phpmyadmin(?:\/|$)/i,
  /\/\.env(?:$|[?#])/i,
  /\/\.git(?:\/|$)/i,
];

function isSuspiciousPath(url = "") {
  const path = String(url || "").split("?")[0];
  return BLOCKED_EXTENSIONS.test(path) || BLOCKED_PATHS.some((pattern) => pattern.test(path));
}

function blockSuspiciousPaths(req, res, next) {
  if (isSuspiciousPath(req.originalUrl || req.url)) {
    return res.status(404).json({ error: "Route not found" });
  }
  return next();
}

function securityHeaders(env = {}) {
  const connectSources = ["'self'", ...(env.corsOrigins || [])];
  const productionDirectives =
    env.nodeEnv === "production" ? { "upgrade-insecure-requests": [] } : {};
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https:"],
        "media-src": ["'self'", "https:", "data:"],
        "connect-src": connectSources,
        ...productionDirectives,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "sameorigin" },
    hsts:
      env.nodeEnv === "production"
        ? { maxAge: 15552000, includeSubDomains: true, preload: false }
        : false,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}

function permissionsPolicy(req, res, next) {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  next();
}

function emailAwareRateLimitKey(req) {
  const email = String(req.body?.email || req.body?.username || "")
    .trim()
    .toLowerCase();
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${email}`;
}

module.exports = {
  blockSuspiciousPaths,
  emailAwareRateLimitKey,
  isSuspiciousPath,
  permissionsPolicy,
  securityHeaders,
};
