require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const env = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware");

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
const publicRoutes = require("./routes/public.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const weeklyLearningRoutes = require("./routes/weeklyLearning.routes");
const typingRoutes = require("./routes/typing.routes");
const quizTestsRoutes = require("./routes/quizTests.routes");

const app = express();
const privateUploadPrefixes = ["/reports", "/report-cards", "/learner-files"];

const rateLimitJsonHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    error:
      typeof options.message === "string"
        ? options.message
        : "Too many requests from this IP, please try again later.",
  });
};

// Security middleware
app.use(helmet());
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
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/2fa/verify", authLimiter);
app.use("/api/auth/password-reset/request", authLimiter);
app.use("/api/auth/password-reset/confirm", authLimiter);
app.use("/api/public/register/learner", authLimiter);
app.use("/api", limiter);

// Body parsing middleware
app.use(
  express.json({
    limit: "6mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "6mb" }));
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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
app.use("/api/public", publicRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/weekly-learning", weeklyLearningRoutes);
app.use("/api/typing", typingRoutes);
app.use("/api/quiz-tests", quizTestsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const PORT = env.port;

if (env.nodeEnv !== "test") {
  app.listen(PORT, () => {
    console.log(`eduClub Backend Server running on port ${PORT}`);
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(
      `Database URL: ${env.databaseUrl ? "configured" : "not configured"}`,
    );
    console.log(
      `Standalone LMS: ${env.standaloneLmsEnabled ? "enabled" : "disabled"}`,
    );
  });
}

module.exports = app;
