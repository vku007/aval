# Authentication Options Comparison

## Your Scenario Requirements

✅ User redirected to login page  
✅ Three login options available  
✅ All users get tokens  
✅ Can distinguish user type during session  

---

## Three Login Options

### 1. Username/Password Login
```
User enters email + password
         ↓
Cognito User Pool validates
         ↓
User Pool issues tokens
         ↓
Identity Pool exchanges for unified credentials
         ↓
User gets: Identity ID + User Pool ID
```

**User Info Available in Lambda:**
```typescript
{
  id: "eu-north-1:12345678-1234-1234-1234-123456789abc",
  type: "authenticated",
  cognitoUserId: "user-pool-sub-id",
  username: "user@example.com",
  name: "John Doe",
  email: "user@example.com"
}
```

---

### 2. Google OAuth Login
```
User clicks "Login with Google"
         ↓
Redirected to Google login
         ↓
Google authenticates user
         ↓
Cognito User Pool receives Google token
         ↓
Identity Pool exchanges for unified credentials
         ↓
User gets: Identity ID + User Pool ID (from Google)
```

**User Info Available in Lambda:**
```typescript
{
  id: "eu-north-1:87654321-4321-4321-4321-cba987654321",
  type: "authenticated",
  cognitoUserId: "google_123456789",
  username: "google_123456789",
  name: "Jane Smith",
  email: "jane@gmail.com"
}
```

---

### 3. Guest Mode (Continue as Guest)
```
User clicks "Continue as Guest"
         ↓
Identity Pool generates guest credentials
         ↓
User gets: Identity ID only (no User Pool)
```

**User Info Available in Lambda:**
```typescript
{
  id: "eu-north-1:abcdef12-3456-7890-abcd-ef1234567890",
  type: "guest"
  // No username, email, or name
}
```

---

## Token Comparison

| Login Method | Identity Pool Token | User Pool Token | Can Track User | Full Name | Email |
|--------------|--------------------:|----------------:|:--------------:|:---------:|:-----:|
| **Username/Password** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Google OAuth** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Guest Mode** | ✅ Yes | ❌ No | ⚠️ Session only | ❌ No | ❌ No |

---

## How to Distinguish Users in Lambda

### Check User Type
```typescript
if (req.user) {
  if (req.user.type === 'authenticated') {
    console.log('Full user:', req.user.name, req.user.email);
    // Allow all operations
  } else if (req.user.type === 'guest') {
    console.log('Guest user:', req.user.id);
    // Allow read-only operations
  }
} else {
  console.log('No session');
  // Reject request
}
```

### Track User Actions
```typescript
async function createGame(req: Request, data: GameData) {
  if (!req.user) {
    throw new UnauthorizedError('Login required');
  }
  
  if (req.user.type === 'guest') {
    throw new ForbiddenError('Please create an account to save games');
  }
  
  // Save game with user ID
  const game = {
    ...data,
    userId: req.user.id,              // Identity Pool ID
    createdBy: req.user.username,     // User Pool username
    createdAt: Date.now()
  };
  
  await gameRepository.save(game);
}
```

---

## Session Persistence

### Authenticated Users
- **Session Duration**: 30 days (refresh token)
- **Persists Across**: Browser restarts, device restarts
- **Stored In**: localStorage + secure cookies
- **Can Be Revoked**: Yes (via Cognito console)

### Guest Users
- **Session Duration**: Until browser cache cleared
- **Persists Across**: Browser restarts (if localStorage intact)
- **Stored In**: localStorage only
- **Can Be Revoked**: Only by clearing cache

---

## Upgrade Path: Guest → Authenticated

```javascript
// User is browsing as guest
console.log('Current user:', {
  id: 'eu-north-1:guest-id-123',
  type: 'guest'
});

// User clicks "Create Account"
await authService.upgradeGuestToUser(
  'user@example.com',  // email
  'SecurePass123',     // password
  'John Doe'           // name
);

// Now authenticated
console.log('Current user:', {
  id: 'eu-north-1:new-id-456',  // NEW Identity ID
  type: 'authenticated',
  username: 'user@example.com',
  name: 'John Doe',
  email: 'user@example.com'
});

// Note: Identity ID changes when upgrading
// Need to migrate guest data if you want to keep it
```

---

## Permissions Matrix

| Action | Guest | Authenticated | Admin |
|--------|:-----:|:-------------:|:-----:|
| **View Games** | ✅ | ✅ | ✅ |
| **View Entities** | ✅ | ✅ | ✅ |
| **Create Game** | ❌ | ✅ | ✅ |
| **Edit Own Game** | ❌ | ✅ | ✅ |
| **Edit Any Game** | ❌ | ❌ | ✅ |
| **Delete Own Game** | ❌ | ✅ | ✅ |
| **Delete Any Game** | ❌ | ❌ | ✅ |
| **View Users** | ❌ | ✅ | ✅ |
| **Edit Own Profile** | ❌ | ✅ | ✅ |
| **Edit Any Profile** | ❌ | ❌ | ✅ |

