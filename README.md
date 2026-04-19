# AppDev1Final-Tanner-Allen

## Project Overview

This project is an Express + Sequelize API for managing:

1. Users
2. Events
3. Groups
4. Attendance records

It includes JWT-based authentication, role-based authorization, validation, and centralized JSON error handling.

## Tech Stack

1. Node.js + Express
2. Sequelize ORM
3. SQLite
4. JWT authentication
5. Jest + Supertest testing

## Local Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root.

Example:

```env
PORT=3000
JWT_SECRET=replace-with-a-strong-secret
NODE_ENV=development
```

### 3) Initialize database tables and relationships

```bash
npm run db:setup
```

### 4) Optional: seed realistic sample data

```bash
npm run db:seed
```

### 5) Start the API

```bash
npm run dev
```

or

```bash
npm start
```

### 6) Run tests

```bash
npm test
```

## Base URL

Local development base URL:

`http://localhost:3000`

## Deploy To Render

### 1) One-time setup

This project supports both SQLite (local) and Postgres (production). On Render, use Postgres through `DATABASE_URL`.

Two deployment options are supported:

1. Blueprint deploy with `render.yaml` (recommended)
2. Manual Web Service + Postgres setup in Render dashboard

### 2) Blueprint deploy (recommended)

1. Push this repository to GitHub.
2. In Render, select **New +** -> **Blueprint**.
3. Point to this repository.
4. Render will create:
	 1. A web service named `appdev1final-api`
	 2. A Postgres database named `appdev1final-db`
5. Confirm env vars:
	 1. `NODE_ENV=production`
	 2. `JWT_SECRET` (auto-generated)
	 3. `JWT_EXPIRES_IN=8h`
	 4. `DATABASE_URL` (from Postgres connection string)
	 5. `DB_SSL=false` (set to `true` only if your DB endpoint requires SSL)

Build/start commands:

```bash
build: npm ci
start: npm start
```

### 3) Manual setup (alternative)

1. Create a **PostgreSQL** database in Render.
2. Create a **Web Service** from this repository.
3. Runtime: Node.
4. Build Command: `npm ci`
5. Start Command: `npm start`
6. Add the same environment variables listed above.

### 4) Production verification checklist

Replace `<RENDER_URL>` with your deployed URL.

Health check:

```bash
curl <RENDER_URL>/health
```

Register user:

```bash
curl -X POST <RENDER_URL>/api/auth/register \
	-H "Content-Type: application/json" \
	-d '{"name":"Prod User","email":"prod.user@example.com","password":"password123"}'
```

Login and capture token:

```bash
curl -X POST <RENDER_URL>/api/auth/login \
	-H "Content-Type: application/json" \
	-d '{"email":"prod.user@example.com","password":"password123"}'
```

Auth check:

```bash
curl <RENDER_URL>/api/auth/me \
	-H "Authorization: Bearer <TOKEN>"
```

Authorization checks:

1. As `user`, call organizer-only endpoint and confirm `403`:

```bash
curl <RENDER_URL>/api/users \
	-H "Authorization: Bearer <TOKEN>"
```

2. Create organizer (via organizer account), login as organizer, then confirm organizer-only success (`200`):

```bash
curl <RENDER_URL>/api/stats/platform \
	-H "Authorization: Bearer <ORGANIZER_TOKEN>"
```

3. Validate expanded endpoints with auth token:

```bash
curl "<RENDER_URL>/api/events?limit=5&offset=0&sort=date:asc" \
	-H "Authorization: Bearer <TOKEN>"
curl "<RENDER_URL>/api/groups?search=Engineering" \
	-H "Authorization: Bearer <TOKEN>"
curl "<RENDER_URL>/api/attendance?limit=5" \
	-H "Authorization: Bearer <TOKEN>"

### 5) One-command post-deploy smoke test

Run the included script after deployment:

```bash
./scripts/render-smoke-test.sh <RENDER_URL>
```

Example:

```bash
./scripts/render-smoke-test.sh https://appdev1final-api.onrender.com
```

Optional organizer success-path verification (recommended):

```bash
ORGANIZER_EMAIL=your.organizer@example.com \
ORGANIZER_PASSWORD=your-password \
./scripts/render-smoke-test.sh https://appdev1final-api.onrender.com
```

The script validates:

1. Health endpoint
2. User registration/login/auth-me
3. RBAC denial for organizer-only endpoints when using user token
4. Core authenticated endpoints (`/api/events`, `/api/groups`, `/api/attendance`, `/api/auth/validate`)
5. Organizer-only success paths when organizer credentials are provided
```

