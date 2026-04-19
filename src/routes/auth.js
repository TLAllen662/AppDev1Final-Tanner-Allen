'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../database');
const { authenticate } = require('../middleware/auth');
const { isNonEmptyString, isValidEmail, validationError } = require('../middleware/validationHelpers');

const router = express.Router();

// Verify JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Please configure it in your .env file.');
}

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
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// GET /api/auth/me - Get current authenticated user info
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

// POST /api/auth/validate - Validate current token
router.post('/validate', authenticate, (req, res) => {
  return res.json({
    valid: true,
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

// POST /api/auth/logout - Logout endpoint (token removal is client-side)
router.post('/logout', authenticate, (req, res) => {
  // In JWT-based systems, logout is typically handled client-side by removing the token.
  // This endpoint serves as a confirmation endpoint and can be extended for blacklist management if needed.
  return res.json({ message: 'Logout successful. Please remove the token from your client.' });
});

module.exports = router;
