# Application-Level Authentication Plan

## 🎯 Goal

Handle all authentication and authorization in **application code** (Lambda), not IAM policies.

- ✅ All users can reach Lambda (no IAM blocking)
- ✅ Lambda code decides permissions
- ✅ Flexible, easy to customize
- ✅ Access rules in TypeScript, not Terraform

---

## 🏗️ Simplified Architecture

```
User Login (3 options)
       │
       ├─── Username/Password → Cognito User Pool
       ├─── Google OAuth      → Cognito User Pool  
       └─── Guest Mode        → Identity Pool
       
       ↓
       
Identity Pool (gives token to everyone)
       
       ↓
       
API Gateway (NO IAM authorization - just passes token)
       
       ↓
       
Lambda (YOUR CODE decides permissions)
```

---

## Phase 1: Simplified Cognito Setup

### Step 1.1: Cognito Configuration (Minimal IAM)

```terraform
# terraform/cognito.tf

# User Pool
resource "aws_cognito_user_pool" "main" {
  name = "vkp-user-pool"
  
  password_policy {
    minimum_length    = 12
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
  
  auto_verified_attributes = []
  username_attributes      = ["email"]
  
  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }
}

# Google Identity Provider
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"
  
  provider_details = {
    authorize_scopes = "email profile openid"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }
  
  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "web" {
  name         = "vkp-web-client"
  user_pool_id = aws_cognito_user_pool.main.id
  
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  supported_identity_providers = [
    "COGNITO",
    aws_cognito_identity_provider.google.provider_name
  ]
  
  callback_urls = [
    "https://vkp-consulting.fr/auth/callback",
    "http://localhost:3000/auth/callback"
  ]
  
  logout_urls = [
    "https://vkp-consulting.fr/",
    "http://localhost:3000/"
  ]
  
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  
  generate_secret = false
}

# Hosted UI Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth-vkp"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "vkp-identity-pool"
  allow_unauthenticated_identities = true  # Allow guests
  
  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.web.id
    provider_name = aws_cognito_user_pool.main.endpoint
  }
}

# ⭐ SIMPLIFIED IAM ROLES - Just allow API access, no restrictions
resource "aws_iam_role" "authenticated" {
  name = "cognito-authenticated-role"
  
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
          "cognito-identity.amazonaws.com:amr" = "authenticated"
        }
      }
    }]
  })
}

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

# ⭐ SIMPLE POLICY - Allow ALL API calls (Lambda will decide permissions)
resource "aws_iam_role_policy" "authenticated" {
  name = "authenticated-policy"
  role = aws_iam_role.authenticated.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "execute-api:Invoke"
      Resource = "${aws_apigatewayv2_api.main.execution_arn}/*/*/*"  # ALL routes
    }]
  })
}

resource "aws_iam_role_policy" "unauthenticated" {
  name = "unauthenticated-policy"
  role = aws_iam_role.unauthenticated.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "execute-api:Invoke"
      Resource = "${aws_apigatewayv2_api.main.execution_arn}/*/*/*"  # ALL routes
    }]
  })
}

# Attach roles to Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id
  
  roles = {
    authenticated   = aws_iam_role.authenticated.arn
    unauthenticated = aws_iam_role.unauthenticated.arn
  }
}

# Outputs
output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "identity_pool_id" {
  value = aws_cognito_identity_pool.main.id
}

output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}
```

**Key Difference**: IAM policies now allow **ALL** API routes. Your Lambda code will handle authorization.

---

### Step 1.2: API Gateway Configuration (No Authorization)

```terraform
# terraform/main.tf

# ALL routes use IAM auth, but IAM allows everything
# Real authorization happens in Lambda

resource "aws_apigatewayv2_route" "games_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "AWS_IAM"  # Just to get user identity
}

resource "aws_apigatewayv2_route" "games_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "AWS_IAM"  # Just to get user identity
}

# Same for all other routes...
```

**Note**: We still use IAM auth to get user identity, but IAM doesn't block anything.

---

## Phase 2: Application-Level Authorization

### Step 2.1: Enhanced User Context in Lambda

