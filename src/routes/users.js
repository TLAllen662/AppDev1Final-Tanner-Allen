'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../database');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validateId');

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

// GET /api/users
router.get('/', authenticate, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  const users = await User.findAll();
  return res.json(users.map(sanitizeUser));
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
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
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

  if (name !== undefined) updates.name = name;
  if (email !== undefined) {
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.id !== targetId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    updates.email = email;
  }
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 12);
  if (isOrganizer && role !== undefined) {
    updates.role = role === 'organizer' ? 'organizer' : 'user';
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

module.exports = router;