## Authentication

The API uses JWT (JSON Web Tokens) for stateless authentication. All protected routes require an `Authorization` header with a Bearer token.

### Authentication Endpoints

#### 1. Register a New User
**POST** `/api/auth/register`

Create a new user account (automatically assigned `user` role).

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

**Security Note:** The `role` parameter in the request is intentionally ignored. All new registrations start as `user` role. Organizer promotions must be done through admin-only endpoints.

#### 2. Login
**POST** `/api/auth/login`

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### 3. Get Current User Info
**GET** `/api/auth/me`

Retrieve information about the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### 4. Validate Token
**POST** `/api/auth/validate`

Check if the current token is valid.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "role": "user"
  }
}
```

#### 5. Logout
**POST** `/api/auth/logout`

Confirm logout (token removal is handled client-side).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Logout successful. Please remove the token from your client."
}
```

### Using Tokens

All protected endpoints require the `Authorization` header in the following format:

```
Authorization: Bearer <your-jwt-token>
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/api/users
```

### Token Expiration

Tokens expire after 8 hours (configurable via `JWT_EXPIRES_IN` in `.env`). When a token expires, login again to get a new one.

**Error Response (401):**
```json
{
  "error": "Token has expired"
}
```

### Protected Routes Summary

| Method | Route | Auth | Roles |
|--------|-------|------|-------|
| POST | `/api/auth/register` | ❌ | - |
| POST | `/api/auth/login` | ❌ | - |
| GET | `/api/auth/me` | ✅ | user, organizer |
| POST | `/api/auth/validate` | ✅ | user, organizer |
| POST | `/api/auth/logout` | ✅ | user, organizer |
| GET | `/api/users` | ✅ | organizer |
| GET | `/api/users/:id` | ✅ | organizer, self |
| POST | `/api/users` | ✅ | organizer |
| PUT | `/api/users/:id` | ✅ | organizer, self |
| DELETE | `/api/users/:id` | ✅ | organizer, self |
| GET | `/api/events` | ✅ | user, organizer |
| GET | `/api/events/:id` | ✅ | user, organizer |
| POST | `/api/events` | ✅ | organizer |
| PUT | `/api/events/:id` | ✅ | organizer (owner) |
| DELETE | `/api/events/:id` | ✅ | organizer (owner) |
| GET | `/api/groups` | ✅ | user, organizer |
| GET | `/api/groups/:id` | ✅ | user, organizer |
| POST | `/api/groups` | ✅ | organizer |
| PUT | `/api/groups/:id` | ✅ | organizer (creator) |
| DELETE | `/api/groups/:id` | ✅ | organizer (creator) |
| GET | `/api/attendance` | ✅ | user, organizer |
| GET | `/api/attendance/:id` | ✅ | user, organizer |
| POST | `/api/attendance` | ✅ | user, organizer |

Protected routes

## Standard Error Format

Most errors return JSON like:

```json
{
	"error": "Validation error",
	"details": ["name is required and must be a non-empty string"]
}
```

Common status codes:

1. `400` validation or malformed request
2. `401` authentication failure
3. `403` authorization failure
4. `404` resource not found
5. `409` conflict/duplicate resource
6. `500` internal server error
7. `503` database connection error

## API Endpoints

### Auth Endpoints

#### POST /api/auth/register

Required body:

```json
{
	"name": "Jane Organizer",
	"email": "jane@example.com",
	"password": "password123",
	"role": "organizer"
}
```

Success `201`:

```json
{
	"id": 1,
	"name": "Jane Organizer",
	"email": "jane@example.com",
	"role": "organizer"
}
```

#### POST /api/auth/login

Required body:

```json
{
	"email": "jane@example.com",
	"password": "password123"
}
```

Success `200`:

```json
{
	"token": "<jwt-token>"
}
```

### Users CRUD (/api/users)