---

## Login Page UI Mockup

```
┌─────────────────────────────────────────────┐
│                                             │
│         Welcome to VKP Consulting           │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Email: [________________]            │ │
│  │  Password: [________________]         │ │
│  │  [        Login        ]              │ │
│  │                                       │ │
│  │  Don't have an account? Sign up       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│              ─── OR ───                     │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  [🔵 Continue with Google]           │ │
│  └───────────────────────────────────────┘ │
│                                             │
│              ─── OR ───                     │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  [👤 Continue as Guest]              │ │
│  │                                       │ │
│  │  Browse without an account            │ │
│  │  (Limited features)                   │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## User Banner Examples

### Authenticated User
```
┌─────────────────────────────────────────────────────────┐
│ ✓ John Doe | john@example.com | ID: eu-north-1:1234... │
│                                            [Logout]      │
└─────────────────────────────────────────────────────────┘
```

### Google User
```
┌─────────────────────────────────────────────────────────┐
│ ✓ Jane Smith | jane@gmail.com | ID: eu-north-1:5678... │
│                                            [Logout]      │
└─────────────────────────────────────────────────────────┘
```

### Guest User
```
┌─────────────────────────────────────────────────────────┐
│ 👤 Guest | ID: eu-north-1:abcd...                       │
│              [Create Account]              [Exit]       │
└─────────────────────────────────────────────────────────┘
```

---

## API Request Examples

### Authenticated User Request
```http
GET /apiv2/games HTTP/1.1
Host: vkp-consulting.fr
Authorization: AWS4-HMAC-SHA256 Credential=...
X-Amz-Security-Token: IQoJb3JpZ2luX2VjEJ...

Response:
{
  "user": {
    "id": "eu-north-1:12345678-...",
    "type": "authenticated",
    "name": "John Doe"
  },
  "games": [...]
}
```

### Guest User Request
```http
GET /apiv2/games HTTP/1.1
Host: vkp-consulting.fr
Authorization: AWS4-HMAC-SHA256 Credential=...
X-Amz-Security-Token: IQoJb3JpZ2luX2VjEJ...

Response:
{
  "user": {
    "id": "eu-north-1:abcdef12-...",
    "type": "guest"
  },
  "games": [...]
}
```

### Guest Tries to Create (Denied)
```http
POST /apiv2/games HTTP/1.1
Host: vkp-consulting.fr
Authorization: AWS4-HMAC-SHA256 Credential=...
X-Amz-Security-Token: IQoJb3JpZ2luX2VjEJ...

Response: 403 Forbidden
{
  "error": "This action requires a registered account",
  "type": "ForbiddenError",
  "requiresAuth": true
}
```

---

## Implementation Complexity

| Component | Complexity | Time Estimate |
|-----------|:----------:|:-------------:|
| **Cognito User Pool** | ⭐⭐ Medium | 1 hour |
| **Google OAuth Setup** | ⭐⭐ Medium | 1 hour |
| **Identity Pool** | ⭐⭐⭐ Complex | 2 hours |
| **IAM Policies** | ⭐⭐⭐ Complex | 2 hours |
| **Frontend (Amplify)** | ⭐⭐⭐⭐ Very Complex | 4 hours |
| **Lambda Updates** | ⭐⭐ Medium | 1 hour |
| **Testing** | ⭐⭐⭐ Complex | 2 hours |
| **Total** | | **13 hours** |

---

## Quick Start Commands

### 1. Setup Google OAuth
```bash
# Get credentials from Google Cloud Console
# Add to terraform.tfvars:
echo 'google_client_id = "your-id.apps.googleusercontent.com"' >> terraform.tfvars
echo 'google_client_secret = "your-secret"' >> terraform.tfvars
```

### 2. Deploy Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 3. Setup Frontend
```bash
cd site
npm install aws-amplify
# Update config with Terraform outputs
```

### 4. Test All Three Methods
```bash
# Test 1: Username/Password
curl -X POST https://vkp-consulting.fr/apiv2/auth/login \
  -d '{"username":"test@example.com","password":"TestPass123"}'

# Test 2: Google (manual - use browser)
open https://auth-vkp.auth.eu-north-1.amazoncognito.com/oauth2/authorize?...

# Test 3: Guest (automatic)
# Just visit site and click "Continue as Guest"
```

---

## Summary

✅ **Your exact scenario is fully supported!**

- Three login options on one page
- All users get tokens (Identity Pool credentials)
- Can distinguish user type in Lambda (`authenticated` vs `guest`)
- Can track users during session (via Identity ID)
- Guests can upgrade to full accounts
- Permissions enforced at IAM and Lambda level

**Next Step**: Follow the implementation plan in `multi_auth_scenario.md` 🚀

