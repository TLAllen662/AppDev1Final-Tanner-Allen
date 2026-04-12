'use strict';

function validateIdParam(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      return res.status(400).json({ error: `${paramName} must be a positive integer` });
    }

    return next();
  };
}

module.exports = { validateIdParam };