```typescript
// apiv2/src/index.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { router } from './presentation/routing/Router.js';
import { CognitoIdentityServiceProvider } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityServiceProvider({ region: 'eu-north-1' });

export interface AuthUser {
  // Identity Pool info (always available)
  identityId: string;
  type: 'authenticated' | 'guest';
  
  // User Pool info (only for authenticated users)
  userId?: string;          // Cognito User Pool sub
  username?: string;        // Email or username
  email?: string;
  name?: string;
  groups?: string[];        // User groups (e.g., 'admins')
  
  // Helper methods
  isAuthenticated: boolean;
  isGuest: boolean;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends APIGatewayProxyEventV2 {
  user?: AuthUser;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Extract user from request context
  const user = await extractUserFromEvent(event);
  
  // Add user to request
  const authenticatedRequest: AuthenticatedRequest = {
    ...event,
    user
  };
  
  // Route request (your controllers will check permissions)
  return router.handle(authenticatedRequest);
}

async function extractUserFromEvent(event: APIGatewayProxyEventV2): Promise<AuthUser | undefined> {
  const identity = event.requestContext.identity;
  
  if (!identity?.cognitoIdentityId) {
    return undefined;
  }
  
  const identityId = identity.cognitoIdentityId;
  const authType = identity.cognitoAuthenticationType;
  
  if (authType === 'unauthenticated') {
    // Guest user
    return {
      identityId,
      type: 'guest',
      isAuthenticated: false,
      isGuest: true,
      isAdmin: false
    };
  }
  
  // Authenticated user - get details from User Pool
  // The Identity ID is linked to a User Pool user
  // We need to get the User Pool user details
  
  // Option 1: Parse from JWT token in Authorization header
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userInfo = await getUserInfoFromToken(token);
    
    return {
      identityId,
      type: 'authenticated',
      userId: userInfo.sub,
      username: userInfo.username || userInfo.email,
      email: userInfo.email,
      name: userInfo.name,
      groups: userInfo.groups || [],
      isAuthenticated: true,
      isGuest: false,
      isAdmin: userInfo.groups?.includes('admins') || false
    };
  }
  
  // Fallback: minimal authenticated user
  return {
    identityId,
    type: 'authenticated',
    isAuthenticated: true,
    isGuest: false,
    isAdmin: false
  };
}

async function getUserInfoFromToken(token: string): Promise<any> {
  try {
    // Decode JWT token (you can use jsonwebtoken or aws-jwt-verify)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    return {
      sub: payload.sub,
      username: payload['cognito:username'],
      email: payload.email,
      name: payload.name,
      groups: payload['cognito:groups'] || []
    };
  } catch (error) {
    console.error('Error decoding token:', error);
    return {};
  }
}
```

### Step 2.2: Authorization Middleware (Your Access Rules)

```typescript
// apiv2/src/presentation/middleware/authorization.ts

import { Request } from '../../types.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';

/**
 * Require any session (authenticated or guest)
 * Use this for endpoints that need to track users but allow guests
 */
export function requireSession(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user) {
      throw new UnauthorizedError('Session required. Please login or continue as guest.');
    }
    return handler(req);
  };
}

/**
 * Require authenticated user (not guest)
 * Use this for endpoints that need a real account
 */
export function requireAuth(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required. Please login.');
    }
    
    if (req.user.isGuest) {
      throw new ForbiddenError('This action requires a registered account. Please sign up or login.');
    }
    
    return handler(req);
  };
}

/**
 * Require admin role
 * Use this for admin-only endpoints
 */
export function requireAdmin(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user?.isAuthenticated) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (!req.user.isAdmin) {
      throw new ForbiddenError('Admin access required');
    }
    
    return handler(req);
  };
}

/**
 * Require ownership or admin
 * Use this for user-specific resources
 */
export function requireOwnershipOrAdmin(getResourceUserId: (req: Request) => string | Promise<string>) {
  return (handler: (req: Request) => Promise<any>) => {
    return async (req: Request) => {
      if (!req.user?.isAuthenticated) {
        throw new UnauthorizedError('Authentication required');
      }
      
      const resourceUserId = await getResourceUserId(req);
      const isOwner = req.user.userId === resourceUserId;
      const isAdmin = req.user.isAdmin;
      
      if (!isOwner && !isAdmin) {
        throw new ForbiddenError('You can only access your own resources');
      }
      
      return handler(req);
    };
  };
}

/**
 * Allow public access (no auth required)
 * Use this for truly public endpoints
 */
export function allowPublic(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    // No checks, just pass through
    return handler(req);
  };
}

/**
 * Custom permission check
 * Use this for complex authorization logic
 */
export function requirePermission(
  checkPermission: (req: Request) => boolean | Promise<boolean>,
  errorMessage: string = 'Permission denied'
) {
  return (handler: (req: Request) => Promise<any>) => {
    return async (req: Request) => {
      const hasPermission = await checkPermission(req);
      
      if (!hasPermission) {
        throw new ForbiddenError(errorMessage);
      }
      
      return handler(req);
    };
  };
}
```

