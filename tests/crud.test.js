'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const path = require('path');
const fs = require('fs');
process.env.DB_STORAGE = path.join(__dirname, 'crud.test.sqlite');

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/database');

async function registerAndLogin({ name, email, password, role }) {
  await request(app).post('/api/auth/register').send({ name, email, password, role });
  if (role === 'organizer') {
    await User.update({ role: 'organizer' }, { where: { email } });
  }
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.token;
}

describe('CRUD routes', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
    if (fs.existsSync(process.env.DB_STORAGE)) {
      fs.unlinkSync(process.env.DB_STORAGE);
    }
  });

  describe('Users resource (Read)', () => {
    it('GET /api/users/:id returns own user profile', async () => {
      const password = 'password123';
      const userToken = await registerAndLogin({
        name: 'User One',
        email: 'user.one@example.com',
        password,
        role: 'user',
      });

      const meRes = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(meRes.statusCode).toBe(200);
      expect(meRes.body.email).toBe('user.one@example.com');
      expect(meRes.body).not.toHaveProperty('passwordHash');
    });

    it('GET /api/users/:id returns 403 for another user profile', async () => {
      const password = 'password123';

      await registerAndLogin({
        name: 'User One',
        email: 'user.one@example.com',
        password,
        role: 'user',
      });
      const userTwoToken = await registerAndLogin({
        name: 'User Two',
        email: 'user.two@example.com',
        password,
        role: 'user',
      });

      const res = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${userTwoToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Events resource (Create)', () => {
    it('POST /api/events creates event for organizer', async () => {
      const organizerToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Test Event',
          location: 'Main Hall',
          date: '2026-06-15',
          time: '18:00:00',
          description: 'Event description',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Test Event');
      expect(res.body.organizerId).toBe(1);
    });

    it('POST /api/events returns 400 for invalid date format', async () => {
      const organizerToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Test Event',
          location: 'Main Hall',
          date: '06/15/2026',
          time: '18:00',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('Groups resource (Update)', () => {
    it('PUT /api/groups/:id updates group for creator organizer', async () => {
      const organizerToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Old Group Name' });

      const updateRes = await request(app)
        .put(`/api/groups/${groupRes.body.id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'New Group Name' });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.name).toBe('New Group Name');
    });

    it('PUT /api/groups/:id returns 403 for non-creator organizer', async () => {
      const creatorToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const otherOrganizerToken = await registerAndLogin({
        name: 'Organizer Two',
        email: 'organizer.two@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ name: 'Creator Group' });

      const updateRes = await request(app)
        .put(`/api/groups/${groupRes.body.id}`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`)
        .send({ name: 'Attempted Update' });

      expect(updateRes.statusCode).toBe(403);
    });
  });

  describe('Attendance resource (Delete)', () => {
    it('DELETE /api/attendance/:id deletes attendance record for owner', async () => {
      const organizerToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const userToken = await registerAndLogin({
        name: 'User One',
        email: 'user.one@example.com',
        password: 'password123',
        role: 'user',
      });

      const eventRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Attendance Event',
          location: 'Gym',
          date: '2026-07-01',
          time: '09:00:00',
        });

      const attendanceRes = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId: eventRes.body.id });

      const deleteRes = await request(app)
        .delete(`/api/attendance/${attendanceRes.body.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.statusCode).toBe(204);
    });

    it('DELETE /api/attendance/:id returns 404 for non-existent record', async () => {
      const organizerToken = await registerAndLogin({
        name: 'Organizer One',
        email: 'organizer.one@example.com',
        password: 'password123',
        role: 'organizer',
      });

      const res = await request(app)
        .delete('/api/attendance/999')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Attendance record not found');
    });
  });
});
