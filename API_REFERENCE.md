# Comprehensive API Reference

## Complete Endpoint Catalog

This document provides complete coverage of all API endpoints with examples, status codes, and advanced features like pagination, filtering, sorting, and search.

---

## 📊 Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Events](#events)
4. [Groups](#groups)
5. [Attendance](#attendance)
6. [Statistics](#statistics)
7. [Query Parameters](#query-parameters)
8. [Error Handling](#error-handling)

---

## Authentication

### POST `/api/auth/register`
Register a new user account.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123"
  }'
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

### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
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

### GET `/api/auth/me`
Get current authenticated user info.

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

### POST `/api/auth/validate`
Validate current token.

**Response (200):**
```json
{
  "valid": true,
  "user": {"id": 1, "role": "user"}
}
```

### POST `/api/auth/logout`
Logout (remove token client-side).

**Response (200):**
```json
{
  "message": "Logout successful. Please remove the token from your client."
}
```

---

## Users

### GET `/api/users`
List all users with **pagination, filtering, sorting, search** (organizers only).

**Query Parameters:**
- `limit` (1-100, default 20): Records per page
- `offset` (default 0): Starting position
- `sort` (default "name:ASC"): Sort format: "field1:asc,field2:desc"
- `search`: Search by name or email
- `role`: Filter by role ("user" or "organizer")

**Request:**
```bash
curl -X GET "http://localhost:3000/api/users?limit=10&offset=0&search=john&role=user&sort=name:asc" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0,
    "pages": 1,
    "currentPage": 1
  }
}
```

### GET `/api/users/:id`
Get user by ID (self or organizer).

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

### POST `/api/users`
Create new user (organizers only).

**Request:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <organizer-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "password123",
    "role": "organizer"
  }'
```

**Response (201):** User object

### PUT `/api/users/:id`
Update user (self or organizers).

**Request:**
```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "email": "newemail@example.com"
  }'
```

**Response (200):** Updated user object

### DELETE `/api/users/:id`
Delete user (self or organizers).

**Response (204):** No content

### GET `/api/users/:id/events`
Get events organized by user with **pagination and sorting**.

**Query Parameters:**
- `limit` (default 20): Records per page
- `offset` (default 0): Starting position
- `sort`: Sort field (date, name, createdAt)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/users/1/events?limit=10&offset=0&sort=date:asc" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "organizer": {
    "id": 1,
    "name": "John Organizer",
    "email": "john@example.com",
    "eventCount": 5
  },
  "events": {
    "data": [
      {
        "id": 1,
        "name": "Tech Meetup",
        "date": "2026-05-01",
        "location": "Downtown",
        "organizerId": 1
      }
    ],
    "pagination": {...}
  }
}
```

### GET `/api/users/:id/attendance`
Get events user is attending with **pagination and sorting** (self or organizers).

**Query Parameters:**
- `limit`, `offset`, `sort`: Same as events

**Response (200):**
```json
{
  "attendee": {
    "id": 1,
    "name": "John Attendee",
    "email": "john@example.com",
    "attendingCount": 3
  },
  "events": {
    "data": [
      {
        "id": 1,
        "name": "Tech Meetup",
        "date": "2026-05-01",
        "time": "14:00:00",
        "location": "Downtown",
        "organizerId": 2
      }
    ],
    "pagination": {...}
  }
}
```

### GET `/api/users/:id/stats`
Get user statistics (events organized, attending, groups created) (self or organizers).

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "name": "Jane Organizer",
    "email": "jane@example.com",
    "role": "organizer",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "statistics": {
    "eventsOrganized": 5,
    "eventsAttending": 3,
    "groupsCreated": 2
  }
}
```

---

## Events

### GET `/api/events`
List all events with **pagination, filtering, sorting, search**.

**Query Parameters:**
- `limit`, `offset`, `sort`: Standard pagination
- `search`: Search by name, description, location
- `startDate`, `endDate`: Filter by date range (YYYY-MM-DD)
- `location`: Filter by location (substring match)
- `groupId`: Filter by group ID
- `organizerId`: Filter by organizer ID

**Request:**
```bash
curl -X GET "http://localhost:3000/api/events?search=meetup&startDate=2026-05-01&endDate=2026-06-01&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Tech Meetup",
      "location": "Downtown",
      "date": "2026-05-15",
      "time": "18:00:00",
      "description": "Join us for networking",
      "organizerId": 2,
      "groupId": 1,
      "organizer": {
        "id": 2,
        "name": "Jane Organizer"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "pages": 1,
    "currentPage": 1
  }
}
```

### GET `/api/events/:id`
Get event details with attendees.

**Response (200):**
```json
{
  "id": 1,
  "name": "Tech Meetup",
  "location": "Downtown",
  "date": "2026-05-15",
  "time": "18:00:00",
  "description": "Join us for networking",
  "organizerId": 2,
  "groupId": 1,
  "organizer": {
    "id": 2,
    "name": "Jane Organizer"
  },
  "attendees": [
    {
      "id": 1,
      "name": "John Attendee"
    }
  ]
}
```

### POST `/api/events`
Create event (organizers only).

**Request:**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <organizer-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Meetup",
    "location": "Community Center",
    "date": "2026-06-15",
    "time": "18:00:00",
    "description": "Networking event",
    "groupId": 1
  }'
```

