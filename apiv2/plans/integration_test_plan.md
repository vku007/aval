# Integration Test Plan: Authentication & Authorization

## Overview

This plan covers end-to-end testing of the VKP API authentication and authorization system, including Cognito user management, role-based access control, and all API endpoints.

## Test Environment

- **User Pool**: `eu-north-1_OxGtXG08i`
- **Client ID**: `77e2cmbthjul60ui7guh514u50`
- **Region**: `eu-north-1`
- **API Base**: `https://vkp-consulting.fr/apiv2`
- **API Gateway**: `https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com`

## Test Users

### Test User Setup

Create three test users with different roles:

| Username | Email | Role | Group | Display Name | Password |
|----------|-------|------|-------|--------------|----------|
| test-admin | test-admin@vkp-test.local | admin | admin | Test Admin | TestAdmin123! |
| test-user | test-user@vkp-test.local | user | user | Test User | TestUser123! |
| test-guest | test-guest@vkp-test.local | guest | guest | Test Guest | TestGuest123! |

### User Profile Entities

Create corresponding User entities in the database:

```json
// s3://data-1-088455116440/json/users/<cognito-sub-admin>.json
{
  "name": "Test Admin User",
  "externalId": 1001
}

// s3://data-1-088455116440/json/users/<cognito-sub-user>.json
{
  "name": "Test Regular User",
  "externalId": 1002
}

// s3://data-1-088455116440/json/users/<cognito-sub-guest>.json
{
  "name": "Test Guest User",
  "externalId": 1003
}
```

## Test Scenarios

### 1. User Creation & Setup

#### 1.1 Create Cognito Users
```bash
# Admin User
./scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!

# Regular User
./scripts/create-test-user.sh user test-user@vkp-test.local "Test User" TestUser123!

# Guest User
./scripts/create-test-user.sh guest test-guest@vkp-test.local "Test Guest" TestGuest123!
```

**Expected Result**: All users created successfully with correct roles and groups

#### 1.2 Get User IDs
```bash
./scripts/list-cognito-users-json.sh | jq '.[] | select(.email | contains("vkp-test.local")) | {email, sub, role}'
```

**Expected Result**: Returns user IDs for all three test users

#### 1.3 Create User Profile Entities
```bash
# For each user, create User entity with their Cognito sub as ID
curl -X POST https://vkp-consulting.fr/apiv2/internal/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "<cognito-sub>",
    "name": "Test Admin User",
    "externalId": 1001
  }'
```

**Expected Result**: 201 Created with Location header for each user

---

### 2. Authentication Tests

#### 2.1 Login Flow

**Test**: Login with each test user
```bash
# Manual test: Visit Cognito Hosted UI
https://vkp-auth.auth.eu-north-1.amazoncognito.com/login?client_id=77e2cmbthjul60ui7guh514u50&response_type=code&redirect_uri=https://vkp-consulting.fr/callback
```

**Expected Results**:
- ✅ Login page displays
- ✅ Can login with email + password
- ✅ Redirects to /callback
- ✅ Callback sets cookies (idToken, accessToken, refreshToken)
- ✅ Redirects to home page

#### 2.2 Token Validation

**Test**: Decode and validate JWT tokens
```javascript
const idToken = getCookie('idToken');
const payload = JSON.parse(atob(idToken.split('.')[1]));

console.log({
  sub: payload.sub,
  email: payload.email,
  role: payload['custom:role'],
  displayName: payload['custom:display_name'],
  groups: payload['cognito:groups']
});
```

**Expected Results**:
- ✅ Token contains correct sub (user ID)
- ✅ Token contains email
- ✅ Token contains custom:role with correct value
- ✅ Token contains custom:display_name
- ✅ Token contains cognito:groups array

#### 2.3 Token Expiration

**Test**: Wait for token to expire (60 minutes) or use expired token
```bash
curl -H "Authorization: Bearer <expired-token>" \
  https://vkp-consulting.fr/apiv2/external/me
```

**Expected Result**: 401 Unauthorized with error message

---

### 3. Authorization Tests - External Endpoints

#### 3.1 GET /apiv2/external/me (Authenticated, Any Role)

**Test as Admin**:
```bash
curl -H "Authorization: Bearer <admin-id-token>" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
**Expected**: 200 OK with admin user profile

**Test as Regular User**:
```bash
curl -H "Authorization: Bearer <user-id-token>" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
**Expected**: 200 OK with regular user profile

