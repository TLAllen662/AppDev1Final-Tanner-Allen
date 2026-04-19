'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Event, Attendance } = require('../database');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validateId');
const {
  isNonEmptyString,
  isValidEmail,
  validationError,
  parsePaginationParams,
  parseSortParams,
  paginatedResponse,
} = require('../middleware/validationHelpers');

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET /api/users - list all users with pagination and filtering (organizers only)
router.get('/', authenticate, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['name', 'email', 'role', 'createdAt']);

  // Build where clause for search and filtering
  const where = {};

  // Search filter
  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${req.query.search}%` } },
      { email: { [Op.like]: `%${req.query.search}%` } },
    ];
  }

  // Role filter
  if (req.query.role && ['user', 'organizer'].includes(req.query.role)) {
    where.role = req.query.role;
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: sort.length ? sort : [['name', 'ASC']],
    attributes: { exclude: ['passwordHash'] },
    distinct: true,
  });

  return res.json(paginatedResponse(rows.map(sanitizeUser), count, limit, offset));
});

// GET /api/users/:id
router.get('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.role !== 'organizer' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const user = await User.findByPk(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(sanitizeUser(user));
});

// POST /api/users
router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const { name, email, password, role } = req.body;
  const details = [];

  if (!isNonEmptyString(name)) details.push('name is required and must be a non-empty string');
  if (!isValidEmail(email)) details.push('email is required and must be a valid email address');
  if (!isNonEmptyString(password) || password.length < 8) details.push('password is required and must be at least 8 characters');
  if (role !== undefined && role !== 'organizer' && role !== 'user') {
    details.push('role must be either organizer or user when provided');
  }

  if (details.length > 0) {
    return validationError(res, details);
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: role === 'organizer' ? 'organizer' : 'user',
  });

  return res.status(201).json(sanitizeUser(user));
});

// PUT /api/users/:id
router.put('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const targetId = Number(req.params.id);
  const isOrganizer = req.user.role === 'organizer';
  const isSelf = req.user.id === targetId;

  if (!isOrganizer && !isSelf) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const user = await User.findByPk(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = {};
  const { name, email, password, role } = req.body;
  const details = [];

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      details.push('name must be a non-empty string when provided');
    } else {
      updates.name = name;
    }
  }
  if (email !== undefined) {
    if (!isValidEmail(email)) {
      details.push('email must be a valid email address when provided');
    }
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.id !== targetId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    updates.email = email;
  }
  if (password !== undefined) {
    if (!isNonEmptyString(password) || password.length < 8) {
      details.push('password must be at least 8 characters when provided');
    } else {
      updates.passwordHash = await bcrypt.hash(password, 12);
    }
  }
  if (isOrganizer && role !== undefined) {
    if (role !== 'organizer' && role !== 'user') {
      details.push('role must be either organizer or user when provided');
    }
    updates.role = role === 'organizer' ? 'organizer' : 'user';
  }

  if (details.length > 0) {
    return validationError(res, details);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'At least one field is required to update' });
  }

  await user.update(updates);
  return res.json(sanitizeUser(user));
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const targetId = Number(req.params.id);
  const isOrganizer = req.user.role === 'organizer';
  const isSelf = req.user.id === targetId;

  if (!isOrganizer && !isSelf) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const user = await User.findByPk(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await user.destroy();
  return res.status(204).send();
});

// GET /api/users/:id/events - events organized by user with pagination
router.get('/:id/events', authenticate, validateIdParam('id'), async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['date', 'name', 'createdAt']);

  const { count, rows } = await Event.findAndCountAll({
    where: { organizerId: req.params.id },
    limit,
    offset,
    order: sort.length ? sort : [['date', 'ASC']],
    distinct: true,
  });

  return res.json({
    organizer: {
      id: user.id,
      name: user.name,
      email: user.email,
      eventCount: count,
    },
    events: paginatedResponse(rows, count, limit, offset),
  });
});

// GET /api/users/:id/attendance - events user is attending with pagination
router.get('/:id/attendance', authenticate, validateIdParam('id'), async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check permission: user can view own, organizers can view anyone
  if (req.user.id !== Number(req.params.id) && req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Forbidden: cannot view other users attendance' });
  }

  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['date', 'name', 'createdAt']);

  const { count, rows } = await Attendance.findAndCountAll({
    where: { userId: req.params.id },
    include: [{
      model: Event,
      as: 'event',
      attributes: ['id', 'name', 'date', 'time', 'location', 'organizerId'],
    }],
    limit,
    offset,
    order: sort.length ? sort : [['createdAt', 'DESC']],
    distinct: true,
  });

  return res.json({
    attendee: {
      id: user.id,
      name: user.name,
      email: user.email,
      attendingCount: count,
    },
    events: paginatedResponse(rows.map(a => a.event), count, limit, offset),
  });
});

// GET /api/users/:id/stats - get user statistics (events organized, events attended, profile info)
router.get('/:id/stats', authenticate, validateIdParam('id'), async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check permission
  if (req.user.id !== Number(req.params.id) && req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Forbidden: cannot view other users stats' });
  }

  const [eventsOrganized, eventsAttending, groupsCreated] = await Promise.all([
    Event.count({ where: { organizerId: req.params.id } }),
    Attendance.count({ where: { userId: req.params.id } }),
    user.role === 'organizer' ? require('../database/index').Group.count({ where: { creatorId: req.params.id } }) : Promise.resolve(0),
  ]);

  return res.json({
    user: sanitizeUser(user),
    statistics: {
      eventsOrganized: user.role === 'organizer' ? eventsOrganized : 0,
      eventsAttending,
      groupsCreated: user.role === 'organizer' ? groupsCreated : 0,
    },
  });
});

module.exports = router;
