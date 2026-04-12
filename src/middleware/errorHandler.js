'use strict';

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (err && err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => e.message),
    });
  }

  if (err && err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Unique constraint error',
      details: err.errors.map((e) => e.message),
    });
  }

  const statusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed');

  console.error(err);
  return res.status(statusCode).json({ error: message });
}

module.exports = { notFoundHandler, errorHandler };
