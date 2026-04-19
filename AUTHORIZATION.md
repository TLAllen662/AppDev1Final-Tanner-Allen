# Role-Based Access Control (RBAC)

## Overview

This API implements a two-tier role-based authorization system with **user** and **organizer** roles. Each role has distinct permissions across the system.

## User Roles

### 1. **User Role** (Default)

Standard user with limited permissions.

**Permissions:**
- View public data (events, groups)
- Register for events (create attendance records)
- View own profile and attendance
- Update own profile
- Delete own account

**Restrictions:**
- Cannot create events
- Cannot create groups
- Cannot view other users' details
- Cannot manage other users
- Cannot delete other users' data
- Cannot promote themselves to organizer

### 2. **Organizer Role** (Elevated)

Managing user with elevated permissions for coordinating events and groups.

**Permissions:**
- All user permissions
- Create, read, update, delete their own events
- Create, read, update, delete their own groups
- View all users (directory/admin functions)
- Create user accounts
- Promote users to organizer (via `/api/users/:id` PUT endpoint)
- Delete user accounts
- Delete any resource
- Manage attendance records

**Restrictions:**
- Cannot access other organizers' private data (unless elevated)
- Cannot delete events/groups created by others (unless admin role added in future)

## Role Assignment

### At Registration

```bash
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
  // "role" parameter is ignored - always creates 'user' role
}
```

**Result:** User is created with `role: 'user'`

### After Registration

Organizers can promote users to organizer:

```bash
PUT /api/users/:id
Authorization: Bearer <organizer-token>
{
  "role": "organizer"
}
```

**Requirements:**
- Requester must be an organizer
- Can promote any user including themselves (if organizer already)

## Authorization Middleware

### 1. **authenticate Middleware**

Validates JWT token and attaches user info to request.

```javascript
const { authenticate } = require('../middleware/auth');

router.get('/protected', authenticate, handler);
```

**Behavior:**
- Validates Bearer token format
- Verifies JWT signature and expiration
- Attaches `req.user` with `id` and `role`
- Returns 401 if missing/invalid token

**Errors:**
- `401 Missing Authorization header`
- `401 Invalid Authorization header format`
- `401 Token has expired`
- `401 Invalid token`

### 2. **authorize Middleware**

Checks if user role matches allowed roles.

```javascript
const { authorize } = require('../middleware/authorize');

// Allow organizers only
router.post('/create-event', authenticate, authorize('organizer'), handler);

// Allow organizers or users
router.get('/view-events', authenticate, authorize('organizer', 'user'), handler);
```

**Usage:**
```javascript
authorize(...roles: string[]) // Variable number of role arguments
```

**Behavior:**
- Requires `authenticate` to be used first
- Checks `req.user.role` against allowed roles
- Returns 403 Forbidden if user role not in allowed list

**Errors:**
- `403 Forbidden: insufficient permissions`

### 3. **ownershipCheck Middleware**

Factory function that creates ownership validation middleware.

```javascript
const { ownershipCheck } = require('../middleware/ownershipCheck');

router.put(
  '/:id',
  authenticate,
  authorize('organizer'),
  ownershipCheck(
    async (req) => await Event.findByPk(req.params.id),
    'organizerId'
  ),
  handler
);
```

**Parameters:**
- `resourceLoader`: Async function that fetches the resource
- `ownerField`: Field name in resource containing owner ID

**Behavior:**
- Loads resource using provided loader function
- Checks if `req.user.id === resource[ownerField]`
- Allows access if owner OR user has organizer role
- Attaches resource to `req.resource` for use in handler
- Returns 404 if resource not found
- Returns 403 if access denied

**Errors:**
- `404 Resource not found`
- `403 You can only access your own resources`

## Authorization Matrix

| Endpoint | Method | Auth | Roles | Ownership |
|----------|--------|------|-------|-----------|
| `/api/auth/register` | POST | ❌ | - | - |
| `/api/auth/login` | POST | ❌ | - | - |
| `/api/auth/me` | GET | ✅ | any | - |
| `/api/auth/validate` | POST | ✅ | any | - |
| `/api/auth/logout` | POST | ✅ | any | - |
| `/api/users` | GET | ✅ | organizer | - |
| `/api/users/:id` | GET | ✅ | organizer, self | - |
| `/api/users` | POST | ✅ | organizer | - |
| `/api/users/:id` | PUT | ✅ | organizer, self | ✅ |
| `/api/users/:id` | DELETE | ✅ | organizer, self | ✅ |
| `/api/events` | GET | ✅ | any | - |
| `/api/events/:id` | GET | ✅ | any | - |
| `/api/events` | POST | ✅ | organizer | - |
| `/api/events/:id` | PUT | ✅ | organizer | ✅ (organizerId) |
| `/api/events/:id` | DELETE | ✅ | organizer | ✅ (organizerId) |
| `/api/groups` | GET | ✅ | any | - |
| `/api/groups/:id` | GET | ✅ | any | - |
| `/api/groups` | POST | ✅ | organizer | - |
| `/api/groups/:id` | PUT | ✅ | organizer | ✅ (creatorId) |
| `/api/groups/:id` | DELETE | ✅ | organizer | ✅ (creatorId) |
| `/api/attendance` | GET | ✅ | any | conditional |
| `/api/attendance/:id` | GET | ✅ | any | conditional |
| `/api/attendance` | POST | ✅ | any | - |
| `/api/attendance/:id` | DELETE | ✅ | any | ✅ (userId) |

