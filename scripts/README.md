# Scripts

Collection of utility scripts for managing the VKP application.

## Cognito User Management

### Create Test User

```bash
# Create test users for integration testing
./scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!
./scripts/create-test-user.sh user test-user@vkp-test.local "Test User" TestUser123!
./scripts/create-test-user.sh guest test-guest@vkp-test.local "Test Guest" TestGuest123!
```jq

**Features**:
- ✅ Creates Cognito user with custom attributes
- ✅ Sets permanent password (no forced change)
- ✅ Adds user to appropriate group
- ✅ Returns user ID (sub) for profile creation
- ✅ Suppresses welcome email

### Delete Test Users

```bash
# Clean up all test users (emails containing vkp-test.local)
./scripts/delete-test-users.sh
```

**Features**:
- ✅ Finds all users with test email pattern
- ✅ Deletes them from Cognito
- ✅ Reminds you to clean up S3 data

### Reset User Password

```bash
# Generate temporary password (user must change on first login)
./scripts/reset-user-password.sh admin@vkp-consulting.fr

# Set specific permanent password
./scripts/reset-user-password.sh admin@vkp-consulting.fr NewPassword123!

# Using user ID instead of email
./scripts/reset-user-password.sh 10ccb9cc-e031-70a5-cf21-1dd0d1a25b96 NewPass123!
```

**Features**:
- ✅ Reset password by email or user ID
- ✅ Generate temporary password OR set permanent password
- ✅ Automatic user lookup
- ✅ Shows user details after reset

**Example Output**:
```
🔐 Resetting password for Cognito user
User Pool ID: eu-north-1_OxGtXG08i
Region: eu-north-1

🔍 Looking up user...
✅ Found user: 10ccb9cc-e031-70a5-cf21-1dd0d1a25b96

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 Setting new password (permanent)...
✅ Password set successfully!

📋 New Password: NewAdminPass123!
   (permanent - user can login immediately)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 User Details:
   Username:     10ccb9cc-e031-70a5-cf21-1dd0d1a25b96
   Email:        admin@vkp-consulting.fr
   Display Name: Administrator
   Status:       CONFIRMED

✅ Password reset complete!
```

### List All Users (Formatted)

```bash
./scripts/list-cognito-users.sh
```

**Output**: Pretty-formatted list with user details in boxes

**Example**:
```
📋 Listing all users in Cognito User Pool
User Pool ID: eu-north-1_OxGtXG08i
Region: eu-north-1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────┐
│ Username:       10ccb9cc-e031-70a5-cf21-1dd0d1a25b96
│ User ID (sub):  10ccb9cc-e031-70a5-cf21-1dd0d1a25b96
│ Email:          admin@vkp-consulting.fr
│ Display Name:   Administrator
│ Role:           admin
│ Email Verified: 
│ Status:         CONFIRMED
│ Enabled:        true
│ Created:        2025-11-02T20:44:01.022000+01:00
│ Modified:       2025-11-02T20:44:41.160000+01:00
└─────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total users found: 1
```

### List All Users (JSON)

```bash
./scripts/list-cognito-users-json.sh
```

**Output**: JSON array of users

**Example**:
```json
[
  {
    "username": "10ccb9cc-e031-70a5-cf21-1dd0d1a25b96",
    "sub": "10ccb9cc-e031-70a5-cf21-1dd0d1a25b96",
    "email": "admin@vkp-consulting.fr",
    "displayName": "Administrator",
    "role": "admin",
    "emailVerified": null,
    "status": "CONFIRMED",
    "enabled": true,
    "created": "2025-11-02T20:44:01.022000+01:00",
    "modified": "2025-11-02T20:44:41.160000+01:00"
  }
]
```

**Pipe to file**:
```bash
./scripts/list-cognito-users-json.sh > users.json
```

