require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const compression = require("compression");
const crypto = require("node:crypto");
const { info } = require("./utils/logger");
const { getDatabaseHealth } = require("./database/health");
const { pool } = require("./config/db");

const env = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware");
const {
  blockSuspiciousPaths,
  emailAwareRateLimitKey,
  permissionsPolicy,
  securityHeaders,
} = require("./middleware/security.middleware");
const { ensureStartupSchema } = require("./services/startupSchema.service");

// Import routes
const authRoutes = require("./routes/auth.routes");
const schoolsRoutes = require("./routes/schools.routes");
const learnersRoutes = require("./routes/learners.routes");
const coursesRoutes = require("./routes/courses.routes");
const courseTemplatesRoutes = require("./routes/courseTemplates.routes");
const allocationsRoutes = require("./routes/allocations.routes");
const reportsRoutes = require("./routes/reports.routes");
const certificatesRoutes = require("./routes/certificates.routes");
const academicRoutes = require("./routes/academic.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const usersRoutes = require("./routes/users.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const privacyRoutes = require("./routes/privacy.routes");
const competitionsRoutes = require("./routes/competitions.routes");
const paymentsRoutes = require("./routes/payments.routes");
const publicRoutes = require("./routes/public.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const weeklyLearningRoutes = require("./routes/weeklyLearning.routes");
const typingRoutes = require("./routes/typing.routes");
const typingPracticeRoutes = require("./routes/typingPractice.routes");
const quizTestsRoutes = require("./routes/quizTests.routes");
const teacherAssignmentsRoutes = require("./routes/teacherAssignments.routes");
const teacherDashboardRoutes = require("./routes/teacherDashboard.routes");
const aiRoutes = require("./routes/ai.routes");

const app = express();
const privateUploadPrefixes = ["/reports", "/report-cards", "/learner-files"];

app.disable("x-powered-by");
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

const rateLimitJsonHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    error:
      typeof options.message === "string"
        ? options.message
        : "Too many requests from this IP, please try again later.",
  });
};

// Security middleware
app.use(blockSuspiciousPaths);
app.use(securityHeaders(env));
app.use(permissionsPolicy);
app.use(compression());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: emailAwareRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many sign-in attempts from this IP, please try again later.",
  handler: rateLimitJsonHandler,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // dashboard pages make several scoped API calls; auth remains stricter above.
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
  handler: rateLimitJsonHandler,
});

app.use("/api", limiter);

// Body parsing middleware. Keep rawBody for signed webhook verification.
app.use(
  express.json({
    limit: "6mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/2fa/verify", authLimiter);
app.use("/api/auth/password-reset/request", authLimiter);
app.use("/api/auth/password-reset/confirm", authLimiter);
app.use("/api/public/register/learner", authLimiter);

app.use(
  "/uploads",
  (req, res, next) => {
    const uploadPath = path.posix.normalize(req.path);
    if (
      privateUploadPrefixes.some(
        (prefix) =>
          uploadPath === prefix || uploadPath.startsWith(`${prefix}/`),
      )
    ) {
      return res.status(404).json({ error: "File not found" });
    }

    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Correlated structured request logging.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  res.on("finish", () => info("http_request", {
    requestId: req.requestId,
    method: req.method,
    route: req.originalUrl,
    status: res.statusCode,
    durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
    userId: req.user?.userId,
    schoolId: req.user?.schoolId,
  }));
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version: process.env.APP_VERSION || "1.0.0" });
});
app.get("/health/live", (req, res) => res.json({ status: "ok" }));
app.get("/health/ready", async (req, res, next) => {
  try {
    const database = await getDatabaseHealth();
    res.status(database.status === "ok" ? 200 : 503).json({ status: database.status, database });
  } catch (error) {
    next(error);
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/schools", schoolsRoutes);
app.use("/api/learners", learnersRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/course-templates", courseTemplatesRoutes);
app.use("/api/allocations", allocationsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/weekly-learning", weeklyLearningRoutes);
app.use("/api/typing", typingRoutes);
app.use("/api/typing-practice", typingPracticeRoutes);
app.use("/api/quiz-tests", quizTestsRoutes);
app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
app.use("/api/teacher-dashboard", teacherDashboardRoutes);
app.use("/api/ai", aiRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const PORT = env.port;

if (env.nodeEnv !== "test") {
  let server;
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    info("server_shutdown_started", { signal });
    const forceTimer = setTimeout(() => process.exit(1), 15_000);
    forceTimer.unref();
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
    clearTimeout(forceTimer);
    info("server_shutdown_complete", { signal });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  ensureStartupSchema()
    .then(() => {
      server = app.listen(PORT, () => {
        info("server_started", { port: PORT, environment: env.nodeEnv, standaloneLms: env.standaloneLmsEnabled });
      });
      server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30_000);
      server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 35_000);
      server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 5_000);
    })
    .catch((error) => {
      console.error(
        "Database health check failed; server was not started:",
        error,
      );
      process.exitCode = 1;
    });
}

module.exports = app;