**Legend:**
- `Auth`: Requires authentication
- `Roles`: Allowed user roles
- `Ownership`: Requires ownership check or organizer override

## Implementation Patterns

### Pattern 1: Role-Only Authorization

Simplest pattern - only check user role.

```javascript
router.get('/', authenticate, authorize('organizer'), async (req, res) => {
  const users = await User.findAll();
  return res.json(users);
});
```

### Pattern 2: Ownership Check (Manual)

Check ownership explicitly in handler.

```javascript
router.put('/:id', authenticate, authorize('organizer'), async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  
  // Ownership check: allow owner or organizer
  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own events' });
  }
  
  // Update logic...
});
```

### Pattern 3: Ownership Check (Using Middleware)

Use ownershipCheck middleware for cleaner code.

```javascript
router.put(
  '/:id',
  authenticate,
  authorize('organizer'),
  ownershipCheck(
    async (req) => await Event.findByPk(req.params.id),
    'organizerId'
  ),
  async (req, res) => {
    // Resource already loaded and ownership verified
    // Just perform update
    await req.resource.update(req.body);
    return res.json(req.resource);
  }
);
```

### Pattern 4: Conditional Role Authorization

Different permissions based on role.

```javascript
router.get('/:id', authenticate, async (req, res) => {
  const targetId = Number(req.params.id);
  
  // Organizers can view all users
  // Regular users can only view themselves
  if (req.user.role !== 'organizer' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const user = await User.findByPk(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});
```

## Security Best Practices

### 1. ✅ Do's

- Always check `req.user.id` from JWT token (never from request body)
- Use middleware to enforce authorization consistently
- Combine role checks with ownership checks where needed
- Validate resource exists before checking ownership
- Return appropriate status codes (403, 404)
- Log unauthorized access attempts (for audit)

### 2. ❌ Don'ts

- Don't trust `userId` or `role` from request body
- Don't skip authentication on endpoints
- Don't assume all organizers are equal (separate admin later if needed)
- Don't expose sensitive user data in responses
- Don't allow privilege escalation (users self-promoting to organizer)
- Don't mix authentication and authorization checks

## Common Vulnerabilities & Mitigations

### Vulnerability: Privilege Escalation

**Issue:** User registers with `role: "organizer"` in request body.

**Mitigation:** Auth endpoint ignores role parameter, always creates `user` role.

```javascript
// ❌ WRONG: Accepts role from request
const user = await User.create({ name, email, passwordHash, role });

// ✅ CORRECT: Ignores role parameter, forces 'user'
const user = await User.create({ name, email, passwordHash, role: 'user' });
```

### Vulnerability: Horizontal Privilege Escalation

**Issue:** User A modifies/deletes User B's data using their ID in URL.

**Mitigation:** Implement ownership checks or role restrictions.

```javascript
// ❌ WRONG: No ownership check
router.put('/:id', authenticate, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  await user.update(req.body);
  return res.json(user);
});

// ✅ CORRECT: Check ownership or role
router.put('/:id', authenticate, async (req, res) => {
  const targetId = Number(req.params.id);
  
  if (req.user.role !== 'organizer' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const user = await User.findByPk(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  await user.update(req.body);
  return res.json(user);
});
```

### Vulnerability: Insecure Direct Object Reference (IDOR)

**Issue:** Accessing resources by ID without permission checks.

**Mitigation:** Always verify user has access to resource before returning data.

```javascript
// ❌ WRONG: Returns any attendance record by ID
router.get('/:id', authenticate, async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  return res.json(record);
});

// ✅ CORRECT: Only return if user is owner or organizer
router.get('/:id', authenticate, async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  
  if (!record) return res.status(404).json({ error: 'Not found' });
  
  if (req.user.role !== 'organizer' && record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  return res.json(record);
});
```

## Testing Authorization

### Test Registering a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "email": "alice@example.com",
    "password": "password123"
  }'

# Returns: { "id": 1, "role": "user", ... }
```

### Test Unauthorized Access

```bash
# Get token for user (role: user)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'

# Try to access organizer-only endpoint
TOKEN="<user-token>"
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN"

# Returns 403 Forbidden: insufficient permissions
```

### Test Ownership Check

```bash
# Create event as organizer
ORG_TOKEN="<organizer-token>"
EVENT=$(curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Event 1",
    "location": "Location",
    "date": "2026-05-01",
    "time": "14:00:00"
  }')

EVENT_ID=$(echo $EVENT | jq .id)

# Try to delete as different organizer
OTHER_ORG_TOKEN="<other-organizer-token>"
curl -X DELETE http://localhost:3000/api/events/$EVENT_ID \
  -H "Authorization: Bearer $OTHER_ORG_TOKEN"

# Returns 403: You can only edit your own events
```

## Future Enhancements

1. **Admin Role** - Super-admin with unrestricted access
2. **Token Blacklist** - Revoke specific tokens administratively
3. **Rate Limiting** - Prevent brute force attacks
4. **Audit Logging** - Log all authorization checks
5. **Resource-Based Access Control** - More granular permissions
6. **JWT Refresh Tokens** - Extended session management
7. **Permission Caching** - Improve performance for frequent checks

## References

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Access Control](https://owasp.org/www-community/Access_Control)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
