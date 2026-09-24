/**
 * Answers a failed request.
 *
 * An error that carries a status of its own was raised on purpose, with a
 * message written to be read by the person who asked, so both are passed on.
 * Anything else is unexpected: it is logged in full and answered with
 * `fallback`, so internal detail - a SQL error, a stack - never reaches the
 * caller.
 */
function respondWithError(res, error, fallback) {
  if (!error.statusCode) console.error(fallback, error);
  res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : fallback,
  });
}

module.exports = { respondWithError };