| Method | URL | Required Params | Required Body | Success Response |
|---|---|---|---|---|
| GET | /api/users | Bearer token (organizer) | None | `200` array of users |
| GET | /api/users/:id | Bearer token, `id` path param | None | `200` user object |
| POST | /api/users | Bearer token (organizer) | `name`, `email`, `password` | `201` created user |
| PUT | /api/users/:id | Bearer token, `id` path param | At least one of `name`, `email`, `password`, `role` | `200` updated user |
| DELETE | /api/users/:id | Bearer token, `id` path param | None | `204` no body |

Example `POST /api/users` request:

```json
{
	"name": "Sam User",
	"email": "sam@example.com",
	"password": "password123",
	"role": "user"
}
```

Example `200` user response:

```json
{
	"id": 2,
	"name": "Sam User",
	"email": "sam@example.com",
	"role": "user",
	"createdAt": "2026-04-12T00:00:00.000Z",
	"updatedAt": "2026-04-12T00:00:00.000Z"
}
```

### Events CRUD (/api/events)

| Method | URL | Required Params | Required Body | Success Response |
|---|---|---|---|---|
| GET | /api/events | Bearer token | None | `200` array of events |
| GET | /api/events/:id | Bearer token, `id` path param | None | `200` event object |
| POST | /api/events | Bearer token (organizer) | `name`, `location`, `date`, `time` | `201` created event |
| PUT | /api/events/:id | Bearer token (creator organizer), `id` | Any editable event fields | `200` updated event |
| DELETE | /api/events/:id | Bearer token (creator organizer), `id` | None | `204` no body |

Example `POST /api/events` request:

```json
{
	"name": "JavaScript Meetup",
	"location": "Main Hall",
	"date": "2026-05-20",
	"time": "18:00:00",
	"description": "Weekly developer meetup",
	"groupId": 1
}
```

Example `201` event response:

```json
{
	"id": 1,
	"organizerId": 1,
	"groupId": 1,
	"name": "JavaScript Meetup",
	"location": "Main Hall",
	"date": "2026-05-20",
	"time": "18:00:00",
	"description": "Weekly developer meetup",
	"createdAt": "2026-04-12T00:00:00.000Z",
	"updatedAt": "2026-04-12T00:00:00.000Z"
}
```

### Groups CRUD (/api/groups)

| Method | URL | Required Params | Required Body | Success Response |
|---|---|---|---|---|
| GET | /api/groups | Bearer token | None | `200` array of groups |
| GET | /api/groups/:id | Bearer token, `id` path param | None | `200` group with events |
| POST | /api/groups | Bearer token (organizer) | `name` | `201` created group |
| PUT | /api/groups/:id | Bearer token (creator organizer), `id` | `name` | `200` updated group |
| DELETE | /api/groups/:id | Bearer token (creator organizer), `id` | None | `204` no body |

Example `POST /api/groups` request:

```json
{
	"name": "Tech Study Circle"
}
```

Example `201` group response:

```json
{
	"id": 1,
	"name": "Tech Study Circle",
	"creatorId": 1,
	"createdAt": "2026-04-12T00:00:00.000Z",
	"updatedAt": "2026-04-12T00:00:00.000Z"
}
```

### Attendance CRUD (/api/attendance)

| Method | URL | Required Params | Required Body | Success Response |
|---|---|---|---|---|
| GET | /api/attendance | Bearer token | None | `200` array of attendance records |
| GET | /api/attendance/:id | Bearer token, `id` path param | None | `200` attendance record |
| POST | /api/attendance | Bearer token | `eventId` (and optional `userId` for organizer) | `201` created record |
| PUT | /api/attendance/:id | Bearer token, `id` path param | Optional `eventId`, optional `userId` (organizer) | `200` updated record |
| DELETE | /api/attendance/:id | Bearer token, `id` path param | None | `204` no body |

Example `POST /api/attendance` request:

```json
{
	"eventId": 1
}
```

Example `201` attendance response:

```json
{
	"id": 1,
	"userId": 2,
	"eventId": 1,
	"createdAt": "2026-04-12T00:00:00.000Z",
	"updatedAt": "2026-04-12T00:00:00.000Z"
}
```

## Postman Documentation

Import the Postman collection at:

`postman/AppDev1Final-Tanner-Allen.postman_collection.json`

The collection includes:

1. Auth requests to register/login and obtain tokens
2. Full CRUD requests for Users, Events, Groups, and Attendance
3. Example requests and saved example responses for each CRUD endpoint