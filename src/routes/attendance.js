'use strict';
const express = require('express');
const { Attendance, Event, User } = require('../database');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validateId');

const router = express.Router();

// GET /api/attendance
router.get('/', authenticate, async (req, res) => {
  const where = req.user.role === 'organizer' ? {} : { userId: req.user.id };
  const records = await Attendance.findAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: Event, as: 'event', attributes: ['id', 'name', 'date', 'time', 'location'] },
    ],
  });

  return res.json(records);
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

  if (!eventId) return res.status(400).json({ error: 'eventId is required' });

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

module.exports = router;
