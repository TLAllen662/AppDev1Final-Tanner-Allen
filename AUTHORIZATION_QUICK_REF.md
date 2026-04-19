# Authorization Quick Reference Guide

## For Developers

### Understanding the Permission System

The API uses a **2-tier role-based authorization system**:

| User Role | Can Create Resources | Can View Others | Can Manage Others | Notes |
|-----------|----------------------|-----------------|------------------|-------|
| **user** | ❌ No | ❌ No | ❌ No | Default role, limited permissions |
| **organizer** | ✅ Yes | ✅ Yes | ✅ Yes | Elevated role, full resource management |

### Middleware Hierarchy

Authorization is applied in this order:

```
1. Authenticate (verify JWT token) → 401
2. Authorize (check role) → 403
3. Ownership (check resource owner) → 403
```

If any layer fails, request is rejected immediately.

### Common Authorization Patterns

#### Pattern 1: Role-Only Check
Used for endpoints that all authenticated organizers can access:

```javascript
router.get(
  '/organizer-endpoint',
  authenticate,
  authorize('organizer'),
  handler
);
```

**Allowed:** Organizers only  
**Denied:** Users (403)

#### Pattern 2: Role + Ownership Check
Used for endpoints where users modify own resources:

```javascript
router.put(
  '/events/:id',
  authenticate,
  authorize('organizer'),
  ownershipCheck(
    async (req) => await Event.findByPk(req.params.id),
    'organizerId'
  ),
  handler
);
```

**Allowed:** Event creator or other organizers  
**Denied:** Non-owners (403), non-organizers (403)

#### Pattern 3: Self or Organizer
Used for user profile endpoints:

```javascript
router.get('/:id', authenticate, async (req, res) => {
  const targetId = Number(req.params.id);
  
  // Inline ownership check
  if (req.user.role !== 'organizer' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Handler logic
});
```

**Allowed:** User viewing self, or any organizer  
**Denied:** User viewing other user (403)

### Adding Authorization to New Endpoints

#### Step 1: Add Authentication
All protected endpoints require JWT:
```javascript
router.get('/protected', authenticate, handler);
```

#### Step 2: Add Role Check (if needed)
```javascript
router.post('/create', authenticate, authorize('organizer'), handler);
```

#### Step 3: Add Ownership Check (if modifying resources)
```javascript
router.put(
  '/:id',
  authenticate,
  authorize('organizer'),
  ownershipCheck(loader, 'ownerField'),
  handler
);
```

#### Step 4: Write Tests
```javascript
it('user should not access endpoint', async () => {
  const res = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${userToken}`);
  
  expect(res.statusCode).toBe(403);
});

