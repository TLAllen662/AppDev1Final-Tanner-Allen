# API Endpoints Quick Reference

## 📋 Quick Overview

This guide provides a quick reference for all API endpoints organized by resource type.

### Response Format

All responses include:
- **Success (2xx):** JSON data object
- **Pagination:** `{ data: [...], pagination: { total, limit, offset, pages, currentPage } }`
- **Errors:** `{ error: "message", details?: [...] }`

---

## Authentication (5 endpoints)

| Method | Endpoint | Auth? | Role | Purpose |
|--------|----------|-------|------|---------|
| POST | `/api/auth/register` | ✗ | - | Create account |
| POST | `/api/auth/login` | ✗ | - | Get JWT token |
| GET | `/api/auth/me` | ✓ | - | Get current user |
| POST | `/api/auth/validate` | ✓ | - | Validate token |
| POST | `/api/auth/logout` | ✓ | - | Logout notification |

---

## Users (7 endpoints)

| Method | Endpoint | Auth? | Role | Purpose |
|--------|----------|-------|------|---------|
| GET | `/api/users` | ✓ | organizer | List users (paginated) |
| GET | `/api/users/:id` | ✓ | - | Get user details |
| POST | `/api/users` | ✓ | organizer | Create user |
| PUT | `/api/users/:id` | ✓ | - | Update user (self/org) |
| DELETE | `/api/users/:id` | ✓ | - | Delete user (self/org) |
| GET | `/api/users/:id/events` | ✓ | - | Get organized events |
| GET | `/api/users/:id/attendance` | ✓ | - | Get attending events (self/org) |
| GET | `/api/users/:id/stats` | ✓ | - | Get user stats (self/org) |

**Query Support (GET /api/users):**
- `limit`, `offset`, `sort`: Pagination
- `search`: Name/email search
- `role`: Filter by role (user/organizer)

---

## Events (7 endpoints)

| Method | Endpoint | Auth? | Role | Purpose |
|--------|----------|-------|------|---------|
| GET | `/api/events` | ✓ | - | List events (paginated) |
| GET | `/api/events/:id` | ✓ | - | Get event details |
| POST | `/api/events` | ✓ | organizer | Create event |
| PUT | `/api/events/:id` | ✓ | - | Update event (owner/org) |
| DELETE | `/api/events/:id` | ✓ | - | Delete event (owner/org) |
| GET | `/api/events/upcoming/list` | ✓ | - | Get upcoming events |
| GET | `/api/events/:id/attendees` | ✓ | - | Get attendees (paginated) |
| GET | `/api/events/:id/group` | ✓ | - | Get associated group |

**Query Support (GET /api/events):**
- `limit`, `offset`, `sort`: Pagination
- `search`: Name/description/location search
- `startDate`, `endDate`: Date range filter
- `location`: Location filter
- `groupId`: Filter by group
- `organizerId`: Filter by organizer

---

## Groups (5 endpoints)

| Method | Endpoint | Auth? | Role | Purpose |
|--------|----------|-------|------|---------|
| GET | `/api/groups` | ✓ | - | List groups (paginated) |
| GET | `/api/groups/:id` | ✓ | - | Get group details |
| POST | `/api/groups` | ✓ | organizer | Create group |
| PUT | `/api/groups/:id` | ✓ | - | Update group (creator/org) |
| DELETE | `/api/groups/:id` | ✓ | - | Delete group (creator/org) |
| GET | `/api/groups/:id/events` | ✓ | - | Get group events (paginated) |
| GET | `/api/groups/:id/creator` | ✓ | - | Get creator with stats |

**Query Support (GET /api/groups):**
- `limit`, `offset`, `sort`: Pagination
- `search`: Group name search
- `creatorId`: Filter by creator

---

## Attendance (6 endpoints)

| Method | Endpoint | Auth? | Role | Purpose |
|--------|----------|-------|------|---------|
| GET | `/api/attendance` | ✓ | - | List attendance (self/org) |
| GET | `/api/attendance/:id` | ✓ | - | Get attendance record |
| POST | `/api/attendance` | ✓ | - | Register for event |
| PUT | `/api/attendance/:id` | ✓ | - | Update record (owner/org) |
| DELETE | `/api/attendance/:id` | ✓ | - | Cancel attendance (owner/org) |
| GET | `/api/attendance/event/:eventId/summary` | ✓ | - | Get attendance count |