### Step 2.3: Apply Authorization in Controllers

```typescript
// apiv2/src/presentation/controllers/GameController.ts

import { Request, Response } from '../../types.js';
import { GameService } from '../../application/services/GameService.js';
import { 
  requireAuth, 
  requireSession, 
  allowPublic,
  requireOwnershipOrAdmin 
} from '../middleware/authorization.js';

export class GameController {
  constructor(private gameService: GameService) {}
  
  /**
   * List games - Anyone can view (including guests)
   */
  async listGames(req: Request): Promise<Response> {
    return allowPublic(async (req) => {
      const games = await this.gameService.findAll();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          games,
          viewer: req.user ? {
            type: req.user.type,
            id: req.user.identityId
          } : null
        })
      };
    })(req);
  }
  
  /**
   * Get single game - Anyone can view
   */
  async getGame(req: Request): Promise<Response> {
    return allowPublic(async (req) => {
      const gameId = req.pathParameters?.id;
      if (!gameId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Game ID required' })
        };
      }
      
      const game = await this.gameService.findById(gameId);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ game })
      };
    })(req);
  }
  
  /**
   * Create game - Requires authenticated user
   */
  async createGame(req: Request): Promise<Response> {
    return requireAuth(async (req) => {
      const data = JSON.parse(req.body || '{}');
      
      // Add creator info
      const gameData = {
        ...data,
        createdBy: req.user!.userId,
        createdByName: req.user!.name
      };
      
      const game = await this.gameService.create(gameData);
      
      return {
        statusCode: 201,
        body: JSON.stringify({ game })
      };
    })(req);
  }
  
  /**
   * Update game - Requires ownership or admin
   */
  async updateGame(req: Request): Promise<Response> {
    const gameId = req.pathParameters?.id;
    if (!gameId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Game ID required' })
      };
    }
    
    return requireOwnershipOrAdmin(async (req) => {
      // Get game to check ownership
      const game = await this.gameService.findById(gameId!);
      return game.createdBy; // Return owner's user ID
    })(async (req) => {
      const data = JSON.parse(req.body || '{}');
      const updatedGame = await this.gameService.update(gameId!, data);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ game: updatedGame })
      };
    })(req);
  }
  
  /**
   * Delete game - Requires ownership or admin
   */
  async deleteGame(req: Request): Promise<Response> {
    const gameId = req.pathParameters?.id;
    if (!gameId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Game ID required' })
      };
    }
    
    return requireOwnershipOrAdmin(async (req) => {
      const game = await this.gameService.findById(gameId!);
      return game.createdBy;
    })(async (req) => {
      await this.gameService.delete(gameId!);
      
      return {
        statusCode: 204,
        body: ''
      };
    })(req);
  }
}
```

### Step 2.4: User Controller Example

```typescript
// apiv2/src/presentation/controllers/UserController.ts

import { Request, Response } from '../../types.js';
import { UserService } from '../../application/services/UserService.js';
import { 
  requireAuth, 
  requireAdmin,
  requireOwnershipOrAdmin 
} from '../middleware/authorization.js';

export class UserController {
  constructor(private userService: UserService) {}
  
  /**
   * List users - Admin only
   */
  async listUsers(req: Request): Promise<Response> {
    return requireAdmin(async (req) => {
      const users = await this.userService.findAll();
      
      return {
        statusCode: 200,
        body: JSON.stringify({ users })
      };
    })(req);
  }
  
  /**
   * Get current user - Authenticated users only
   */
  async getCurrentUser(req: Request): Promise<Response> {
    return requireAuth(async (req) => {
      const user = await this.userService.findById(req.user!.userId!);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ user })
      };
    })(req);
  }
  
  /**
   * Get user by ID - Owner or admin
   */
  async getUser(req: Request): Promise<Response> {
    const userId = req.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID required' })
      };
    }
    
    return requireOwnershipOrAdmin(async () => userId)(async (req) => {
      const user = await this.userService.findById(userId!);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ user })
      };
    })(req);
  }
  
  /**
   * Update user - Owner or admin
   */
  async updateUser(req: Request): Promise<Response> {
    const userId = req.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID required' })
      };
    }
    
    return requireOwnershipOrAdmin(async () => userId)(async (req) => {
      const data = JSON.parse(req.body || '{}');
      const updatedUser = await this.userService.update(userId!, data);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ user: updatedUser })
      };
    })(req);
  }
  
  /**
   * Delete user - Admin only
   */
  async deleteUser(req: Request): Promise<Response> {
    return requireAdmin(async (req) => {
      const userId = req.pathParameters?.id;
      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'User ID required' })
        };
      }
      
      await this.userService.delete(userId);
      
      return {
        statusCode: 204,
        body: ''
      };
    })(req);
  }
}
```

