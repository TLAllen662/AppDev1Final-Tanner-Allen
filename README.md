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

## Authentication

Protected routes require:

`Authorization: Bearer <token>`

Get a token with:

1. `POST /api/auth/register`
2. `POST /api/auth/login`

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