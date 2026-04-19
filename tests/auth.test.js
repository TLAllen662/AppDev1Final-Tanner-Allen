'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const path = require('path');
const fs = require('fs');
process.env.DB_STORAGE = path.join(__dirname, 'auth.test.sqlite');

const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/database');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
  if (fs.existsSync(process.env.DB_STORAGE)) {
    fs.unlinkSync(process.env.DB_STORAGE);
  }
});

describe('Health check', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth routes', () => {
  it('POST /api/auth/register creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.role).toBe('user');
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Again',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /api/auth/login returns a token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/login rejects bad password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/login returns user info with token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('user');
  });

  it('GET /api/auth/me returns authenticated user', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    const token = loginRes.body.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.role).toBe('user');
  });

  it('GET /api/auth/me rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/validate validates token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    const token = loginRes.body.token;

    const res = await request(app).post('/api/auth/validate').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('POST /api/auth/logout confirms logout', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    const token = loginRes.body.token;

    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('Logout successful');
  });
});
