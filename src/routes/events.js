'use strict';
const express = require('express');
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
} = require('../middleware/validationHelpers');

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

  // Validate that groupId exists if provided
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

  // Validate that groupId exists if provided
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
