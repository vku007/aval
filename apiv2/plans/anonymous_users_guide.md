# Anonymous Users Guide: AWS Cognito Options

## Overview

This guide explains different approaches for handling anonymous/guest users in your application.

---

## Option 1: Public Routes (RECOMMENDED - Simplest)

### How It Works
- Some API endpoints are completely public (no authentication)
- No tokens, no credentials needed
- Users can browse content freely
- Authentication only required for modifications

### Implementation
```terraform
# In API Gateway route configuration
resource "aws_apigatewayv2_route" "games_list" {
  route_key = "GET /apiv2/games"
  authorization_type = "NONE"  # Public access
}

resource "aws_apigatewayv2_route" "games_create" {
  route_key = "POST /apiv2/games"
  authorization_type = "CUSTOM"  # Requires login
  authorizer_id = aws_apigatewayv2_authorizer.cognito.id
}
```

### Pros
- ✅ Simplest to implement
- ✅ No frontend complexity
- ✅ Fast (no token validation)
- ✅ Good for content browsing

### Cons
- ❌ No user tracking for anonymous visitors
- ❌ Can't personalize experience
- ❌ Can't rate-limit per user

### Best For
- Public content websites
- Marketing sites
- Documentation
- Product catalogs

---

## Option 2: Cognito Identity Pools (Guest Access)

### How It Works
- Anonymous users get temporary AWS credentials
- Each visitor gets a unique identity ID
- Can track users across sessions
- Can upgrade to authenticated user later

### Implementation
```terraform
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "vkp-identity-pool"
  allow_unauthenticated_identities = true
  
  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.client.id
    provider_name = aws_cognito_user_pool.pool.endpoint
  }
}

# IAM role for unauthenticated users
resource "aws_iam_role" "unauthenticated" {
  name = "cognito-unauthenticated-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = "cognito-identity.amazonaws.com"
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "unauthenticated"
        }
      }
    }]
  })
}

# Limited permissions for anonymous users
resource "aws_iam_role_policy" "unauthenticated" {
  role = aws_iam_role.unauthenticated.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "execute-api:Invoke"
      Resource = [
        "arn:aws:execute-api:${var.region}:${var.account_id}:${var.api_id}/*/GET/apiv2/games*",
        "arn:aws:execute-api:${var.region}:${var.account_id}:${var.api_id}/*/GET/apiv2/entities*"
      ]
    }]
  })
}
```

### Frontend Code
```javascript
// Using AWS Amplify
import { Amplify, Auth } from 'aws-amplify';

Amplify.configure({
  Auth: {
    identityPoolId: 'eu-north-1:xxxxx',
    region: 'eu-north-1',
    userPoolId: 'eu-north-1_xxxxx',
    userPoolWebClientId: 'xxxxx'
  }
});

// Get guest credentials automatically
async function getGuestCredentials() {
  try {
    const credentials = await Auth.currentCredentials();
    console.log('Guest Identity ID:', credentials.identityId);
    return credentials;
  } catch (error) {
    console.error('Error getting guest credentials:', error);
  }
}

// Make API call as guest
async function callAPIAsGuest() {
  const credentials = await Auth.currentCredentials();
  
  // AWS SDK will automatically sign the request
  const response = await fetch('https://vkp-consulting.fr/apiv2/games', {
    method: 'GET',
    headers: {
      'Authorization': `AWS4-HMAC-SHA256 ...` // Signed by AWS SDK
    }
  });
  
  return response.json();
}

// Upgrade to authenticated user
async function login(username, password) {
  const user = await Auth.signIn(username, password);
  // Same identity ID is now authenticated
  console.log('Upgraded to authenticated user');
}
```

### Pros
- ✅ Track anonymous users
- ✅ Unique identity per visitor
- ✅ Can upgrade to authenticated
- ✅ Fine-grained permissions
- ✅ Rate limiting per identity

### Cons
- ❌ More complex implementation
- ❌ Requires AWS SDK on frontend
- ❌ Request signing overhead
- ❌ Harder to debug

### Best For
- Mobile apps
- Progressive web apps
- Apps needing user tracking
- Personalized experiences

---

## Option 3: API Keys (Simple Token-Based)

### How It Works
- Generate API keys in API Gateway
- Distribute keys to users
- Include key in request header
- No Cognito needed

