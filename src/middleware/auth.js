'use strict';
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT and attach the decoded payload to req.user.
 * Expects Authorization header in format: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' });
  }

  const token = authHeader.slice(7);
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token in Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Token validation failed' });
  }
}

module.exports = { authenticate };
