/**
 * Simple logger utility
 */

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  if (level === logLevels.ERROR) {
    console.error(JSON.stringify(logEntry));
  } else if (level === logLevels.WARN) {
    console.warn(JSON.stringify(logEntry));
  } else if (level === logLevels.DEBUG && process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

function error(message, meta) {
  log(logLevels.ERROR, message, meta);
}

function warn(message, meta) {
  log(logLevels.WARN, message, meta);
}

function info(message, meta) {
  log(logLevels.INFO, message, meta);
}

function debug(message, meta) {
  log(logLevels.DEBUG, message, meta);
}

module.exports = {
  logLevels,
  error,
  warn,
  info,
  debug,
};