**Pipe to jq for filtering**:
```bash
# Get only admin users
./scripts/list-cognito-users-json.sh | jq '.[] | select(.role == "admin")'

# Get emails only
./scripts/list-cognito-users-json.sh | jq '.[] | .email'

# Count users
./scripts/list-cognito-users-json.sh | jq 'length'
```

## Configuration

Both scripts use the following configuration:
- **User Pool ID**: `eu-north-1_OxGtXG08i`
- **Region**: `eu-north-1`

To change the user pool, edit the scripts and update these variables at the top.

## Getting Your Token

Before running integration tests, you need to get your ID token from the browser.

### Quick Method (Copy-Paste)

1. **Login** to https://vkp-consulting.fr/
2. **Open Developer Tools** (Press F12)
3. **Go to Console tab**
4. **Paste this code** and press Enter:

```javascript
const idToken = document.cookie.split('; ').find(c => c.startsWith('idToken=')).split('=')[1];
const payload = JSON.parse(atob(idToken.split('.')[1]));
console.log('✅ User:', payload.email, '| Role:', payload['custom:role']);
console.log('\n📋 Token:\n', idToken);
navigator.clipboard.writeText(idToken);
console.log('\n✅ Token copied to clipboard!');
```

5. **Token is now in your clipboard!**
6. **Export in terminal**:

```bash
export ID_TOKEN="<paste-token-here>"
```

### Detailed Instructions

For more methods and troubleshooting:

```bash
./scripts/get-token-from-browser.sh
```

Or see: `scripts/get-token.js` for a browser-based helper script.

### Quick Test Your Token

```bash
# Test if token works
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```

Expected: `200 OK` with your user profile

## Integration Testing

### Test Entity Endpoints

```bash
# Test as admin (should succeed)
export ADMIN_TOKEN="<your-admin-id-token>"
./scripts/test-entity-endpoints.sh "$ADMIN_TOKEN" admin

# Test as regular user (should fail with 403)
export USER_TOKEN="<your-user-id-token>"
./scripts/test-entity-endpoints.sh "$USER_TOKEN" user
```

**Tests**:
- ✅ LIST entities (GET /files)
- ✅ CREATE entity (POST /files)
- ✅ READ entity (GET /files/{id})
- ✅ GET metadata (GET /files/{id}/meta)
- ✅ UPDATE entity (PUT /files/{id})
- ✅ PATCH entity (PATCH /files/{id})
- ✅ DELETE entity (DELETE /files/{id})

**Expected Results**:
- Admin: All operations return 200/201/204
- User/Guest: All operations return 403 Forbidden

### Full Integration Test Plan

See: `apiv2/plans/integration_test_plan.md`

Complete test plan covering:
- Authentication flows
- Authorization for all roles
- All API endpoints (/internal/* and /external/*)
- Data validation
- ETag concurrency control
- Pagination
- Error handling
- UI integration
- Logout flows

## Requirements

- AWS CLI configured with appropriate credentials
- `jq` installed (`brew install jq` on macOS)
- `curl` for API testing
- IAM permissions:
  - `cognito-idp:ListUsers`
  - `cognito-idp:AdminGetUser`
  - `cognito-idp:AdminCreateUser`
  - `cognito-idp:AdminDeleteUser`
  - `cognito-idp:AdminSetUserPassword`
  - `cognito-idp:AdminResetUserPassword`
  - `cognito-idp:AdminAddUserToGroup`

## Features

- ✅ Handles pagination automatically (lists all users)
- ✅ Displays all user attributes
- ✅ Shows user status and enabled state
- ✅ Includes creation and modification dates
- ✅ JSON output for automation
- ✅ Pretty-formatted output for humans

## Troubleshooting

### Permission Denied
```bash
chmod +x scripts/list-cognito-users.sh
chmod +x scripts/list-cognito-users-json.sh
```

### AWS Credentials Not Found
```bash
aws configure
# or
export AWS_PROFILE=your-profile
```

### jq Not Found
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

