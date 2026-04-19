'use strict';

/**
 * Factory function to create ownership check middleware.
 * Allows access if user is the owner or has organizer role.
 * 
 * @param {Function} resourceLoader - Async function that loads the resource and returns it
 * @param {String} ownerField - The field name that stores the owner's ID (e.g., 'userId', 'organizerId', 'creatorId')
 * @returns {Function} Express middleware
 * 
 * Usage:
 * router.delete('/:id', 
 *   authenticate, 
 *   ownershipCheck(
 *     async (req) => await Event.findByPk(req.params.id),
 *     'organizerId'
 *   ),
 *   handler
 * );
 */
function ownershipCheck(resourceLoader, ownerField) {
  return async (req, res, next) => {
    try {
      const resource = await resourceLoader(req);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // Allow access if user is the owner or has organizer role
      const isOwner = resource[ownerField] === req.user.id;
      const isOrganizer = req.user.role === 'organizer';

      if (!isOwner && !isOrganizer) {
        return res.status(403).json({ error: 'You can only access your own resources' });
      }

      // Attach resource to request for use in handler
      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to check resource ownership' });
    }
  };
}

module.exports = { ownershipCheck };
