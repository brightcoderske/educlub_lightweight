const { error } = require("../utils/logger");

// Express only treats a handler as error middleware when it declares four
// parameters, so the unused one has to stay in the signature.
function errorHandler(err, req, res, _next) {
  error("request_failed", { requestId: req.requestId, code: err.code, name: err.name, message: err.message, stack: process.env.NODE_ENV === "development" ? err.stack : undefined });

  // The body parser's own failures. Answering 500 told a learner whose upload
  // was too big that the server had broken.
  if (err.type === "entity.too.large") {
    const message = "That file is too large to upload. Choose a file under 4 MB.";
    return res.status(413).json({ success: false, code: "PAYLOAD_TOO_LARGE", error: message, message, errors: null, requestId: req.requestId });
  }
  if (err.type === "entity.parse.failed") {
    const message = "The request could not be read. Please try again.";
    return res.status(400).json({ success: false, code: "BAD_REQUEST", error: message, message, errors: null, requestId: req.requestId });
  }

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