**Response (201):** Event object

### PUT `/api/events/:id`
Update event (owner organizers).

**Response (200):** Updated event object

### DELETE `/api/events/:id`
Delete event (owner organizers).

**Response (204):** No content

### GET `/api/events/upcoming/list`
Get upcoming events with **pagination** (sorted by date).

**Query Parameters:**
- `limit` (default 20): Records per page
- `offset` (default 0): Starting position

**Request:**
```bash
curl -X GET "http://localhost:3000/api/events/upcoming/list?limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200):** Paginated upcoming events

### GET `/api/events/:id/attendees`
Get event attendees with **pagination**.

**Query Parameters:**
- `limit`, `offset`: Pagination parameters

**Response (200):**
```json
{
  "event": {
    "id": 1,
    "name": "Tech Meetup",
    "date": "2026-05-15",
    "attendeeCount": 5
  },
  "attendees": {
    "data": [
      {
        "id": 1,
        "name": "John Attendee",
        "email": "john@example.com",
        "role": "user"
      }
    ],
    "pagination": {...}
  }
}
```

### GET `/api/events/:id/group`
Get event's group (if associated).

**Response (200):**
```json
{
  "id": 1,
  "name": "Downtown Meetups",
  "creatorId": 2,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## Groups

### GET `/api/groups`
List all groups with **pagination, filtering, sorting, search**.

**Query Parameters:**
- `limit`, `offset`, `sort`: Standard pagination
- `search`: Search by group name
- `creatorId`: Filter by creator ID

**Request:**
```bash
curl -X GET "http://localhost:3000/api/groups?search=tech&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200):** Paginated groups with creator info

### GET `/api/groups/:id`
Get group details with events.

**Response (200):**
```json
{
  "id": 1,
  "name": "Downtown Tech",
  "creatorId": 2,
  "events": [
    {
      "id": 1,
      "name": "Meetup",
      "date": "2026-05-15"
    }
  ]
}
```

### POST `/api/groups`
Create group (organizers only).

**Response (201):** Group object

### PUT `/api/groups/:id`
Update group (creator organizer).

**Response (200):** Updated group object

### DELETE `/api/groups/:id`
Delete group (creator organizer).

**Response (204):** No content

### GET `/api/groups/:id/events`
Get events in group with **pagination and sorting**.

**Query Parameters:**
- `limit`, `offset`, `sort`: Pagination parameters

**Response (200):**
```json
{
  "group": {
    "id": 1,
    "name": "Downtown Meetups",
    "eventCount": 3
  },
  "events": {
    "data": [...],
    "pagination": {...}
  }
}
```

### GET `/api/groups/:id/creator`
Get group creator with event/group counts.

**Response (200):**
```json
{
  "creator": {
    "id": 2,
    "name": "Jane Organizer",
    "email": "jane@example.com",
    "role": "organizer",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "groupsCreated": 5,
  "eventsOrganized": 12
}
```

---

## Attendance

### GET `/api/attendance`
List attendance records with **pagination, filtering, sorting** (users see own, organizers see all).

**Query Parameters:**
- `limit`, `offset`, `sort`: Pagination
- `eventId`: Filter by event
- `userId`: Filter by user (organizers only)

**Response (200):** Paginated attendance records

### GET `/api/attendance/:id`
Get specific attendance record.

**Response (200):** Attendance record object

### POST `/api/attendance`
Register for event.

**Request:**
```bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1
  }'
```

**Response (201):** Attendance record

### PUT `/api/attendance/:id`
Update attendance record (owner or organizers).

**Response (200):** Updated record

### DELETE `/api/attendance/:id`
Cancel attendance (owner or organizers).

**Response (204):** No content

### GET `/api/attendance/event/:eventId/summary`
Get attendance summary for event.

**Response (200):**
```json
{
  "event": {
    "id": 1,
    "name": "Tech Meetup",
    "date": "2026-05-15",
    "time": "18:00:00"
  },
  "attendanceSummary": {
    "totalAttendees": 5
  }
}
```

---

## Statistics

All statistics endpoints require authentication and organizer role.

### GET `/api/stats/platform`
Get platform-wide statistics.

**Response (200):**
```json
{
  "platform": {
    "totalUsers": 15,
    "users": 12,
    "organizers": 3,
    "totalEvents": 25,
    "totalGroups": 8,
    "totalAttendanceRecords": 60,
    "averageAttendancePerEvent": 2.4
  }
}
```

### GET `/api/stats/activity`
Get current user's activity statistics.

**Response (200):**
```json
{
  "statistics": {
    "eventsAttending": 5,
    "eventsOrganized": 3,
    "groupsCreated": 2
  }
}
```

### GET `/api/stats/popular-events`
Get most attended events.

**Query Parameters:**
- `limit` (1-50, default 10): Number of events

**Response (200):**
```json
{
  "popularEvents": [
    {
      "id": 1,
      "name": "Tech Meetup",
      "date": "2026-05-15",
      "location": "Downtown",
      "attendeeCount": 15
    }
  ]
}
```

### GET `/api/stats/active-organizers`
Get most active organizers.

**Query Parameters:**
- `limit` (1-50, default 10): Number of organizers

**Response (200):**
```json
{
  "activeOrganizers": [
    {
      "id": 2,
      "name": "Jane Organizer",
      "email": "jane@example.com",
      "eventsOrganized": 12
    }
  ]
}
```

### GET `/api/stats/event-occupancy`
Get upcoming event occupancy rates (organizers only).

**Response (200):**
```json
{
  "upcomingEvents": [
    {
      "id": 1,
      "name": "Tech Meetup",
      "date": "2026-05-15",
      "attendeeCount": 5
    }
  ]
}
```

### GET `/api/stats/group-analytics`
Get group analytics (organizers only).

**Response (200):**
```json
{
  "groups": [
    {
      "id": 1,
      "name": "Downtown Meetups",
      "eventCount": 3,
      "totalAttendance": 15
    }
  ]
}
```

---

## Query Parameters

### Pagination
- **`limit`** (1-100, default 20): Records per page
- **`offset`** (default 0): Starting position

### Sorting
Format: `field:direction` (comma-separated for multiple)
- Allowed directions: `asc`, `desc`
- Example: `sort=date:asc,name:desc`

### Searching
- **`search`**: Full-text search across relevant fields

### Filtering
Varies by endpoint but typically:
- **`startDate`**, **`endDate`**: Date range (YYYY-MM-DD)
- **`location`**: Location filter
- **`role`**: Role filter (user, organizer)
- **`creatorId`**, **`organizerId`**: Filter by creator/organizer

---

## Error Handling

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": ["email must be a valid email address"]
}
```

### 401 Unauthorized
```json
{
  "error": "Missing Authorization header"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden: insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already in use"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting & Best Practices

- **Default page size:** 20 records
- **Maximum page size:** 100 records
- **Default sort:** Varies by endpoint (name, date, or createdAt)
- **Search is case-insensitive** and uses substring matching
- **Always include `Authorization` header** for authenticated endpoints

---

## Examples by Use Case

### Search for upcoming tech events
```bash
curl "http://localhost:3000/api/events?search=tech&startDate=2026-05-01&sort=date:asc&limit=10"
```

### Get user's event attendance history
```bash
curl "http://localhost:3000/api/users/1/attendance?limit=5&sort=date:desc"
```

### List active organizers
```bash
curl "http://localhost:3000/api/stats/active-organizers?limit=5"
```

### Find events in a specific group
```bash
curl "http://localhost:3000/api/groups/1/events?limit=10&sort=date:asc"
```

### Get platform analytics
```bash
curl "http://localhost:3000/api/stats/platform"
```

---

For more information, see:
- [AUTHORIZATION.md](AUTHORIZATION.md) - Role-based access control
- [AUTHENTICATION.md](AUTHENTICATION.md) - JWT authentication
- [README.md](README.md) - Project overview
