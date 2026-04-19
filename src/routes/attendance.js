'use strict';
const express = require('express');
const { Op } = require('sequelize');
const { Attendance, Event, User } = require('../database');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validateId');
const {
  isPositiveInteger,
  validationError,
  parsePaginationParams,
  parseSortParams,
  paginatedResponse,
} = require('../middleware/validationHelpers');

const router = express.Router();

// GET /api/attendance - list attendance records with pagination
router.get('/', authenticate, async (req, res) => {
  const where = req.user.role === 'organizer' ? {} : { userId: req.user.id };
  
  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['createdAt', 'eventId', 'userId']);

  // Filter by event if specified
  if (req.query.eventId && isPositiveInteger(req.query.eventId)) {
    where.eventId = Number(req.query.eventId);
  }

  // Filter by user if organizer specified it
  if (req.query.userId && isPositiveInteger(req.query.userId) && req.user.role === 'organizer') {
    where.userId = Number(req.query.userId);
  }

  const { count, rows } = await Attendance.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: Event, as: 'event', attributes: ['id', 'name', 'date', 'time', 'location'] },
    ],
    limit,
    offset,
    order: sort.length ? sort : [['createdAt', 'DESC']],
    distinct: true,
  });

  return res.json(paginatedResponse(rows, count, limit, offset));
});

// GET /api/attendance/:id
router.get('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const record = await Attendance.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: Event, as: 'event', attributes: ['id', 'name', 'date', 'time', 'location'] },
    ],
  });

  if (!record) return res.status(404).json({ error: 'Attendance record not found' });
  if (req.user.role !== 'organizer' && record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: cannot view this attendance record' });
  }

  return res.json(record);
});

// POST /api/attendance
router.post('/', authenticate, async (req, res) => {
  const requestedUserId = req.body.userId;
  const userId = req.user.role === 'organizer' && requestedUserId ? requestedUserId : req.user.id;
  const { eventId } = req.body;

  const details = [];
  if (!isPositiveInteger(eventId)) details.push('eventId is required and must be a positive integer');
  if (requestedUserId !== undefined && req.user.role === 'organizer' && !isPositiveInteger(requestedUserId)) {
    details.push('userId must be a positive integer when provided');
  }
  if (details.length > 0) {
    return validationError(res, details);
  }

  const [user, event] = await Promise.all([
    User.findByPk(userId),
    Event.findByPk(eventId),
  ]);

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const existing = await Attendance.findOne({ where: { userId, eventId } });
  if (existing) return res.status(409).json({ error: 'Attendance record already exists' });

  const record = await Attendance.create({ userId, eventId });
  return res.status(201).json(record);
});

// PUT /api/attendance/:id
router.put('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  if (!record) return res.status(404).json({ error: 'Attendance record not found' });

  const isOwner = record.userId === req.user.id;
  const isOrganizer = req.user.role === 'organizer';
  if (!isOwner && !isOrganizer) {
    return res.status(403).json({ error: 'Forbidden: cannot update this attendance record' });
  }

  const { eventId, userId } = req.body;
  const details = [];
  if (eventId !== undefined && !isPositiveInteger(eventId)) {
    details.push('eventId must be a positive integer when provided');
  }
  if (userId !== undefined && isOrganizer && !isPositiveInteger(userId)) {
    details.push('userId must be a positive integer when provided');
  }
  if (details.length > 0) {
    return validationError(res, details);
  }

  const nextUserId = isOrganizer && userId ? userId : record.userId;
  const nextEventId = eventId || record.eventId;

  const [user, event] = await Promise.all([
    User.findByPk(nextUserId),
    Event.findByPk(nextEventId),
  ]);

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const duplicate = await Attendance.findOne({
    where: { userId: nextUserId, eventId: nextEventId },
  });
  if (duplicate && duplicate.id !== record.id) {
    return res.status(409).json({ error: 'Attendance record already exists for this user and event' });
  }

  await record.update({ userId: nextUserId, eventId: nextEventId });
  return res.json(record);
});

// DELETE /api/attendance/:id
router.delete('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  if (!record) return res.status(404).json({ error: 'Attendance record not found' });

  const isOwner = record.userId === req.user.id;
  const isOrganizer = req.user.role === 'organizer';
  if (!isOwner && !isOrganizer) {
    return res.status(403).json({ error: 'Forbidden: cannot delete this attendance record' });
  }

  await record.destroy();
  return res.status(204).send();
});

// GET /api/attendance/event/:eventId/summary - get attendance summary for an event
router.get('/event/:eventId/summary', authenticate, validateIdParam('eventId'), async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const attendanceCount = await Attendance.count({ where: { eventId: req.params.eventId } });

  return res.json({
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
    },
    attendanceSummary: {
      totalAttendees: attendanceCount,
    },
  });
});

module.exports = router;
