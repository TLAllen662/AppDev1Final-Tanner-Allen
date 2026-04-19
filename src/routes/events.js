'use strict';
const express = require('express');
const { Op } = require('sequelize');
const { Event, User, Attendance, Group } = require('../database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/validateId');
const {
  isNonEmptyString,
  isPositiveInteger,
  isValidDateOnly,
  isValidTime,
  validationError,
  parsePaginationParams,
  parseSortParams,
  paginatedResponse,
} = require('../middleware/validationHelpers');

const router = express.Router();

// GET /api/events - view all public events with pagination, filtering, sorting, and search
router.get('/', authenticate, async (req, res) => {
  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['date', 'name', 'createdAt']);

  const where = {};

  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${req.query.search}%` } },
      { description: { [Op.like]: `%${req.query.search}%` } },
      { location: { [Op.like]: `%${req.query.search}%` } },
    ];
  }

  if (req.query.startDate) {
    if (!isValidDateOnly(req.query.startDate)) {
      return validationError(res, ['startDate must be YYYY-MM-DD format']);
    }
    where.date = { ...where.date, [Op.gte]: req.query.startDate };
  }

  if (req.query.endDate) {
    if (!isValidDateOnly(req.query.endDate)) {
      return validationError(res, ['endDate must be YYYY-MM-DD format']);
    }
    where.date = { ...where.date, [Op.lte]: req.query.endDate };
  }

  if (req.query.location) {
    where.location = { [Op.like]: `%${req.query.location}%` };
  }

  if (req.query.groupId && isPositiveInteger(req.query.groupId)) {
    where.groupId = Number(req.query.groupId);
  }

  if (req.query.organizerId && isPositiveInteger(req.query.organizerId)) {
    where.organizerId = Number(req.query.organizerId);
  }

  const { count, rows } = await Event.findAndCountAll({
    where,
    include: [{ model: User, as: 'organizer', attributes: ['id', 'name'] }],
    limit,
    offset,
    order: sort.length ? sort : [['date', 'ASC']],
    distinct: true,
  });

  return res.json(paginatedResponse(rows, count, limit, offset));
});

// POST /api/events - organizers only
router.post('/', authenticate, authorize('organizer'), async (req, res) => {
  const { name, location, date, time, description, groupId } = req.body;
  const details = [];

  if (!isNonEmptyString(name)) details.push('name is required and must be a non-empty string');
  if (!isNonEmptyString(location)) details.push('location is required and must be a non-empty string');
  if (!isValidDateOnly(date)) details.push('date is required and must use YYYY-MM-DD format');
  if (!isValidTime(time)) details.push('time is required and must use HH:MM or HH:MM:SS format');
  if (description !== undefined && description !== null && typeof description !== 'string') {
    details.push('description must be a string when provided');
  }
  if (groupId !== undefined && groupId !== null && !isPositiveInteger(groupId)) {
    details.push('groupId must be a positive integer when provided');
  }

  if (details.length > 0) {
    return validationError(res, details);
  }

  if (groupId !== undefined && groupId !== null) {
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
  }

  const event = await Event.create({
    organizerId: req.user.id,
    name,
    location,
    date,
    time,
    description,
    groupId: groupId || null,
  });
  return res.status(201).json(event);
});

// GET /api/events/upcoming/list - upcoming events with pagination
router.get('/upcoming/list', authenticate, async (req, res) => {
  const { limit, offset } = parsePaginationParams(req.query);
  const today = new Date().toISOString().split('T')[0];

  const { count, rows } = await Event.findAndCountAll({
    where: { date: { [Op.gte]: today } },
    include: [{ model: User, as: 'organizer', attributes: ['id', 'name'] }],
    limit,
    offset,
    order: [['date', 'ASC']],
    distinct: true,
  });

  return res.json(paginatedResponse(rows, count, limit, offset));
});

// GET /api/events/:id/attendees - get event attendees with pagination
router.get('/:id/attendees', authenticate, validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const { limit, offset } = parsePaginationParams(req.query);

  const { count, rows } = await Attendance.findAndCountAll({
    where: { eventId: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });

  return res.json({
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      attendeeCount: count,
    },
    attendees: paginatedResponse(rows.map(a => a.user), count, limit, offset),
  });
});

// GET /api/events/:id/group - get event's group (if associated)
router.get('/:id/group', authenticate, validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id, {
    include: [{ model: Group, as: 'group', attributes: ['id', 'name', 'creatorId', 'createdAt'] }],
  });

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!event.group) return res.status(404).json({ error: 'Event is not associated with a group' });

  return res.json(event.group);
});

// GET /api/events/:id
router.get('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id, {
    include: [
      { model: User, as: 'organizer', attributes: ['id', 'name'] },
      { model: User, as: 'attendees', attributes: ['id', 'name'] },
    ],
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  return res.json(event);
});

// PUT /api/events/:id - organizer who created it only
router.put('/:id', authenticate, authorize('organizer'), validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own events' });
  }

  const { name, location, date, time, description, groupId } = req.body;
  const details = [];

  if (name !== undefined && !isNonEmptyString(name)) details.push('name must be a non-empty string when provided');
  if (location !== undefined && !isNonEmptyString(location)) details.push('location must be a non-empty string when provided');
  if (date !== undefined && !isValidDateOnly(date)) details.push('date must use YYYY-MM-DD format when provided');
  if (time !== undefined && !isValidTime(time)) details.push('time must use HH:MM or HH:MM:SS format when provided');
  if (description !== undefined && description !== null && typeof description !== 'string') {
    details.push('description must be a string when provided');
  }
  if (groupId !== undefined && groupId !== null && !isPositiveInteger(groupId)) {
    details.push('groupId must be a positive integer when provided');
  }

  if (details.length > 0) {
    return validationError(res, details);
  }

  if (groupId !== undefined && groupId !== null) {
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
  }

  await event.update({ name, location, date, time, description, groupId });
  return res.json(event);
});

// DELETE /api/events/:id - organizer who created it only
router.delete('/:id', authenticate, authorize('organizer'), validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own events' });
  }
  await event.destroy();
  return res.status(204).send();
});

module.exports = router;
