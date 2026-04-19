'use strict';
const express = require('express');
const { Op } = require('sequelize');
const { Group, Event, User } = require('../database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/validateId');
const { isNonEmptyString, validationError, parsePaginationParams, parseSortParams, paginatedResponse } = require('../middleware/validationHelpers');

const router = express.Router();

// GET /api/groups - view all groups with pagination, filtering, sorting
router.get('/', authenticate, async (req, res) => {
  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['name', 'createdAt']);

  // Build where clause for search and filtering
  const where = {};

  // Search filter
  if (req.query.search) {
    where.name = { [Op.like]: `%${req.query.search}%` };
  }

  // Creator filter
  if (req.query.creatorId) {
    where.creatorId = Number(req.query.creatorId);
  }

  const { count, rows } = await Group.findAndCountAll({
    where,
    include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
    limit,
    offset,
    order: sort.length ? sort : [['name', 'ASC']],
    distinct: true,
  });

  return res.json(paginatedResponse(rows, count, limit, offset));
});

// GET /api/groups/:id
router.get('/:id', authenticate, validateIdParam('id'), async (req, res) => {
  const group = await Group.findByPk(req.params.id, { include: ['events'] });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  return res.json(group);
});

// POST /api/groups - organizers only
router.post('/', authenticate, authorize('organizer'), async (req, res) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) {
    return validationError(res, ['name is required and must be a non-empty string']);
  }
  const group = await Group.create({ name, creatorId: req.user.id });
  return res.status(201).json(group);
});

// PUT /api/groups/:id - creator only
router.put('/:id', authenticate, authorize('organizer'), validateIdParam('id'), async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own groups' });
  }

  const { name } = req.body;
  if (!isNonEmptyString(name)) {
    return validationError(res, ['name is required and must be a non-empty string']);
  }

  await group.update({ name });
  return res.json(group);
});

// DELETE /api/groups/:id - creator only
router.delete('/:id', authenticate, authorize('organizer'), validateIdParam('id'), async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own groups' });
  }
  await group.destroy();
  return res.status(204).send();
});

// GET /api/groups/:id/events - get events in a group with pagination
router.get('/:id/events', authenticate, validateIdParam('id'), async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { limit, offset } = parsePaginationParams(req.query);
  const sort = parseSortParams(req.query.sort, ['date', 'name', 'createdAt']);

  const { count, rows } = await Event.findAndCountAll({
    where: { groupId: req.params.id },
    include: [{ model: User, as: 'organizer', attributes: ['id', 'name'] }],
    limit,
    offset,
    order: sort.length ? sort : [['date', 'ASC']],
    distinct: true,
  });

  return res.json({
    group: {
      id: group.id,
      name: group.name,
      eventCount: count,
    },
    events: paginatedResponse(rows, count, limit, offset),
  });
});

// GET /api/groups/:id/creator - get group creator with events count
router.get('/:id/creator', authenticate, validateIdParam('id'), async (req, res) => {
  const group = await Group.findByPk(req.params.id, {
    include: [{
      model: User,
      as: 'creator',
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
    }],
  });

  if (!group) return res.status(404).json({ error: 'Group not found' });

  // Count events created by this creator
  const eventCount = await Event.count({ where: { organizerId: group.creator.id } });
  const groupCount = await Group.count({ where: { creatorId: group.creator.id } });

  return res.json({
    creator: group.creator,
    groupsCreated: groupCount,
    eventsOrganized: eventCount,
  });
});

module.exports = router;
