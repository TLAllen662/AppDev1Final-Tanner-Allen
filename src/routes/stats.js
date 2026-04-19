'use strict';
const express = require('express');
const { Op, fn, col } = require('sequelize');
const { User, Event, Attendance, Group } = require('../database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

/**
 * GET /api/stats/platform
 * Get platform-wide statistics (organizers only)
 * Shows aggregate data across all resources
 */
router.get('/platform', authenticate, authorize('organizer'), async (req, res) => {
  const [
    userCount,
    organizerCount,
    eventCount,
    groupCount,
    totalAttendance,
  ] = await Promise.all([
    User.count({ where: { role: 'user' } }),
    User.count({ where: { role: 'organizer' } }),
    Event.count(),
    Group.count(),
    Attendance.count(),
  ]);

  return res.json({
    platform: {
      totalUsers: userCount + organizerCount,
      users: userCount,
      organizers: organizerCount,
      totalEvents: eventCount,
      totalGroups: groupCount,
      totalAttendanceRecords: totalAttendance,
      averageAttendancePerEvent: eventCount > 0 ? Math.round((totalAttendance / eventCount) * 100) / 100 : 0,
    },
  });
});

/**
 * GET /api/stats/activity
 * Get activity statistics for authenticated user
 */
router.get('/activity', authenticate, async (req, res) => {
  const userId = req.user.id;
  const isOrganizer = req.user.role === 'organizer';

  let stats = {
    eventsAttending: await Attendance.count({ where: { userId } }),
  };

  if (isOrganizer) {
    stats.eventsOrganized = await Event.count({ where: { organizerId: userId } });
    stats.groupsCreated = await Group.count({ where: { creatorId: userId } });
  }

  return res.json({ statistics: stats });
});

/**
 * GET /api/stats/popular-events
 * Get most attended events with pagination
 */
router.get('/popular-events', authenticate, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const events = await Event.findAll({
    include: [{
      model: Attendance,
      as: 'attendanceRecords',
      attributes: [],
      required: false,
    }],
    attributes: {
      include: [[fn('COUNT', col('attendanceRecords.id')), 'attendeeCount']],
    },
    order: [[fn('COUNT', col('attendanceRecords.id')), 'DESC']],
    subQuery: false,
    limit,
    raw: true,
  });

  // Convert to proper format
  const formattedEvents = events.map(e => ({
    id: e.id,
    name: e.name,
    date: e.date,
    location: e.location,
    attendeeCount: parseInt(e.attendeeCount) || 0,
  }));

  return res.json({ popularEvents: formattedEvents });
});

/**
 * GET /api/stats/active-organizers
 * Get most active organizers (most events organized)
 */
router.get('/active-organizers', authenticate, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const organizers = await User.findAll({
    where: { role: 'organizer' },
    include: [{
      model: Event,
      as: 'organizedEvents',
      attributes: [],
      required: false,
    }],
    attributes: {
      include: [[fn('COUNT', col('organizedEvents.id')), 'eventCount']],
    },
    order: [[fn('COUNT', col('organizedEvents.id')), 'DESC']],
    subQuery: false,
    limit,
    raw: true,
  });

  const formatted = organizers.map(o => ({
    id: o.id,
    name: o.name,
    email: o.email,
    eventsOrganized: parseInt(o.eventCount) || 0,
  }));

  return res.json({ activeOrganizers: formatted });
});

/**
 * GET /api/stats/event-occupancy
 * Get event occupancy rates (attendees vs created events)
 */
router.get('/event-occupancy', authenticate, authorize('organizer'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  // Get upcoming events with attendance counts
  const events = await Event.findAll({
    where: { date: { [Op.gte]: today } },
    include: [{
      model: Attendance,
      as: 'attendanceRecords',
      attributes: ['id'],
    }],
    limit: 20,
    order: [['date', 'ASC']],
  });

  const eventStats = events.map(e => ({
    id: e.id,
    name: e.name,
    date: e.date,
    attendeeCount: e.attendanceRecords.length,
  }));

  return res.json({ upcomingEvents: eventStats });
});

/**
 * GET /api/stats/group-analytics
 * Get analytics for groups (events and members)
 */
router.get('/group-analytics', authenticate, authorize('organizer'), async (req, res) => {
  const groups = await Group.findAll({
    include: [{
      model: Event,
      as: 'events',
      attributes: ['id'],
    }],
    limit: 20,
    order: [['name', 'ASC']],
  });

  const groupStats = await Promise.all(
    groups.map(async (group) => {
      const totalAttendance = await Attendance.count({
        include: [{
          model: Event,
          as: 'event',
          where: { groupId: group.id },
          attributes: [],
        }],
      });

      return {
        id: group.id,
        name: group.name,
        eventCount: group.events.length,
        totalAttendance,
      };
    })
  );

  return res.json({ groups: groupStats });
});

module.exports = router;