### Implementation
```terraform
resource "aws_api_gateway_api_key" "public" {
  name = "public-api-key"
}

resource "aws_api_gateway_usage_plan" "public" {
  name = "public-usage-plan"
  
  api_stages {
    api_id = aws_apigatewayv2_api.main.id
    stage  = aws_apigatewayv2_stage.main.name
  }
  
  quota_settings {
    limit  = 10000
    period = "MONTH"
  }
  
  throttle_settings {
    burst_limit = 100
    rate_limit  = 50
  }
}

resource "aws_api_gateway_usage_plan_key" "public" {
  key_id        = aws_api_gateway_api_key.public.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.public.id
}
```

### Frontend Code
```javascript
const API_KEY = 'your-api-key-here';

async function callAPI() {
  const response = await fetch('https://vkp-consulting.fr/apiv2/games', {
    headers: {
      'x-api-key': API_KEY
    }
  });
  return response.json();
}
```

### Pros
- ✅ Very simple
- ✅ Easy to implement
- ✅ Built-in rate limiting
- ✅ Usage tracking

### Cons
- ❌ Single key for all users
- ❌ Key can be extracted from frontend
- ❌ No per-user tracking
- ❌ If key leaks, must rotate for everyone

### Best For
- Public APIs
- Developer APIs
- Rate-limited access
- Simple use cases

---

## Comparison Table

| Feature | Public Routes | Identity Pools | API Keys |
|---------|--------------|----------------|----------|
| **Complexity** | ⭐ Simple | ⭐⭐⭐ Complex | ⭐⭐ Medium |
| **User Tracking** | ❌ None | ✅ Per-user | ❌ Shared |
| **Rate Limiting** | ⚠️ IP-based | ✅ Per-identity | ✅ Per-key |
| **Cost** | 💰 Free | 💰 Free (50K MAU) | 💰 Free |
| **Security** | ⭐⭐ Low | ⭐⭐⭐⭐ High | ⭐⭐⭐ Medium |
| **Frontend Code** | ⭐ Minimal | ⭐⭐⭐ Complex | ⭐⭐ Simple |
| **Upgrade to Auth** | ⭐⭐ Manual | ⭐⭐⭐⭐ Seamless | ⭐ Manual |

---

## Recommendation for Your Use Case

Based on your requirements:
- Simplified user management
- No email verification
- Just name and 12-char password

### I recommend: **Option 1 (Public Routes) + Cognito User Pool**

**Why?**
1. **Simplest to implement** - no additional complexity
2. **Good UX** - users can browse without friction
3. **Clear separation** - public content vs. user actions
4. **Easy to understand** - straightforward authentication model

**Implementation:**
```
Public (no auth):
- Browse games
- View entities
- Read documentation

Protected (Cognito auth):
- Create/edit/delete games
- Manage user profile
- Admin functions
```

**When to add Identity Pools later:**
- If you need to track anonymous user behavior
- If you want to personalize content for guests
- If you need per-user rate limiting
- If you're building a mobile app

---

## Migration Path

### Start Simple (Phase 1)
1. Implement public routes for browsing
2. Add Cognito User Pool for authenticated users
3. Protect write operations only

### Add Tracking Later (Phase 2 - Optional)
1. Add Identity Pool for guest tracking
2. Migrate public routes to IAM authorization
3. Implement guest-to-user upgrade flow

### Add Advanced Features (Phase 3 - Optional)
1. Personalization based on guest behavior
2. Progressive profiling
3. Social login integration

---

## Code Example: Hybrid Approach

### Terraform Configuration
```terraform
# Public route - no auth
resource "aws_apigatewayv2_route" "games_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "NONE"  # Public
}

# Protected route - requires login
resource "aws_apigatewayv2_route" "games_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
```

### Frontend Code
```javascript
// auth-service.js
export class AuthService {
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  }
  
  requireAuth(action) {
    if (!this.isAuthenticated()) {
      if (confirm('Please login to perform this action')) {
        this.login();
      }
      return false;
    }
    return true;
  }
}

// app.js
import { AuthService } from './auth-service.js';
const auth = new AuthService();

// Public action - no auth needed
async function viewGames() {
  const response = await fetch('/apiv2/games');
  const games = await response.json();
  displayGames(games);
}

// Protected action - auth required
async function createGame(data) {
  if (!auth.requireAuth('create game')) {
    return;
  }
  
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/apiv2/games', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

---

## Summary

**For your requirements, use Public Routes + Cognito User Pool:**
- ✅ Simple password policy (12 chars)
- ✅ No email verification
- ✅ Just name required
- ✅ Public browsing without login
- ✅ Authentication for user actions
- ✅ Easy to implement and maintain

**Add Identity Pools only if you need:**
- Guest user tracking
- Personalization
- Per-user rate limiting
- Mobile app support

Start simple, add complexity only when needed! 🚀

