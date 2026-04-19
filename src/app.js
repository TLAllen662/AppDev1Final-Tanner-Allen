'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requestLogger } = require('./middleware/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const attendanceRoutes = require('./routes/attendance');
const groupRoutes = require('./routes/groups');
const statsRoutes = require('./routes/stats');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Root endpoint for deployment sanity checks
app.get('/', (req, res) => {
	return res.json({
		message: 'API is running',
		health: '/health',
	});
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;
