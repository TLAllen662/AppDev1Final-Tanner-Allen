# Authorization Implementation Summary

## Overview

This document describes the comprehensive Role-Based Access Control (RBAC) system implemented in the AppDev1Final API.

## System Architecture

The authorization system consists of three layers:

### 1. **Authentication Layer** (`/src/middleware/auth.js`)
- Validates JWT tokens from Authorization header
- Extracts user ID and role from token payload
- Attaches user info to `req.user`
- Returns 401 if token is missing, invalid, or expired

### 2. **Authorization Layer** (`/src/middleware/authorize.js`)
- Checks user role against allowed roles for endpoint
- Works in conjunction with `authenticate` middleware
- Returns 403 Forbidden if user role not in allowed list

### 3. **Ownership Layer** (`/src/middleware/ownershipCheck.js`)
- Factory function for creating ownership validation middleware
- Verifies user owns the resource OR has organizer role
- Returns 404 if resource not found
- Returns 403 if user lacks access

## User Roles

### **User Role** (Default)
Permissions:
- ✅ Register and login
- ✅ View public events and groups
- ✅ View own profile
- ✅ Update own profile
- ✅ Delete own account
- ✅ Register for events (attendance)
- ❌ Cannot create events/groups
- ❌ Cannot view other users
- ❌ Cannot manage other resources

### **Organizer Role** (Elevated)
Permissions:
- ✅ All user permissions
- ✅ View all users
- ✅ Create user accounts
- ✅ Update any user (including promotion)
- ✅ Delete any user
- ✅ Create/edit/delete own events
- ✅ Create/edit/delete own groups
- ❌ Cannot delete other organizers' events/groups (ownership restriction)

## Middleware Usage Patterns

### Pattern 1: Role-Only Authorization

Restrict endpoint to specific roles:

```javascript
router.get('/', authenticate, authorize('organizer'), handler);
```

### Pattern 2: Ownership Check with Role

Combine role authorization with ownership verification:

