# Integration Test Quick Start Guide

## Overview

This guide walks you through running the full integration test suite for the VKP API authentication and authorization system.

## Prerequisites

- ✅ AWS CLI configured with credentials
- ✅ `jq` installed (`brew install jq`)
- ✅ `curl` available
- ✅ Admin access to Cognito User Pool

## Step 1: Create Test Users (5 minutes)

Create three test users with different roles:

```bash
# Create admin test user
./scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!

# Create regular test user
./scripts/create-test-user.sh user test-user@vkp-test.local "Test User" TestUser123!

# Create guest test user
./scripts/create-test-user.sh guest test-guest@vkp-test.local "Test Guest" TestGuest123!
```

**Expected Output**: Each script will show the user's ID (sub). Save these IDs for the next step.

```
✅ Test user created successfully!

   Email: test-admin@vkp-test.local
   User ID (sub): 10ccb9cc-e031-70a5-cf21-1dd0d1a25b96
   Role: admin
   Display Name: Test Admin
   Status: CONFIRMED
```

## Step 2: Get User IDs (1 minute)

List all test users and their IDs:

```bash
./scripts/list-cognito-users-json.sh | jq '.[] | select(.email | contains("vkp-test.local")) | {email, sub, role}'
```

Save the output:
```json
{
  "email": "test-admin@vkp-test.local",
  "sub": "abc123...",
  "role": "admin"
}
{
  "email": "test-user@vkp-test.local",
  "sub": "def456...",
  "role": "user"
}
{
  "email": "test-guest@vkp-test.local",
  "sub": "ghi789...",
  "role": "guest"
}
```

## Step 3: Create User Profile Entities (5 minutes)

First, get an admin token by logging in:

1. Visit: https://vkp-auth.auth.eu-north-1.amazoncognito.com/login?client_id=77e2cmbthjul60ui7guh514u50&response_type=code&redirect_uri=https://vkp-consulting.fr/callback
2. Login with: `admin@vkp-consulting.fr` / `<your-admin-password>`
3. Open Developer Tools → Console
4. Get token:
```javascript
const idToken = document.cookie.split('; ').find(c => c.startsWith('idToken=')).split('=')[1];
console.log(idToken);
```
5. Copy the token

Now create User entities for each test user:

```bash
# Set admin token
export ADMIN_TOKEN="<your-admin-id-token>"

# Create admin user profile
curl -X POST https://vkp-consulting.fr/apiv2/internal/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "abc123...",
    "name": "Test Admin User",
    "externalId": 1001
  }'

# Create regular user profile
curl -X POST https://vkp-consulting.fr/apiv2/internal/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "def456...",
    "name": "Test Regular User",
    "externalId": 1002
  }'

# Create guest user profile
curl -X POST https://vkp-consulting.fr/apiv2/internal/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ghi789...",
    "name": "Test Guest User",
    "externalId": 1003
  }'
```

**Expected**: Each returns `201 Created` with `Location` header

## Step 4: Get Test User Tokens (10 minutes)

For each test user, login and get their ID token:

### Test Admin Token
1. Logout from current session
2. Login with `test-admin@vkp-test.local` / `TestAdmin123!`
3. Get token from browser console (same as Step 3)
4. Save as `TEST_ADMIN_TOKEN`

### Test User Token
1. Logout
2. Login with `test-user@vkp-test.local` / `TestUser123!`
3. Get token
4. Save as `TEST_USER_TOKEN`

### Test Guest Token
1. Logout
2. Login with `test-guest@vkp-test.local` / `TestGuest123!`
3. Get token
4. Save as `TEST_GUEST_TOKEN`

## Step 5: Run Entity Endpoint Tests (2 minutes)

Test authorization for JSON entity endpoints:

```bash
# Test as admin (should succeed)
./scripts/test-entity-endpoints.sh "$TEST_ADMIN_TOKEN" admin

# Test as regular user (should fail with 403)
./scripts/test-entity-endpoints.sh "$TEST_USER_TOKEN" user

# Test as guest (should fail with 403)
./scripts/test-entity-endpoints.sh "$TEST_GUEST_TOKEN" guest
```

**Expected Output**:

Admin:
```
✅ 1. GET /files (List): 200 OK
✅ 2. POST /files (Create): 201 Created
✅ 3. GET /files/{id} (Read): 200 OK
✅ 4. GET /files/{id}/meta (Metadata): 200 OK
✅ 5. PUT /files/{id} (Replace): 200 OK
✅ 6. PATCH /files/{id} (Merge): 200 OK
✅ 7. DELETE /files/{id} (Delete): 204 No Content
```

