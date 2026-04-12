'use strict';
const express = require('express');
const { Attendance, Event } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/attendance/:eventId/join
router.post('/:eventId/join', authenticate, async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const existing = await Attendance.findOne({
    where: { userId: req.user.id, eventId: event.id },
  });
  if (existing) return res.status(409).json({ error: 'Already attending this event' });

  const record = await Attendance.create({ userId: req.user.id, eventId: event.id });
  return res.status(201).json(record);
});

// DELETE /api/attendance/:eventId/leave
router.delete('/:eventId/leave', authenticate, async (req, res) => {
  const record = await Attendance.findOne({
    where: { userId: req.user.id, eventId: req.params.eventId },
  });
  if (!record) return res.status(404).json({ error: 'Attendance record not found' });

  await record.destroy();
  return res.status(204).send();
});

module.exports = router;
