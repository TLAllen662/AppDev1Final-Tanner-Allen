'use strict';
const express = require('express');
const { Event, User, Attendance } = require('../database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/validateId');

const router = express.Router();

// GET /api/events - view all public events (authenticated)
router.get('/', authenticate, async (req, res) => {
  const events = await Event.findAll({ include: [{ model: User, as: 'organizer', attributes: ['id', 'name'] }] });
  return res.json(events);
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

// POST /api/events - organizers only
router.post('/', authenticate, authorize('organizer'), async (req, res) => {
  const { name, location, date, time, description, groupId } = req.body;
  if (!name || !location || !date || !time) {
    return res.status(400).json({ error: 'name, location, date, and time are required' });
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

// PUT /api/events/:id - organizer who created it only
router.put('/:id', authenticate, authorize('organizer'), validateIdParam('id'), async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own events' });
  }

  const { name, location, date, time, description, groupId } = req.body;
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
