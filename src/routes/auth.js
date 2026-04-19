'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../database');
const { isNonEmptyString, isValidEmail, validationError } = require('../middleware/validationHelpers');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const details = [];

  if (!isNonEmptyString(name)) details.push('name is required and must be a non-empty string');
  if (!isValidEmail(email)) details.push('email is required and must be a valid email address');
  if (!isNonEmptyString(password) || password.length < 8) details.push('password is required and must be at least 8 characters');

  if (details.length > 0) {
    return validationError(res, details);
  }

  // Note: role parameter is intentionally ignored for public registration.
  // All new accounts are created as 'user'. Organizer promotions must go through admin-only flows.

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'user',
  });

  return res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const details = [];

  if (!isValidEmail(email)) details.push('email is required and must be a valid email address');
  if (!isNonEmptyString(password)) details.push('password is required and must be a non-empty string');

  if (details.length > 0) {
    return validationError(res, details);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({ token });
});

module.exports = router;
