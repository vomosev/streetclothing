'use strict';

/**
 * Shared Express error-handling helpers for the STREET/PLATINUM API.
 */

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  // Delegate to Express' default handler if headers were already sent.
  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number(err && (err.status || err.statusCode)) >= 400 &&
    Number(err && (err.status || err.statusCode)) < 600
      ? Number(err.status || err.statusCode)
      : 500;

  const isProduction = process.env.NODE_ENV === 'production';

  // Always log server-side so operators can trace failures in logs/api.log.
  const logLabel = `[error] ${req && req.method ? req.method : '-'} ${
    req && req.originalUrl ? req.originalUrl : '-'
  } -> ${status}`;

  if (status >= 500) {
    console.error(logLabel, err && err.stack ? err.stack : err);
  } else {
    console.warn(logLabel, err && err.message ? err.message : err);
  }

  let message = (err && err.message) || 'Something went wrong';

  if (status >= 500 && isProduction) {
    message = 'Something went wrong';
  }

  const payload = { error: message };

  if (err && err.code === 'ER_NO_SUCH_TABLE') {
    payload.error = isProduction
      ? 'Something went wrong'
      : 'Database schema is missing — run `mysql < schema.sql` first';
  }

  if (err && err.details && !isProduction) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}

/**
 * Wrap an async route handler so rejected promises reach errorHandler.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
      return result;
    } catch (err) {
      next(err);
      return undefined;
    }
  };
}

/**
 * Convenience factory for throwing errors with an HTTP status attached.
 */
function httpError(status, message, details) {
  const err = new Error(message || 'Request failed');
  err.status = status || 500;
  if (details) err.details = details;
  return err;
}

module.exports = { notFound, errorHandler, asyncHandler, httpError };