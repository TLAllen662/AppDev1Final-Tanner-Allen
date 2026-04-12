'use strict';
const express = require('express');
const { Group } = require('../database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /api/groups
router.get('/', authenticate, async (req, res) => {
  const groups = await Group.findAll();
  return res.json(groups);
});

// GET /api/groups/:id
router.get('/:id', authenticate, async (req, res) => {
  const group = await Group.findByPk(req.params.id, { include: ['events'] });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  return res.json(group);
});

// POST /api/groups - organizers only
router.post('/', authenticate, authorize('organizer'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const group = await Group.create({ name, creatorId: req.user.id });
  return res.status(201).json(group);
});

// PUT /api/groups/:id - creator only
router.put('/:id', authenticate, authorize('organizer'), async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own groups' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  await group.update({ name });
  return res.json(group);
});

// DELETE /api/groups/:id - creator only
router.delete('/:id', authenticate, authorize('organizer'), async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own groups' });
  }
  await group.destroy();
  return res.status(204).send();
});

module.exports = router;