```javascript
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

### Pattern 3: Conditional Logic

Check permissions inline for complex rules:

```javascript
router.get('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'organizer' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Handler logic
});
```

## Implementation Across Endpoints

### Authentication Endpoints
| Endpoint | Auth | Protected |
|----------|------|-----------|
| POST `/api/auth/register` | ❌ | ❌ |
| POST `/api/auth/login` | ❌ | ❌ |
| GET `/api/auth/me` | ✅ | ✅ |
| POST `/api/auth/validate` | ✅ | ✅ |
| POST `/api/auth/logout` | ✅ | ✅ |

### User Management Endpoints
| Endpoint | Auth | Roles | Ownership |
|----------|------|-------|-----------|
| GET `/api/users` | ✅ | organizer | - |
| GET `/api/users/:id` | ✅ | self or organizer | ✅ |
| POST `/api/users` | ✅ | organizer | - |
| PUT `/api/users/:id` | ✅ | self or organizer | ✅ |
| DELETE `/api/users/:id` | ✅ | self or organizer | ✅ |

### Event Management Endpoints
| Endpoint | Auth | Roles | Ownership |
|----------|------|-------|-----------|
| GET `/api/events` | ✅ | any | - |
| GET `/api/events/:id` | ✅ | any | - |
| POST `/api/events` | ✅ | organizer | - |
| PUT `/api/events/:id` | ✅ | organizer | ✅ (organizerId) |
| DELETE `/api/events/:id` | ✅ | organizer | ✅ (organizerId) |

### Group Management Endpoints
| Endpoint | Auth | Roles | Ownership |
|----------|------|-------|-----------|
| GET `/api/groups` | ✅ | any | - |
| GET `/api/groups/:id` | ✅ | any | - |
| POST `/api/groups` | ✅ | organizer | - |
| PUT `/api/groups/:id` | ✅ | organizer | ✅ (creatorId) |
| DELETE `/api/groups/:id` | ✅ | organizer | ✅ (creatorId) |

### Attendance Endpoints
| Endpoint | Auth | Roles | Ownership |
|----------|------|-------|-----------|
| GET `/api/attendance` | ✅ | any | conditional |
| GET `/api/attendance/:id` | ✅ | any | conditional |
| POST `/api/attendance` | ✅ | any | - |
| DELETE `/api/attendance/:id` | ✅ | any | ✅ (userId) |

## Security Features

### 1. Privilege Escalation Prevention
- Public registration always creates `user` role
- Role parameter in registration endpoint is ignored
- Only organizers can promote users
- Users cannot self-promote

### 2. Horizontal Privilege Escalation Prevention
- Ownership checks prevent users from accessing/modifying others' data
- Role verification ensures only organizers can create resources
- User-to-user access is restricted

### 3. Insecure Direct Object Reference (IDOR) Prevention
- All resource endpoints verify user has access
- Either ownership check or role authorization applied
- 404 returned for unauthorized access (not 403 in some cases)

### 4. Authentication Enforcement
- All protected endpoints require valid JWT in Authorization header
- Expired tokens return 401 with specific error
- Malformed tokens return 401
- Missing tokens return 401

## Test Coverage

Comprehensive test suite in `tests/authorization.test.js` covers:

### 36 Authorization Tests
- ✅ Role-based GET endpoint access (users endpoint)
- ✅ Role-based POST endpoint access (create users, events, groups)
- ✅ Ownership checks on PUT (events, groups, users)
- ✅ Ownership checks on DELETE (events, groups, users)
- ✅ Self resource access (users viewing own profile)
- ✅ Cross-user access restrictions
- ✅ Privilege escalation attempts
- ✅ Authentication failure scenarios
- ✅ Authorization failure scenarios

All tests verify:
- Correct status codes (200, 201, 403, 404, 401)
- Expected error messages
- Data integrity (resources not modified when denied)
- Ownership restrictions across different users

## Error Response Examples

### Insufficient Permissions (Role Check Failed)
```json
HTTP 403 Forbidden
{
  "error": "Forbidden: insufficient permissions"
}
```

### Insufficient Permissions (Ownership Failed)
```json
HTTP 403 Forbidden
{
  "error": "You can only edit your own events"
}
```

### Missing Authentication
```json
HTTP 401 Unauthorized
{
  "error": "Missing Authorization header"
}
```

### Invalid Token
```json
HTTP 401 Unauthorized
{
  "error": "Invalid token"
}
```

### Resource Not Found
```json
HTTP 404 Not Found
{
  "error": "Event not found"
}
```

## Running Tests

### Run Authorization Tests
```bash
npm test -- tests/authorization.test.js
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- tests/authorization.test.js -t "Ownership Check"
```

## Test Data

Seeded users for testing:

1. **Maya Rodriguez** (organizer)
   - Email: maya.organizer@example.com
   - Password: password123
   - Can create/manage events and groups

2. **Daniel Cho** (organizer)
   - Email: daniel.organizer@example.com
   - Password: password123
   - Can create/manage events and groups

3. **Ava Patel** (user)
   - Email: ava.user@example.com
   - Password: password123
   - Limited to user permissions

4. **Ethan Brooks** (user)
   - Email: ethan.user@example.com
   - Password: password123
   - Limited to user permissions

5. **Liam Nguyen** (user)
   - Email: liam.user@example.com
   - Password: password123
   - Limited to user permissions

## Database Schema

### User Model
```javascript
{
  id: INTEGER PRIMARY KEY,
  name: STRING NOT NULL,
  email: STRING UNIQUE NOT NULL,
  passwordHash: STRING NOT NULL,
  role: ENUM('user', 'organizer') NOT NULL DEFAULT 'user',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

The `role` field defines authorization levels across the entire system.

## Future Enhancements

1. **Admin Role** - Superuser with unrestricted access
2. **Permission System** - Granular permission matrix
3. **Token Refresh** - Refresh tokens for extended sessions
4. **Audit Logging** - Track all authorization checks
5. **Rate Limiting** - Prevent brute force attacks
6. **Resource-Based ACL** - More fine-grained access control

## Best Practices Applied

✅ **Always authenticate first** - Middleware chain enforces authentication before authorization
✅ **Never trust client input** - Role and ownership from token/database, not request body
✅ **Fail securely** - Return appropriate error codes (401, 403, 404)
✅ **Verify ownership** - Check resource ownership before allowing modifications
✅ **Consistent error handling** - Standardized error response format
✅ **Comprehensive testing** - Test coverage for both positive and negative cases
✅ **Clear documentation** - Each middleware and pattern documented

## References

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Access Control](https://owasp.org/www-community/Access_Control)
- [Express Middleware Pattern](https://expressjs.com/en/guide/using-middleware.html)