**Test as Guest**:
```bash
curl -H "Authorization: Bearer <guest-id-token>" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
**Expected**: 200 OK with guest user profile

**Test Unauthenticated**:
```bash
curl https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
**Expected**: 401 Unauthorized

---

### 4. Authorization Tests - Internal Endpoints (Admin Only)

#### 4.1 JSON Entity Endpoints

**Endpoint**: `/apiv2/internal/files/*`

| Action | Method | Path | Admin | User | Guest | Unauth |
|--------|--------|------|-------|------|-------|--------|
| List | GET | /files | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Create | POST | /files | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| Get | GET | /files/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Update | PUT | /files/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Patch | PATCH | /files/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Delete | DELETE | /files/{id} | ✅ 204 | ❌ 403 | ❌ 403 | ❌ 401 |
| Meta | GET | /files/{id}/meta | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |

**Test Script**:
```bash
# Test as Admin (should succeed)
export ADMIN_TOKEN="<admin-id-token>"
./scripts/test-entity-endpoints.sh "$ADMIN_TOKEN" "admin"

# Test as User (should fail with 403)
export USER_TOKEN="<user-id-token>"
./scripts/test-entity-endpoints.sh "$USER_TOKEN" "user"

# Test as Guest (should fail with 403)
export GUEST_TOKEN="<guest-id-token>"
./scripts/test-entity-endpoints.sh "$GUEST_TOKEN" "guest"
```

#### 4.2 User Entity Endpoints

**Endpoint**: `/apiv2/internal/users/*`

| Action | Method | Path | Admin | User | Guest | Unauth |
|--------|--------|------|-------|------|-------|--------|
| List | GET | /users | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Create | POST | /users | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| Get | GET | /users/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Update | PUT | /users/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Patch | PATCH | /users/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Delete | DELETE | /users/{id} | ✅ 204 | ❌ 403 | ❌ 403 | ❌ 401 |
| Meta | GET | /users/{id}/meta | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |

**Test Script**:
```bash
./scripts/test-user-endpoints.sh "$ADMIN_TOKEN" "admin"
./scripts/test-user-endpoints.sh "$USER_TOKEN" "user"
./scripts/test-user-endpoints.sh "$GUEST_TOKEN" "guest"
```

#### 4.3 Game Entity Endpoints

**Endpoint**: `/apiv2/internal/games/*`

| Action | Method | Path | Admin | User | Guest | Unauth |
|--------|--------|------|-------|------|-------|--------|
| List | GET | /games | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Create | POST | /games | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| Get | GET | /games/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Update | PUT | /games/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Patch | PATCH | /games/{id} | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Delete | DELETE | /games/{id} | ✅ 204 | ❌ 403 | ❌ 403 | ❌ 401 |
| Meta | GET | /games/{id}/meta | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Add Round | POST | /games/{id}/rounds | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| Add Move | POST | /games/{gId}/rounds/{rId}/moves | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| Finish Round | PATCH | /games/{gId}/rounds/{rId}/finish | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |
| Finish Game | PATCH | /games/{id}/finish | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 401 |

**Test Script**:
```bash
./scripts/test-game-endpoints.sh "$ADMIN_TOKEN" "admin"
./scripts/test-game-endpoints.sh "$USER_TOKEN" "user"
./scripts/test-game-endpoints.sh "$GUEST_TOKEN" "guest"
```

---

### 5. Data Validation Tests

#### 5.1 JSON Entity Validation

**Test**: Invalid JSON structure
```bash
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"id": "", "data": {}}'
```
**Expected**: 400 Bad Request with validation error

#### 5.2 User Entity Validation

**Test**: Invalid externalId (not a number)
```bash
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"id": "test", "name": "Test", "externalId": "not-a-number"}'
```
**Expected**: 400 Bad Request with validation error

#### 5.3 Game Entity Validation

**Test**: Invalid game state
```bash
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/games \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"id": "test", "userIds": [], "rounds": []}'
```
**Expected**: 400 Bad Request (empty userIds array)

---

### 6. Concurrency Control Tests (ETag)

#### 6.1 Conditional GET (If-None-Match)

**Test**: GET with matching ETag
```bash
# First, get entity and ETag
RESPONSE=$(curl -i https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files/test-entity \
  -H "Authorization: Bearer <admin-token>")
ETAG=$(echo "$RESPONSE" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r')

# Request again with same ETag
curl -i -H "Authorization: Bearer <admin-token>" \
  -H "If-None-Match: $ETAG" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files/test-entity
```
**Expected**: 304 Not Modified

