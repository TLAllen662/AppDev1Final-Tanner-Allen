'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const path = require('path');
const fs = require('fs');
process.env.DB_STORAGE = path.join(__dirname, 'authorization.test.sqlite');

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Event, Group } = require('../src/database');

let userToken;
let userId;
let organizerToken;
let organizerId;
let organizerToken2;
let organizerId2;
let eventId;
let groupId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Create test users
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await User.create({
    name: 'Test User',
    email: 'user@example.com',
    passwordHash,
    role: 'user',
  });
  userId = user.id;

  const organizer = await User.create({
    name: 'Test Organizer 1',
    email: 'organizer1@example.com',
    passwordHash,
    role: 'organizer',
  });
  organizerId = organizer.id;

  const organizer2 = await User.create({
    name: 'Test Organizer 2',
    email: 'organizer2@example.com',
    passwordHash,
    role: 'organizer',
  });
  organizerId2 = organizer2.id;

  // Get tokens
  const userLoginRes = await request(app).post('/api/auth/login').send({
    email: 'user@example.com',
    password: 'password123',
  });
  userToken = userLoginRes.body.token;

  const orgLoginRes = await request(app).post('/api/auth/login').send({
    email: 'organizer1@example.com',
    password: 'password123',
  });
  organizerToken = orgLoginRes.body.token;

  const orgLoginRes2 = await request(app).post('/api/auth/login').send({
    email: 'organizer2@example.com',
    password: 'password123',
  });
  organizerToken2 = orgLoginRes2.body.token;

  // Create test event
  const eventRes = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Test Event',
      location: 'Test Location',
      date: '2026-06-01',
      time: '14:00:00',
    });
  eventId = eventRes.body.id;

  // Create test group
  const groupRes = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Test Group',
    });
  groupId = groupRes.body.id;
});

afterAll(async () => {
  await sequelize.close();
  if (fs.existsSync(process.env.DB_STORAGE)) {
    fs.unlinkSync(process.env.DB_STORAGE);
  }
});

