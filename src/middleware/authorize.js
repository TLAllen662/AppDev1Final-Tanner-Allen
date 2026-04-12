'use strict';

/**
 * Returns middleware that checks req.user.role against allowed roles.
 * Must be used after the authenticate middleware.
 * @param {...string} roles - Allowed roles (e.g. 'organizer', 'user')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

module.exports = { authorize };