it('organizer should access endpoint', async () => {
  const res = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${organizerToken}`);
  
  expect(res.statusCode).toBe(200);
});
```

### Using the ownershipCheck Middleware

The `ownershipCheck` middleware takes two parameters:

```javascript
ownershipCheck(resourceLoader, ownerFieldName)
```

**resourceLoader**: Async function that fetches the resource
- Receives `req` as parameter
- Should return the resource or null
- Example: `async (req) => await Event.findByPk(req.params.id)`

**ownerFieldName**: String name of the owner field
- For events: `'organizerId'`
- For groups: `'creatorId'`
- For users: `'id'`
- For attendance: `'userId'`

**How it works:**
1. Calls resourceLoader to fetch resource
2. Returns 404 if resource not found
3. Compares `resource[ownerField]` with `req.user.id`
4. Allows access if owner OR organizer role
5. Returns 403 if not owner and not organizer
6. Attaches resource to `req.resource` for handler

**Example:**
```javascript
router.delete(
  '/:id',
  authenticate,
  authorize('organizer'),
  ownershipCheck(
    async (req) => await Event.findByPk(req.params.id),
    'organizerId'
  ),
  async (req, res) => {
    // req.resource already loaded and verified
    await req.resource.destroy();
    return res.status(204).send();
  }
);
```

### Error Responses Reference

#### 401 Unauthorized - Authentication Failed
```bash
# Missing Authorization header
curl http://localhost:3000/api/users

HTTP 401
{
  "error": "Missing Authorization header"
}
```

#### 401 Unauthorized - Invalid Token
```bash
# Expired or malformed token
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer invalid.token.here"

HTTP 401
{
  "error": "Invalid token"
}
```

#### 403 Forbidden - Insufficient Permissions
```bash
# User trying to create event (organizer only)
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Event","location":"Loc","date":"2026-06-01","time":"14:00"}'

HTTP 403
{
  "error": "Forbidden: insufficient permissions"
}
```

#### 403 Forbidden - Insufficient Ownership
```bash
# Organizer trying to delete another's event
curl -X DELETE http://localhost:3000/api/events/123 \
  -H "Authorization: Bearer <other-organizer-token>"

HTTP 403
{
  "error": "You can only edit your own events"
}
```

#### 404 Not Found - Resource Not Found
```bash
# Request non-existent resource
curl http://localhost:3000/api/events/99999 \
  -H "Authorization: Bearer <token>"

HTTP 404
{
  "error": "Event not found"
}
```

### Checking User Role in Handlers

Access the authenticated user's role in any protected endpoint:

```javascript
router.post('/my-endpoint', authenticate, (req, res) => {
  // req.user contains token payload
  console.log(req.user.id);    // User ID from token
  console.log(req.user.role);  // 'user' or 'organizer'
  
  if (req.user.role === 'organizer') {
    // Do organizer-specific action
  }
});
```

### Testing Authorization Locally

#### 1. Start the server
```bash
npm run dev
```

#### 2. Seed test data
```bash
npm run db:seed
```

#### 3. Get organizer token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maya.organizer@example.com",
    "password": "password123"
  }'

# Extract token from response
```

#### 4. Get user token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ava.user@example.com",
    "password": "password123"
  }'

# Extract token from response
```

#### 5. Test restricted endpoint
```bash
ORG_TOKEN="<organizer-token>"
USER_TOKEN="<user-token>"

# This should work (200)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $ORG_TOKEN"

# This should fail (403)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Security Checklist for New Endpoints

Before deploying a new endpoint, verify:

- [ ] Endpoint has `authenticate` middleware
- [ ] Role requirements clearly specify required roles
- [ ] Ownership checks implemented for modifiable resources
- [ ] Tests cover both allowed and denied access
- [ ] Error responses don't leak sensitive information
- [ ] 401/403 status codes used appropriately
- [ ] User input never controls authorization decisions
- [ ] Role always comes from JWT token, never request body

### Troubleshooting

**Problem:** Getting 401 on authenticated endpoints
- ✅ Verify JWT_SECRET in .env matches (critical!)
- ✅ Check Authorization header format: `Bearer <token>`
- ✅ Verify token not expired (8 hour default)
- ✅ Confirm /api/auth/me works with token

**Problem:** Getting 403 on endpoints you should access
- ✅ Check your user role: GET /api/auth/me
- ✅ Verify endpoint roles: check AUTHORIZATION.md
- ✅ Check ownership: is the resource yours?
- ✅ For organizer endpoints: confirm user is organizer

**Problem:** Ownership check always failing
- ✅ Verify ownerField name (organizerId, creatorId, etc.)
- ✅ Check resourceLoader accesses correct field
- ✅ Ensure created resources have owner field set
- ✅ Confirm req.user.id matches resource owner

### Common Gotchas

1. **Token from registration is not returned**
   - Registration returns user object, not token
   - You must call /api/auth/login separately

2. **Role parameter in registration is ignored**
   - By design to prevent privilege escalation
   - All public registrations create 'user' role
   - Only organizers can create organizers (PUT /api/users/:id)

3. **Different organizers can't delete each other's resources**
   - Organizers only have ownership-based deletion
   - By design to maintain separation of concerns
   - Future: add admin role for unrestricted deletion

4. **Ownership checks require ownerField match**
   - ownershipCheck verifies exact field match
   - Double-check field names: organizerId vs creatorId vs userId

5. **req.resource from ownershipCheck only set if checking passes**
   - If 404 or 403 returned, req.resource not set
   - Handler code assumes ownership already verified

---

For complete documentation, see:
- [AUTHORIZATION.md](AUTHORIZATION.md) - Full authorization guide
- [RBAC_IMPLEMENTATION.md](RBAC_IMPLEMENTATION.md) - Implementation details
- [tests/authorization.test.js](tests/authorization.test.js) - Test examples
