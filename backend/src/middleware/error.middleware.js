function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

module.exports = { errorHandler, notFoundHandler };
