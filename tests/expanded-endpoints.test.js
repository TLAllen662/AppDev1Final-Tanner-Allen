'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const path = require('path');
const fs = require('fs');
process.env.DB_STORAGE = path.join(__dirname, 'expanded-endpoints.test.sqlite');

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Group, Event, Attendance } = require('../src/database');

async function registerAndLogin({ name, email, password = 'password123', role = 'user' }) {
  await request(app).post('/api/auth/register').send({ name, email, password, role });
  if (role === 'organizer') {
    await User.update({ role: 'organizer' }, { where: { email } });
  }
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.token;
}

describe('Expanded API endpoints and edge cases', () => {
  let organizerToken;
  let userToken;
  let userTwoToken;
  let organizerId;
  let userId;
  let userTwoId;
  let groupedEventId;
  let ungroupedEventId;
  let groupId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    organizerToken = await registerAndLogin({
      name: 'Organizer',
      email: 'org@example.com',
      role: 'organizer',
    });
    userToken = await registerAndLogin({
      name: 'User One',
      email: 'user1@example.com',
    });
    userTwoToken = await registerAndLogin({
      name: 'User Two',
      email: 'user2@example.com',
    });

    const [organizer, userOne, userTwo] = await Promise.all([
      User.findOne({ where: { email: 'org@example.com' } }),
      User.findOne({ where: { email: 'user1@example.com' } }),
      User.findOne({ where: { email: 'user2@example.com' } }),
    ]);

    organizerId = organizer.id;
    userId = userOne.id;
    userTwoId = userTwo.id;

    const groupRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Engineering Guild' });
    groupId = groupRes.body.id;

    const groupedEventRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Engineering Summit',
        location: 'HQ Auditorium',
        date: '2099-12-01',
        time: '10:00:00',
        description: 'Future conference',
        groupId,
      });
    groupedEventId = groupedEventRes.body.id;

    const ungroupedEventRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Solo Meetup',
        location: 'Cafe Room',
        date: '2099-12-10',
        time: '18:00:00',
      });
    ungroupedEventId = ungroupedEventRes.body.id;

    await Attendance.create({ userId, eventId: groupedEventId });
    await Attendance.create({ userId: userTwoId, eventId: groupedEventId });
    await Attendance.create({ userId, eventId: ungroupedEventId });
  });

  afterAll(async () => {
    await sequelize.close();
    if (fs.existsSync(process.env.DB_STORAGE)) {
      fs.unlinkSync(process.env.DB_STORAGE);
    }
  });

  describe('Authentication edge cases', () => {
    it('POST /api/auth/register ignores requested organizer role', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Role Escalation Attempt',
        email: 'attempt@example.com',
        password: 'password123',
        role: 'organizer',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.role).toBe('user');
    });

    it('POST /api/auth/login returns 400 for invalid email format', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('GET /api/auth/me returns 401 for invalid bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer definitely-invalid-token');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Invalid token');
    });

    it('POST /api/auth/logout returns 401 when token is missing', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('Missing Authorization header');
    });
  });

  describe('Authorization and RBAC for expanded endpoints', () => {
    it('GET /api/stats/platform denies non-organizer', async () => {
      const res = await request(app)
        .get('/api/stats/platform')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('GET /api/stats/platform allows organizer', async () => {
      const res = await request(app)
        .get('/api/stats/platform')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.platform).toHaveProperty('totalUsers');
      expect(res.body.platform).toHaveProperty('totalEvents');
    });

    it('GET /api/users/:id/attendance blocks other non-organizer users', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}/attendance`)
        .set('Authorization', `Bearer ${userTwoToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('cannot view other users attendance');
    });

    it('GET /api/users/:id/attendance allows organizer to view anyone', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}/attendance?limit=1&offset=0`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.attendee.id).toBe(userId);
      expect(Array.isArray(res.body.events.data)).toBe(true);
      expect(res.body.events.pagination).toBeDefined();
    });
  });

  describe('Expanded endpoint functionality', () => {
    it('GET /api/events supports pagination, search, and filtering', async () => {
      const res = await request(app)
        .get('/api/events?search=Engineering&startDate=2099-01-01&limit=1&offset=0&sort=date:asc')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.data[0].name).toContain('Engineering');
    });

    it('GET /api/events returns validation error for invalid startDate', async () => {
      const res = await request(app)
        .get('/api/events?startDate=12-01-2099')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('GET /api/events/upcoming/list returns paginated upcoming events', async () => {
      const res = await request(app)
        .get('/api/events/upcoming/list?limit=2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('GET /api/events/:id/attendees returns attendee list with metadata', async () => {
      const res = await request(app)
        .get(`/api/events/${groupedEventId}/attendees`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.event.id).toBe(groupedEventId);
      expect(res.body.event.attendeeCount).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.attendees.data)).toBe(true);
    });

    it('GET /api/events/:id/group returns associated group', async () => {
      const res = await request(app)
        .get(`/api/events/${groupedEventId}/group`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(groupId);
      expect(res.body.name).toBe('Engineering Guild');
    });

    it('GET /api/events/:id/group returns 404 when event has no group', async () => {
      const res = await request(app)
        .get(`/api/events/${ungroupedEventId}/group`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('not associated');
    });

    it('GET /api/groups supports pagination, sort, and search', async () => {
      const res = await request(app)
        .get('/api/groups?search=Engineering&limit=5&offset=0&sort=name:asc')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('GET /api/groups/:id/events returns paginated group events', async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/events?limit=2`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.group.id).toBe(groupId);
      expect(Array.isArray(res.body.events.data)).toBe(true);
      expect(res.body.events.pagination).toBeDefined();
    });

    it('GET /api/groups/:id/creator returns creator aggregate stats', async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/creator`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.creator.id).toBe(organizerId);
      expect(typeof res.body.groupsCreated).toBe('number');
      expect(typeof res.body.eventsOrganized).toBe('number');
    });

    it('GET /api/users/:id/events returns paginated organized events', async () => {
      const res = await request(app)
        .get(`/api/users/${organizerId}/events?limit=1&offset=0`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.organizer.id).toBe(organizerId);
      expect(Array.isArray(res.body.events.data)).toBe(true);
      expect(res.body.events.pagination.limit).toBe(1);
    });

    it('GET /api/users/:id/stats returns user statistics', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.statistics).toHaveProperty('eventsAttending');
      expect(res.body.statistics).toHaveProperty('eventsOrganized');
      expect(res.body.statistics).toHaveProperty('groupsCreated');
    });

    it('GET /api/attendance supports filtering and paginated responses', async () => {
      const res = await request(app)
        .get(`/api/attendance?eventId=${groupedEventId}&limit=5&sort=createdAt:desc`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.data.every(r => r.eventId === groupedEventId)).toBe(true);
    });

    it('GET /api/attendance/event/:eventId/summary returns event attendance summary', async () => {
      const res = await request(app)
        .get(`/api/attendance/event/${groupedEventId}/summary`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.event.id).toBe(groupedEventId);
      expect(res.body.attendanceSummary.totalAttendees).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/attendance/event/:eventId/summary returns 404 for missing event', async () => {
      const res = await request(app)
        .get('/api/attendance/event/999999/summary')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Event not found');
    });

    it('GET /api/stats/popular-events honors limit', async () => {
      const res = await request(app)
        .get('/api/stats/popular-events?limit=1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.popularEvents)).toBe(true);
      expect(res.body.popularEvents.length).toBeLessThanOrEqual(1);
      if (res.body.popularEvents.length === 1) {
        expect(res.body.popularEvents[0]).toHaveProperty('attendeeCount');
      }
    });

    it('GET /api/stats/active-organizers honors limit', async () => {
      const res = await request(app)
        .get('/api/stats/active-organizers?limit=1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.activeOrganizers)).toBe(true);
      expect(res.body.activeOrganizers.length).toBeLessThanOrEqual(1);
      if (res.body.activeOrganizers.length === 1) {
        expect(res.body.activeOrganizers[0]).toHaveProperty('eventsOrganized');
      }
    });

    it('GET /api/stats/event-occupancy requires organizer role', async () => {
      const forbiddenRes = await request(app)
        .get('/api/stats/event-occupancy')
        .set('Authorization', `Bearer ${userToken}`);

      expect(forbiddenRes.statusCode).toBe(403);

      const allowedRes = await request(app)
        .get('/api/stats/event-occupancy')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(allowedRes.statusCode).toBe(200);
      expect(Array.isArray(allowedRes.body.upcomingEvents)).toBe(true);
    });

    it('GET /api/stats/group-analytics requires organizer role', async () => {
      const forbiddenRes = await request(app)
        .get('/api/stats/group-analytics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(forbiddenRes.statusCode).toBe(403);

      const allowedRes = await request(app)
        .get('/api/stats/group-analytics')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(allowedRes.statusCode).toBe(200);
      expect(Array.isArray(allowedRes.body.groups)).toBe(true);
    });
  });
});