describe('Authorization: Role-Based Access Control', () => {
  describe('Users endpoint - GET /api/users', () => {
    it('User should not access GET /api/users (organizer only)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('insufficient permissions');
    });

    it('Organizer should access GET /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.pagination).toBeDefined();
    });

    it('No token should return 401', async () => {
      const res = await request(app).get('/api/users');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Users endpoint - POST /api/users (Create)', () => {
    it('User should not create users (organizer only)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should create users', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.role).toBe('user');
    });

    it('Organizer should create other organizers', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'New Organizer',
          email: 'neworg@example.com',
          password: 'password123',
          role: 'organizer',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.role).toBe('organizer');
    });
  });

  describe('Events endpoint - POST /api/events (Create)', () => {
    it('User should not create events (organizer only)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Event',
          location: 'Location',
          date: '2026-06-15',
          time: '14:00:00',
        });

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should create events', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Organizer Event',
          location: 'Location',
          date: '2026-06-15',
          time: '14:00:00',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.organizerId).toBe(organizerId);
    });
  });

  describe('Events endpoint - PUT /api/events/:id (Ownership Check)', () => {
    it('Event creator should update own event', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Updated Event',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Event');
    });

    it('Different organizer should not update event (not owner)', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerToken2}`)
        .send({
          name: 'Hacked Event',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('own events');
    });

    it('User should not update event', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Hack',
        });

      expect(res.statusCode).toBe(403);
    });

    it('Should return 404 for non-existent event', async () => {
      const res = await request(app)
        .put('/api/events/99999')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Ghost Event',
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Events endpoint - DELETE /api/events/:id (Ownership Check)', () => {
    let deleteEventId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Event to Delete',
          location: 'Location',
          date: '2026-06-20',
          time: '14:00:00',
        });
      deleteEventId = res.body.id;
    });

    it('Event creator should delete own event', async () => {
      const res = await request(app)
        .delete(`/api/events/${deleteEventId}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(204);
    });

    it('Different organizer should not delete event (not owner)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Another Event',
          location: 'Location',
          date: '2026-06-21',
          time: '14:00:00',
        });
      const eventToProtect = res.body.id;

      const deleteRes = await request(app)
        .delete(`/api/events/${eventToProtect}`)
        .set('Authorization', `Bearer ${organizerToken2}`);

      expect(deleteRes.statusCode).toBe(403);
    });

    it('User should not delete event', async () => {
      const res = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Groups endpoint - POST /api/groups (Create)', () => {
    it('User should not create groups (organizer only)', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Group',
        });

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should create groups', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Organizer Group',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.creatorId).toBe(organizerId);
    });
  });

  describe('Groups endpoint - PUT /api/groups/:id (Ownership Check)', () => {
    it('Group creator should update own group', async () => {
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Updated Group Name',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Group Name');
    });

    it('Different organizer should not update group (not creator)', async () => {
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${organizerToken2}`)
        .send({
          name: 'Hacked Group',
        });

      expect(res.statusCode).toBe(403);
    });

    it('User should not update group', async () => {
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Hack',
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Groups endpoint - DELETE /api/groups/:id (Ownership Check)', () => {
    let deleteGroupId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Group to Delete',
        });
      deleteGroupId = res.body.id;
    });

    it('Group creator should delete own group', async () => {
      const res = await request(app)
        .delete(`/api/groups/${deleteGroupId}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(204);
    });

    it('Different organizer should not delete group (not creator)', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Another Group',
        });
      const groupToProtect = res.body.id;

      const deleteRes = await request(app)
        .delete(`/api/groups/${groupToProtect}`)
        .set('Authorization', `Bearer ${organizerToken2}`);

      expect(deleteRes.statusCode).toBe(403);
    });
  });

  describe('Users endpoint - Self access', () => {
    it('User should view own profile', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(userId);
    });

    it('User should not view other user profiles', async () => {
      const res = await request(app)
        .get(`/api/users/${organizerId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should view all user profiles', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Users endpoint - PUT /api/users/:id (Update)', () => {
    it('User should update own profile', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Updated User Name',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated User Name');
    });

    it('User should not update other users', async () => {
      const res = await request(app)
        .put(`/api/users/${organizerId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Organizer',
        });

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should update other users', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Admin Updated Name',
        });

      expect(res.statusCode).toBe(200);
    });

    it('User should not promote themselves to organizer', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          role: 'organizer',
        });

      // User can't change role (request is rejected because no valid updates)
      expect(res.statusCode).toBe(400);
      
      // Verify role wasn't changed by checking with organizer token
      const checkRes = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${organizerToken}`);
      expect(checkRes.body.role).toBe('user');
    });

    it('Organizer should promote users to organizer', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          role: 'organizer',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe('organizer');
    });
  });

  describe('Users endpoint - DELETE /api/users/:id (Delete)', () => {
    let deleteUserId;

    beforeAll(async () => {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 12);
      const deleteUser = await User.create({
        name: 'User to Delete',
        email: 'delete.me@example.com',
        passwordHash,
        role: 'user',
      });
      deleteUserId = deleteUser.id;
    });

    it('User should delete own account', async () => {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 12);
      const selfDeleteUser = await User.create({
        name: 'Self Delete User',
        email: 'selfdelete@example.com',
        passwordHash,
        role: 'user',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'selfdelete@example.com',
        password: 'password123',
      });
      const selfToken = loginRes.body.token;

      const res = await request(app)
        .delete(`/api/users/${selfDeleteUser.id}`)
        .set('Authorization', `Bearer ${selfToken}`);

      expect(res.statusCode).toBe(204);
    });

    it('User should not delete other users', async () => {
      const res = await request(app)
        .delete(`/api/users/${organizerId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('Organizer should delete users', async () => {
      const res = await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe('Authentication failures', () => {
    it('Missing Authorization header returns 401', async () => {
      const res = await request(app).get('/api/users');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('Authorization');
    });

    it('Invalid token format returns 401', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'InvalidFormat token123');

      expect(res.statusCode).toBe(401);
    });

    it('Malformed token returns 401', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.statusCode).toBe(401);
    });
  });
});