#### 6.2 Conditional PUT (If-Match)

**Test**: Update with correct ETag
```bash
curl -X PUT https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files/test-entity \
  -H "Authorization: Bearer <admin-token>" \
  -H "If-Match: $ETAG" \
  -H "Content-Type: application/json" \
  -d '{"id": "test-entity", "data": {"updated": true}}'
```
**Expected**: 200 OK with new ETag

**Test**: Update with wrong ETag (conflict)
```bash
curl -X PUT https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files/test-entity \
  -H "Authorization: Bearer <admin-token>" \
  -H "If-Match: wrong-etag" \
  -H "Content-Type: application/json" \
  -d '{"id": "test-entity", "data": {"updated": true}}'
```
**Expected**: 412 Precondition Failed

---

### 7. Pagination Tests

#### 7.1 List with Limit

**Test**: Get first page
```bash
curl "https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files?limit=2" \
  -H "Authorization: Bearer <admin-token>"
```
**Expected**: 200 OK with 2 items and nextCursor

#### 7.2 List with Cursor

**Test**: Get next page
```bash
curl "https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files?limit=2&cursor=<nextCursor>" \
  -H "Authorization: Bearer <admin-token>"
```
**Expected**: 200 OK with next 2 items

#### 7.3 List with Prefix

**Test**: Filter by prefix
```bash
curl "https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files?prefix=test-" \
  -H "Authorization: Bearer <admin-token>"
```
**Expected**: 200 OK with only items matching prefix

---

### 8. Error Handling Tests

#### 8.1 404 Not Found

**Test**: Get non-existent entity
```bash
curl https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files/does-not-exist \
  -H "Authorization: Bearer <admin-token>"
```
**Expected**: 404 Not Found with RFC 7807 error response

#### 8.2 400 Bad Request

**Test**: Invalid JSON
```bash
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```
**Expected**: 400 Bad Request with error details

#### 8.3 405 Method Not Allowed

**Test**: Unsupported method
```bash
curl -X PATCH https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me \
  -H "Authorization: Bearer <admin-token>"
```
**Expected**: 405 Method Not Allowed

---

### 9. UI Integration Tests

#### 9.1 Profile Page

**Test**: Load profile page as authenticated user
- URL: https://vkp-consulting.fr/profile.html
- **Expected**: Displays user profile with name, ID, externalId

**Test**: Load profile page without authentication
- Clear cookies, visit https://vkp-consulting.fr/profile.html
- **Expected**: Redirects to login

#### 9.2 Entity Manager (Admin Only)

**Test**: Access as admin
- URL: https://vkp-consulting.fr/entities/
- **Expected**: Loads successfully, can CRUD entities

**Test**: Access as regular user
- URL: https://vkp-consulting.fr/entities/
- **Expected**: Shows "Access Denied" alert, redirects to home

#### 9.3 User Manager (Admin Only)

**Test**: Access as admin
- URL: https://vkp-consulting.fr/users/
- **Expected**: Loads successfully, can CRUD users

**Test**: Access as regular user
- URL: https://vkp-consulting.fr/users/
- **Expected**: Shows "Access Denied" alert, redirects to home

#### 9.4 Game Manager (Admin Only)

**Test**: Access as admin
- URL: https://vkp-consulting.fr/games/
- **Expected**: Loads successfully, can CRUD games

**Test**: Access as regular user
- URL: https://vkp-consulting.fr/games/
- **Expected**: Shows "Access Denied" alert, redirects to home

---

### 10. Logout Tests

#### 10.1 Logout Flow

**Test**: Click logout button
- **Expected**: 
  - Cookies cleared (idToken, accessToken, refreshToken)
  - Redirects to Cognito logout
  - Redirects back to home page

#### 10.2 Post-Logout Access

**Test**: Try to access protected resource after logout
```bash
curl https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
**Expected**: 401 Unauthorized

---

## Test Execution Scripts

### Create Test Users Script

**File**: `scripts/create-test-user.sh`

```bash
#!/bin/bash
# Usage: ./scripts/create-test-user.sh <role> <email> <display-name> <password>

ROLE=$1
EMAIL=$2
DISPLAY_NAME=$3
PASSWORD=$4

USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --user-attributes \
    Name=email,Value="$EMAIL" \
    Name=custom:role,Value="$ROLE" \
    Name=custom:display_name,Value="$DISPLAY_NAME" \
  --message-action SUPPRESS \
  --region "$REGION"

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION"