**Query Support (GET /api/attendance):**
- `limit`, `offset`, `sort`: Pagination
- `eventId`: Filter by event
- `userId`: Filter by user (organizers only)

---

## Statistics (6 endpoints - Organizers Only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/stats/platform` | Platform-wide stats |
| GET | `/api/stats/activity` | User's activity stats |
| GET | `/api/stats/popular-events` | Top attended events |
| GET | `/api/stats/active-organizers` | Most active organizers |
| GET | `/api/stats/event-occupancy` | Upcoming event occupancy |
| GET | `/api/stats/group-analytics` | Group statistics |

**Query Support:**
- All stats support `limit` parameter (1-50 default 10)

---

## Common Query Parameters

### Pagination
```
limit=20&offset=0
```
- Limit range: 1-100 (default 20)
- Offset: starting position (default 0)
- Response includes pagination metadata

### Sorting
```
sort=field1:asc,field2:desc
```
- Directions: `asc`, `desc`
- Multiple: comma-separated
- Whitelist-validated per endpoint

### Search
```
search=term
```
- Case-insensitive substring match
- Searches multiple fields per endpoint

### Filtering
Endpoint-specific filters:
- `startDate` / `endDate`: YYYY-MM-DD format
- `location`: Substring match
- `role`: "user" or "organizer"
- `creatorId` / `organizerId`: Integer ID

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No content (delete) |
| 400 | Bad request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (duplicate email, etc.) |
| 500 | Server error |

---

## Access Control Matrix

| Endpoint Category | All Users | Organizers Only | Owner/Creator Only |
|-------------------|-----------|-----------------|-------------------|
| GET /api/users | ✗ (list) | ✓ | ✓ (any user) |
| POST /api/users | ✗ | ✓ | - |
| PUT /api/users/:id | - | ✓ | ✓ (self) |
| GET /api/events | ✓ | ✓ | - |
| POST /api/events | ✗ | ✓ | - |
| PUT /api/events/:id | - | ✓ | ✓ (owner) |
| GET /api/groups | ✓ | ✓ | - |
| POST /api/groups | ✗ | ✓ | - |
| PUT /api/groups/:id | - | ✓ | ✓ (creator) |
| POST /api/attendance | ✓ | ✓ | - |
| GET /api/stats/* | ✗ | ✓ | - |

---

## Response Examples

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "pages": 3,
    "currentPage": 1
  }
}
```

### Error Response
```json
{
  "error": "Validation failed",
  "details": ["Field 'email' is invalid"]
}
```

### Relationship Response (with metadata)
```json
{
  "event": { "id": 1, "name": "Meetup", "attendeeCount": 5 },
  "attendees": {
    "data": [...],
    "pagination": {...}
  }
}
```

---

## Common Workflows

### Register and Create Event
```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -d '{"name":"Jane","email":"jane@example.com","password":"pass"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"jane@example.com","password":"pass"}'

# 3. Create event (use token from login)
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer {token}" \
  -d '{...}'
```

### Search and Attend Event
```bash
# 1. Search events
curl "http://localhost:3000/api/events?search=tech&startDate=2026-05-01"

# 2. Register attendance
curl -X POST http://localhost:3000/api/attendance \
  -H "Authorization: Bearer {token}" \
  -d '{"eventId":1}'
```

### View User Statistics
```bash
# Get comprehensive user stats
curl "http://localhost:3000/api/users/1/stats" \
  -H "Authorization: Bearer {organizer-token}"
```

---

## Endpoint Count Summary

- **Authentication:** 5 endpoints
- **Users:** 8 endpoints
- **Events:** 8 endpoints
- **Groups:** 7 endpoints
- **Attendance:** 6 endpoints
- **Statistics:** 6 endpoints
- **Total:** 40+ endpoints

All endpoints follow RESTful conventions with consistent error handling and response formatting.

See [API_REFERENCE.md](API_REFERENCE.md) for detailed documentation with full request/response examples.
