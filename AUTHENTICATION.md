# Authentication & Authorization Guide

## Overview

This API implements a **JWT (JSON Web Token) based authentication system** with role-based access control (RBAC). All protected endpoints require valid authentication via Bearer tokens.

## Architecture

### Security Stack

- **Password Hashing:** bcryptjs (12 salt rounds)
- **Token Generation:** JWT with HS256 algorithm
- **Token Expiration:** 8 hours (configurable)
- **Secret Management:** Environment variable `JWT_SECRET`

### User Roles

The system supports two user roles:

1. **user** (Default)
   - Can view public data
   - Can manage own profile
   - Can register for events (attendance)

2. **organizer**
   - Can perform all user actions
   - Can create, edit, and delete events
   - Can create and manage groups
   - Can view all user data
   - Can create new user accounts

## Setup & Configuration

### 1. Environment Variables

Ensure your `.env` file contains:

```env
PORT=3000
JWT_SECRET=your-long-random-secret-key-here
JWT_EXPIRES_IN=8h
NODE_ENV=development
DB_STORAGE=./database.sqlite
```

**Important:** 
- `JWT_SECRET` must be a strong, random string (minimum 32 characters)
- Never commit `.env` to version control
- Change `JWT_SECRET` in production

### 2. Password Requirements

- Minimum 8 characters
- Hashed with bcryptjs (12 rounds)
- Never stored in plaintext

## Authentication Flow

### 1. User Registration

```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
HTTP 201 Created
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

**Key Points:**
- Email must be unique
- Password must be at least 8 characters
- User role is always set to "user" (ignores client-provided role)

### 2. User Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
HTTP 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiaWF0IjoxNzEwNDQ5MjAwLCJleHAiOjE3MTA0ODUyMDB9.SIGNATURE",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Token Payload:**
```json
{
  "id": 1,
  "role": "user",
  "iat": 1710449200,
  "exp": 1710485200
}
```

### 3. Using the Token

Store the token in your client and include it in all protected requests:

```
GET /api/users/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Token Validation

Check token validity with:

```
POST /api/auth/validate
Authorization: Bearer <token>
```

**Response:**
```json
HTTP 200 OK
{
  "valid": true,
  "user": {
    "id": 1,
    "role": "user"
  }
}
```

### 5. Get Current User

Retrieve authenticated user info:

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
HTTP 200 OK
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 6. Logout

```
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response:**
```json
HTTP 200 OK
{
  "message": "Logout successful. Please remove the token from your client."
}
```

## Error Responses

### Missing Authorization Header

```json
HTTP 401 Unauthorized
{
  "error": "Missing Authorization header"
}
```

### Invalid Header Format

```json
HTTP 401 Unauthorized
{
  "error": "Invalid Authorization header format. Expected: Bearer <token>"
}
```

### Token Expired

```json
HTTP 401 Unauthorized
{
  "error": "Token has expired"
}
```

### Invalid Token

```json
HTTP 401 Unauthorized
{
  "error": "Invalid token"
}
```

### Insufficient Permissions

```json
HTTP 403 Forbidden
{
  "error": "Forbidden: insufficient permissions"
}
```

## Role-Based Access Control

### Authorization Middleware

The `authorize` middleware checks user roles:

```javascript
router.post('/', authenticate, authorize('organizer'), handler);
```

This ensures only organizers can access the endpoint.

### Permission Matrix

| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| `/api/users` | organizer | organizer | self/organizer | self/organizer |
| `/api/events` | authenticated | organizer | owner/organizer | owner/organizer |
| `/api/groups` | authenticated | organizer | creator | creator |
| `/api/attendance` | authenticated | authenticated | - | - |

## Security Best Practices

### 1. Password Security

✅ **Do:**
- Use strong passwords (8+ characters, mixed case, numbers)
- Store only bcrypt hashes
- Hash passwords with 12+ salt rounds

❌ **Don't:**
- Send passwords in query parameters
- Log passwords
- Store plaintext passwords

### 2. Token Management

✅ **Do:**
- Store tokens in httpOnly cookies (for web) or secure storage (mobile)
- Include tokens in Authorization header
- Refresh tokens before expiration (in production)
- Validate tokens on each request

❌ **Don't:**
- Store tokens in localStorage (XSS vulnerability)
- Include tokens in URLs
- Share tokens across requests unnecessarily

### 3. Environment Variables

✅ **Do:**
- Use strong, random JWT_SECRET (minimum 32 characters)
- Rotate secrets periodically in production
- Use different secrets for dev/prod
- Never commit `.env` to version control

❌ **Don't:**
- Use weak or predictable secrets
- Use the same secret across environments
- Check `.env` into git

## Client Implementation Examples

### JavaScript/Fetch Example

```javascript
// Register
const registerRes = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securePassword123'
  })
});

// Login
const loginRes = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'securePassword123'
  })
});

const { token } = await loginRes.json();

// Use token in subsequent requests
const dataRes = await fetch('http://localhost:3000/api/users/1', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await dataRes.json();
```

### cURL Example

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'

# Use token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl -X GET http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### "JWT_SECRET is not set"

**Solution:** Add `JWT_SECRET` to your `.env` file.

```env
JWT_SECRET=your-long-random-secret
```

### "Invalid credentials" on login

**Causes:**
- Email doesn't exist
- Password is incorrect
- Typo in credentials

**Solution:** Verify email and password are correct.

### "Invalid or expired token"

**Causes:**
- Token has expired (8 hours)
- Token is malformed
- JWT_SECRET was changed

**Solution:** Log in again to get a new token.

### "Missing Authorization header"

**Causes:**
- Authorization header not included
- Header uses wrong format

**Solution:** Include `Authorization: Bearer <token>` in request header.

### "Token validation failed"

**Causes:**
- Token was signed with different secret
- Token was tampered with

**Solution:** Clear token and login again.

## Production Considerations

1. **Key Rotation:** Implement secret rotation strategy
2. **Token Blacklist:** Consider logging out tokens administratively
3. **HTTPS Only:** Always use HTTPS in production
4. **Rate Limiting:** Implement rate limiting on auth endpoints
5. **Monitoring:** Log authentication failures for security monitoring
6. **Token Refresh:** Implement refresh tokens for extended sessions
7. **httpOnly Cookies:** Use httpOnly, Secure cookies for web clients

## References

- [JWT.io](https://jwt.io)
- [bcryptjs Documentation](https://www.npmjs.com/package/bcryptjs)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