User/Guest:
```
✅ 1. GET /files (List): 403 Forbidden
✅ 2. POST /files (Create): 403 Forbidden
```

## Step 6: Test External Endpoint (2 minutes)

Test the `/apiv2/external/me` endpoint with all roles:

```bash
# Admin
curl -i -H "Authorization: Bearer $TEST_ADMIN_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me

# Regular User
curl -i -H "Authorization: Bearer $TEST_USER_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me

# Guest
curl -i -H "Authorization: Bearer $TEST_GUEST_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```

**Expected**: All return `200 OK` with their respective user profiles

## Step 7: Test Unauthenticated Access (1 minute)

```bash
# Should return 401 Unauthorized
curl -i https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me

# Should return 401 Unauthorized
curl -i https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files
```

**Expected**: Both return `401 Unauthorized`

## Step 8: Test UI Access (5 minutes)

### Profile Page (All Authenticated Users)

1. Login as each test user
2. Visit: https://vkp-consulting.fr/profile.html
3. **Expected**: Shows user profile for all roles

### Entity Manager (Admin Only)

1. Login as admin: `test-admin@vkp-test.local`
2. Visit: https://vkp-consulting.fr/entities/
3. **Expected**: Page loads, can CRUD entities

4. Login as user: `test-user@vkp-test.local`
5. Visit: https://vkp-consulting.fr/entities/
6. **Expected**: Shows "Access Denied" alert, redirects to home

### User Manager (Admin Only)

Same test as Entity Manager for: https://vkp-consulting.fr/users/

### Game Manager (Admin Only)

Same test as Entity Manager for: https://vkp-consulting.fr/games/

## Step 9: Test Logout (2 minutes)

1. Login as any test user
2. Click "Logout" button on any manager page
3. **Expected**:
   - Redirects to Cognito logout
   - Then redirects to home page
   - Cookies cleared
4. Try accessing protected page
5. **Expected**: Redirects to login

## Step 10: Cleanup (2 minutes)

After testing, remove test data:

```bash
# Delete test users from Cognito
./scripts/delete-test-users.sh

# Delete test entities from S3
aws s3 rm s3://data-1-088455116440/json/users/ --recursive --exclude "*" --include "*test-*"
aws s3 rm s3://data-1-088455116440/json/files/ --recursive --exclude "*" --include "*test-*"

# Or keep them for future testing
```

## Quick Test Summary

### ✅ What Should Work

| Action | Admin | User | Guest | Unauth |
|--------|-------|------|-------|--------|
| Login | ✅ | ✅ | ✅ | N/A |
| GET /external/me | ✅ | ✅ | ✅ | ❌ |
| GET /internal/files | ✅ | ❌ | ❌ | ❌ |
| POST /internal/files | ✅ | ❌ | ❌ | ❌ |
| View Profile Page | ✅ | ✅ | ✅ | ❌ |
| Use Entity Manager | ✅ | ❌ | ❌ | ❌ |
| Use User Manager | ✅ | ❌ | ❌ | ❌ |
| Use Game Manager | ✅ | ❌ | ❌ | ❌ |
| Logout | ✅ | ✅ | ✅ | N/A |

Legend:
- ✅ = 200/201/204 OK
- ❌ = 401/403 Denied

## Common Issues

### Issue: 401 Unauthorized for Admin

**Cause**: Token expired or role not extracted correctly

**Fix**: 
1. Logout and login again to get fresh token
2. Verify token contains `custom:role`:
```javascript
const payload = JSON.parse(atob(idToken.split('.')[1]));
console.log(payload['custom:role']); // Should be 'admin'
```

### Issue: 403 Forbidden for Admin

**Cause**: User not in admin group or role claim missing

**Fix**:
```bash
# Check user groups
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id eu-north-1_OxGtXG08i \
  --username test-admin@vkp-test.local

# Add to admin group if missing
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-north-1_OxGtXG08i \
  --username test-admin@vkp-test.local \
  --group-name admin
```

### Issue: User Profile Not Found (404)

**Cause**: User entity not created in database

**Fix**: Follow Step 3 to create User entities for all test users

## Next Steps

For comprehensive testing, see: **`apiv2/plans/integration_test_plan.md`**

Includes tests for:
- ETag concurrency control
- Pagination (limit, cursor, prefix)
- Data validation
- Error responses
- User/Game entity endpoints
- Game-specific operations (rounds, moves)

---

**Total Time**: ~35 minutes  
**Last Updated**: November 3, 2025