# Add to group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --group-name "$ROLE" \
  --region "$REGION"

echo "✅ Created test user: $EMAIL (role: $ROLE)"
```

### Test Entity Endpoints Script

**File**: `scripts/test-entity-endpoints.sh`

```bash
#!/bin/bash
# Usage: ./scripts/test-entity-endpoints.sh <id-token> <expected-role>

TOKEN=$1
ROLE=$2
API_BASE="https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal"

echo "Testing Entity Endpoints as $ROLE"
echo "=================================="

# Test LIST
echo -n "GET /files: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/files")
if [ "$ROLE" = "admin" ]; then
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
else
  [ "$STATUS" = "403" ] && echo "✅ 403 Forbidden" || echo "❌ Expected 403, got $STATUS"
fi

# Test CREATE
echo -n "POST /files: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"test-'$ROLE'","data":{"test":true}}' \
  "$API_BASE/files")
if [ "$ROLE" = "admin" ]; then
  [ "$STATUS" = "201" ] && echo "✅ 201 Created" || echo "❌ Expected 201, got $STATUS"
else
  [ "$STATUS" = "403" ] && echo "✅ 403 Forbidden" || echo "❌ Expected 403, got $STATUS"
fi

# More tests...
echo ""
```

### Test User Endpoints Script

**File**: `scripts/test-user-endpoints.sh`
(Similar structure to entity endpoints)

### Test Game Endpoints Script

**File**: `scripts/test-game-endpoints.sh`
(Similar structure to entity endpoints)

---

## Success Criteria

### Authentication
- ✅ All test users can login via Cognito Hosted UI
- ✅ JWT tokens contain correct claims (sub, email, custom:role, cognito:groups)
- ✅ Expired tokens return 401 Unauthorized

### Authorization
- ✅ Admin users can access all `/apiv2/internal/*` endpoints
- ✅ Regular users get 403 on `/apiv2/internal/*` endpoints
- ✅ Guest users get 403 on `/apiv2/internal/*` endpoints
- ✅ All authenticated users can access `/apiv2/external/me`
- ✅ Unauthenticated requests get 401 on protected endpoints

### Data Operations
- ✅ CRUD operations work correctly for all entity types
- ✅ Validation catches invalid input
- ✅ ETag concurrency control works as expected
- ✅ Pagination works with limit and cursor

### UI
- ✅ Profile page works for all authenticated users
- ✅ Manager pages work for admin users
- ✅ Manager pages show access denied for non-admin users
- ✅ Logout clears session and redirects properly

### Error Handling
- ✅ 400, 401, 403, 404, 412 errors return RFC 7807 format
- ✅ CloudFront serves custom error pages
- ✅ JavaScript handles errors gracefully

---

## Cleanup

After testing, remove test users and data:

```bash
# Delete test users from Cognito
./scripts/delete-test-users.sh

# Delete test entities from S3
aws s3 rm s3://data-1-088455116440/json/users/ --recursive --exclude "*" --include "*test-*"
aws s3 rm s3://data-1-088455116440/json/files/ --recursive --exclude "*" --include "*test-*"
aws s3 rm s3://data-1-088455116440/json/games/ --recursive --exclude "*" --include "*test-*"
```

---

## Execution Checklist

- [ ] 1. Create test users in Cognito
- [ ] 2. Get test user IDs
- [ ] 3. Create User profile entities
- [ ] 4. Test authentication flow
- [ ] 5. Test token validation
- [ ] 6. Test external endpoints (all roles)
- [ ] 7. Test internal entity endpoints (all roles)
- [ ] 8. Test internal user endpoints (all roles)
- [ ] 9. Test internal game endpoints (all roles)
- [ ] 10. Test data validation
- [ ] 11. Test ETag concurrency control
- [ ] 12. Test pagination
- [ ] 13. Test error handling
- [ ] 14. Test UI (Profile page)
- [ ] 15. Test UI (Entity Manager)
- [ ] 16. Test UI (User Manager)
- [ ] 17. Test UI (Game Manager)
- [ ] 18. Test logout flow
- [ ] 19. Document results
- [ ] 20. Cleanup test data

---

**Date Created**: November 3, 2025  
**Status**: Ready for Implementation  
**Estimated Time**: 4-6 hours for full test suite execution  
**Priority**: High - Critical for production readiness

