const { error } = require("../utils/logger");

function errorHandler(err, req, res, next) {
  error("request_failed", { requestId: req.requestId, code: err.code, name: err.name, message: err.message, stack: process.env.NODE_ENV === "development" ? err.stack : undefined });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: err.message, errors: err.errors || null, requestId: req.requestId });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, code: "AUTHENTICATION_ERROR", message: "Invalid token", errors: null, requestId: req.requestId });
  }

  if (err.code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({ success: false, code: "CONFLICT", message: "Resource already exists", errors: null, requestId: req.requestId });
  }

  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({ success: false, code: "INVALID_REFERENCE", message: "Referenced resource does not exist", errors: null, requestId: req.requestId });
  }

  res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Internal server error", errors: null, requestId: req.requestId });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

module.exports = { errorHandler, notFoundHandler };