---

## 📊 Authorization Examples

### Example 1: Public Endpoint
```typescript
// Anyone can access (including guests and unauthenticated)
async listGames(req: Request): Promise<Response> {
  return allowPublic(async (req) => {
    // Your logic here
    // req.user might be undefined, authenticated, or guest
  })(req);
}
```

### Example 2: Authenticated Only
```typescript
// Only registered users (no guests)
async createGame(req: Request): Promise<Response> {
  return requireAuth(async (req) => {
    // req.user is guaranteed to be authenticated
    // req.user.userId, req.user.email, etc. are available
  })(req);
}
```

### Example 3: Owner or Admin
```typescript
// Only resource owner or admin
async updateGame(req: Request): Promise<Response> {
  return requireOwnershipOrAdmin(async (req) => {
    const game = await this.gameService.findById(gameId);
    return game.ownerId; // Return owner's ID
  })(async (req) => {
    // User is either owner or admin
  })(req);
}
```

### Example 4: Custom Logic
```typescript
// Complex permission check
async specialAction(req: Request): Promise<Response> {
  return requirePermission(
    async (req) => {
      // Your custom logic
      if (!req.user?.isAuthenticated) return false;
      if (req.user.isAdmin) return true;
      
      // Check if user has special permission
      const hasPermission = await checkSpecialPermission(req.user.userId);
      return hasPermission;
    },
    'You do not have permission for this action'
  )(async (req) => {
    // User has permission
  })(req);
}
```

---

## 🎯 Key Benefits

### ✅ Full Control in Application
- All authorization logic in TypeScript
- Easy to test and debug
- Can use complex business logic
- No Terraform changes for permission updates

### ✅ Flexible Rules
```typescript
// Easy to add custom rules
if (req.user.isAdmin) {
  // Allow everything
} else if (req.user.isGuest) {
  // Read-only
} else if (isOwner) {
  // Can edit own resources
} else if (hasSpecialPermission) {
  // Custom logic
}
```

### ✅ Better Error Messages
```typescript
throw new ForbiddenError('You need to upgrade to premium to access this feature');
throw new ForbiddenError('This game is private. Request access from the owner.');
throw new ForbiddenError('You can only edit games you created');
```

### ✅ Easy Testing
```typescript
// Test with different user types
const guestUser = { type: 'guest', identityId: '123' };
const regularUser = { type: 'authenticated', userId: 'user-1', isAdmin: false };
const adminUser = { type: 'authenticated', userId: 'admin-1', isAdmin: true };

await controller.createGame({ user: guestUser }); // Should fail
await controller.createGame({ user: regularUser }); // Should succeed
await controller.deleteAnyGame({ user: adminUser }); // Should succeed
```

---

## 📝 Summary

### What Changed:
1. **IAM roles are minimal** - Just allow API access, no restrictions
2. **All authorization in Lambda** - Your TypeScript code decides permissions
3. **Flexible middleware** - Easy to customize for your needs
4. **Better error messages** - User-friendly feedback

### Why IAM Roles Still Exist:
- **Identity Pool requires them** - AWS requirement for Cognito Identity Pool
- **They're permissive** - Allow everything, don't block anything
- **Just for identity** - Used to get user info, not enforce permissions

### Your Access Rules:
```typescript
// In your controllers:
allowPublic()              // Anyone (including guests)
requireSession()           // Must have session (guest or authenticated)
requireAuth()              // Must be authenticated (no guests)
requireAdmin()             // Must be admin
requireOwnershipOrAdmin()  // Must own resource or be admin
requirePermission()        // Custom logic
```

**Now you have full control over authorization in your application code!** 🎉

