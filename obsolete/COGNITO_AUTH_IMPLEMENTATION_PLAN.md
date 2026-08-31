# Cognito Authentication Implementation Plan

## 📋 Overview

This document outlines the implementation plan for adding AWS Cognito authentication to the VKP Consulting application with support for multiple authentication methods and role-based access control.

**Current Site**: https://vkp-consulting.fr

---

## 🎯 Requirements Summary

### Authentication Methods
1. **Regular User Login** - Cognito-managed credentials
2. **Google OAuth** - Social identity provider
3. **Guest Access** - Temporary anonymous authentication with token
4. **New User Registration** - Custom sign-up with name uniqueness validation

### User Roles & Access Control

| Role | Access Level | Implementation |
|------|--------------|----------------|
| **Admin** | Full access including `/apiv2/internal/*` | IAM Role + Application Level |
| **Regular User** | All endpoints except `/apiv2/internal/*` | Application Level |
| **Guest** | All endpoints except `/apiv2/internal/*` | Application Level |

### Access Control Strategy
- **IAM Roles**: Control access to `/apiv2/internal/*` endpoints (admin only)
- **Application Level**: Control access to other endpoints based on user role

---

## 🏗️ Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront + Lambda@Edge                  │
│              (Authentication Check & Redirect)               │
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
             ↓ (Unauthenticated)        ↓ (Authenticated)
┌────────────────────────┐    ┌──────────────────────────────┐
│   Cognito Hosted UI    │    │      CloudFront (Origin)     │
│  - Username/Password   │    │                              │
│  - Google OAuth        │    │  ┌────────────────────────┐  │
│  - Guest Access        │    │  │   S3 Static Site       │  │
│  - Sign Up             │    │  │   (with JWT in cookie) │  │
└────────────────────────┘    │  └────────────────────────┘  │
                              │                              │
                              │  ┌────────────────────────┐  │
                              │  │   API Gateway          │  │
                              │  │   (JWT Authorizer)     │  │
                              │  └──────────┬─────────────┘  │
                              └─────────────┼────────────────┘
                                           │
                              ┌────────────┴─────────────┐
                              ↓                          ↓
                    ┌──────────────────┐      ┌──────────────────┐
                    │  Lambda (API v2) │      │  Lambda (Simple) │
                    │  - Check JWT     │      │                  │
                    │  - Verify Role   │      │                  │
                    │  - IAM for admin │      │                  │
                    └──────────────────┘      └──────────────────┘
```

### Authentication Flow

```
1. User visits https://vkp-consulting.fr
   ↓
2. Lambda@Edge checks for JWT token in cookie
   ↓
3a. NO TOKEN → Redirect to Cognito Hosted UI
   ↓
   User chooses authentication method:
   - Login (username/password)
   - Google OAuth
   - Guest Access (skip login)
   - Sign Up (new user)
   ↓
   Cognito returns JWT tokens
   ↓
   Set tokens in HttpOnly cookies
   ↓
   Redirect back to application

3b. HAS TOKEN → Validate JWT
   ↓
   Extract user role from JWT claims
   ↓
   Allow access to application
   ↓
   API calls include JWT in Authorization header
   ↓
   API Gateway validates JWT
   ↓
   Lambda checks role-based permissions
```

---

## 🔧 Implementation Steps

### Phase 1: Cognito Setup (Terraform)

#### 1.1 Create Cognito User Pool

```hcl
# terraform/modules/cognito/main.tf

resource "aws_cognito_user_pool" "main" {
  name = "vkp-user-pool"

  # Password policy
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Username configuration
  username_attributes = ["email"]
  
  # Allow users to sign up themselves
  auto_verified_attributes = ["email"]

  # Email configuration (optional)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Custom attributes for role
  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable            = true
    string_attribute_constraints {
      min_length = 1
      max_length = 20
    }
  }

  # Custom attribute for name uniqueness
  schema {
    name                = "display_name"
    attribute_data_type = "String"
    mutable            = true
    string_attribute_constraints {
      min_length = 2
      max_length = 100
    }
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Lambda triggers for custom logic
  lambda_config {
    pre_sign_up                    = aws_lambda_function.pre_signup.arn
    post_confirmation              = aws_lambda_function.post_confirmation.arn
    pre_token_generation           = aws_lambda_function.pre_token_generation.arn
  }

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

#### 1.2 Configure Google Identity Provider

```hcl
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
    username = "sub"
    name     = "name"
  }
}
```

#### 1.3 Create User Pool Client

```hcl
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "vkp-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]

  # Callback URLs
  callback_urls = [
    "https://vkp-consulting.fr/callback",
    "https://vkp-consulting.fr"
  ]

  logout_urls = [
    "https://vkp-consulting.fr/logout"
  ]

  # Supported identity providers
  supported_identity_providers = ["COGNITO", "Google"]

  # Token validity
  id_token_validity      = 60  # minutes
  access_token_validity  = 60  # minutes
  refresh_token_validity = 30  # days

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  # Prevent secret generation (for public clients)
  generate_secret = false

  # Read/write attributes
  read_attributes  = ["email", "name", "custom:role", "custom:display_name"]
  write_attributes = ["email", "name", "custom:display_name"]
}
```

#### 1.4 Configure Cognito Domain

```hcl
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "vkp-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}
```

#### 1.5 Create User Pool Groups

```hcl
resource "aws_cognito_user_pool_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users with full access"
  precedence   = 1
  role_arn     = aws_iam_role.cognito_admin.arn
}

resource "aws_cognito_user_pool_group" "user" {
  name         = "user"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Regular users"
  precedence   = 2
  role_arn     = aws_iam_role.cognito_user.arn
}

resource "aws_cognito_user_pool_group" "guest" {
  name         = "guest"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Guest users with limited access"
  precedence   = 3
  role_arn     = aws_iam_role.cognito_guest.arn
}
```

---

### Phase 2: Lambda Triggers for Custom Logic

#### 2.1 Pre-Signup Lambda (Name Uniqueness Check)

```typescript
// lambda/cognito-triggers/pre-signup.ts

import { PreSignUpTriggerEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

export const handler = async (event: PreSignUpTriggerEvent) => {
  console.log('Pre-signup trigger:', JSON.stringify(event, null, 2));

  const displayName = event.request.userAttributes['custom:display_name'];
  const userPoolId = event.userPoolId;

  // Check if display name already exists
  if (displayName) {
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `custom:display_name = "${displayName}"`
    });

    const response = await cognito.send(command);

    if (response.Users && response.Users.length > 0) {
      throw new Error('Display name already exists. Please choose a different name.');
    }
  }

  // Auto-confirm guest users (users without email)
  if (!event.request.userAttributes.email) {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = false;
  } else {
    // Regular users need email verification
    event.response.autoConfirmUser = false;
    event.response.autoVerifyEmail = true;
  }

  return event;
};
```

#### 2.2 Post-Confirmation Lambda (Assign Default Role)

```typescript
// lambda/cognito-triggers/post-confirmation.ts

import { PostConfirmationTriggerEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

export const handler = async (event: PostConfirmationTriggerEvent) => {
  console.log('Post-confirmation trigger:', JSON.stringify(event, null, 2));

  const userPoolId = event.userPoolId;
  const username = event.userName;
  const email = event.request.userAttributes.email;

  // Determine default group
  let groupName = 'user'; // Default to regular user

  // Guest users (no email)
  if (!email) {
    groupName = 'guest';
  }

  // Add user to default group
  const command = new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: username,
    GroupName: groupName
  });

  await cognito.send(command);

  console.log(`User ${username} added to group ${groupName}`);

  return event;
};
```

#### 2.3 Pre-Token Generation Lambda (Add Role to JWT)

```typescript
// lambda/cognito-triggers/pre-token-generation.ts

import { PreTokenGenerationTriggerEvent } from 'aws-lambda';

export const handler = async (event: PreTokenGenerationTriggerEvent) => {
  console.log('Pre-token generation trigger:', JSON.stringify(event, null, 2));

  // Get user's groups
  const groups = event.request.groupConfiguration.groupsToOverride || [];

  // Determine role based on group (first group has highest precedence)
  let role = 'guest';
  if (groups.includes('admin')) {
    role = 'admin';
  } else if (groups.includes('user')) {
    role = 'user';
  }

  // Add custom claims to ID token
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      role: role,
      display_name: event.request.userAttributes['custom:display_name'] || 'Anonymous'
    }
  };

  return event;
};
```

#### 2.4 Terraform for Lambda Triggers

```hcl
# terraform/modules/cognito/lambda-triggers.tf

resource "aws_lambda_function" "pre_signup" {
  filename         = "${path.module}/../../lambda/cognito-triggers/pre-signup.zip"
  function_name    = "vkp-cognito-pre-signup"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
    }
  }
}

resource "aws_lambda_function" "post_confirmation" {
  filename         = "${path.module}/../../lambda/cognito-triggers/post-confirmation.zip"
  function_name    = "vkp-cognito-post-confirmation"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
    }
  }
}

resource "aws_lambda_function" "pre_token_generation" {
  filename         = "${path.module}/../../lambda/cognito-triggers/pre-token-generation.zip"
  function_name    = "vkp-cognito-pre-token-generation"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10
}

# Lambda permissions for Cognito
resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_pre_token_generation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token_generation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
```

---

### Phase 3: Lambda@Edge for Authentication Check

#### 3.1 Viewer Request Lambda@Edge

```typescript
// lambda/edge/viewer-request.ts

import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.CLIENT_ID!;

const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const client = jwksClient({ jwksUri });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  console.log('Request URI:', request.uri);

  // Extract JWT from cookie
  const cookies = headers.cookie?.[0]?.value || '';
  const tokenMatch = cookies.match(/idToken=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  // Public paths that don't require authentication
  const publicPaths = ['/callback', '/logout', '/errors/'];
  const isPublicPath = publicPaths.some(path => request.uri.startsWith(path));

  if (isPublicPath) {
    return request;
  }

  // No token - redirect to Cognito login
  if (!token) {
    const loginUrl = `https://${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+profile&redirect_uri=https://vkp-consulting.fr/callback`;
    
    return {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: loginUrl
        }]
      }
    };
  }

  // Verify JWT
  try {
    await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
        audience: CLIENT_ID
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    // Token is valid, allow request
    return request;
  } catch (error) {
    console.error('JWT verification failed:', error);

    // Invalid token - redirect to login
    const loginUrl = `https://${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+profile&redirect_uri=https://vkp-consulting.fr/callback`;
    
    return {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: loginUrl
        }]
      }
    };
  }
};
```

#### 3.2 Terraform for Lambda@Edge

```hcl
# terraform/modules/cloudfront/lambda-edge.tf

resource "aws_lambda_function" "viewer_request" {
  provider         = aws.us-east-1  # Lambda@Edge must be in us-east-1
  filename         = "${path.module}/../../lambda/edge/viewer-request.zip"
  function_name    = "vkp-viewer-request"
  role            = aws_iam_role.lambda_edge.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 5
  publish         = true  # Required for Lambda@Edge

  environment {
    variables = {
      COGNITO_DOMAIN = var.cognito_domain
      USER_POOL_ID   = var.user_pool_id
      CLIENT_ID      = var.client_id
      AWS_REGION     = var.region
    }
  }
}

# Update CloudFront distribution to use Lambda@Edge
resource "aws_cloudfront_distribution" "main" {
  # ... existing configuration ...

  default_cache_behavior {
    # ... existing configuration ...

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.viewer_request.qualified_arn
      include_body = false
    }
  }
}
```

---

### Phase 4: API Gateway JWT Authorizer

#### 4.1 Configure JWT Authorizer

```hcl
# terraform/modules/apigateway-http/authorizer.tf

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# Update routes to use authorizer
resource "aws_apigatewayv2_route" "api2_with_auth" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "ANY /apiv2/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api2.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
```

---

### Phase 5: Update Lambda API to Check Roles

#### 5.1 Add JWT Verification Middleware

```typescript
// apiv2/src/presentation/middleware/auth.ts

import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';

const USER_POOL_ID = process.env.USER_POOL_ID!;
const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.CLIENT_ID!;

const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const client = jwksClient({ jwksUri });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

export interface AuthenticatedRequest extends HttpRequest {
  user?: {
    sub: string;
    email?: string;
    role: string;
    display_name: string;
    groups: string[];
  };
}

export function authMiddleware() {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authHeader = request.headers.authorization || request.headers.Authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = await new Promise<any>((resolve, reject) => {
        jwt.verify(token, getKey, {
          issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
          audience: CLIENT_ID
        }, (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        });
      });

      // Attach user info to request
      (request as AuthenticatedRequest).user = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role || 'guest',
        display_name: decoded.display_name || 'Anonymous',
        groups: decoded['cognito:groups'] || []
      };

      return next();
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  };
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!allowedRoles.includes(authRequest.user.role)) {
      throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
    }

    return next();
  };
}
```

#### 5.2 Update Router with Auth Middleware

```typescript
// apiv2/src/index.ts

import { authMiddleware, requireRole } from './presentation/middleware/auth.js';

function createRouter() {
  if (!router) {
    initializeServices();
    entityController = new EntityController(entityService, logger);
    userController = new UserController(userService, logger);
    gameController = new GameController(gameService, logger);
    
    router = new Router()
      .use(corsMiddleware(config))
      .use(contentTypeMiddleware())
      .use(authMiddleware()) // Add JWT verification
      
      // Admin-only routes (IAM + Application level)
      .get('/apiv2/internal/files', requireRole('admin'), (req) => entityController.list(req))
      .get('/apiv2/internal/files/:id/meta', requireRole('admin'), (req) => entityController.getMeta(req))
      .get('/apiv2/internal/files/:id', requireRole('admin'), (req) => entityController.get(req))
      .post('/apiv2/internal/files', requireRole('admin'), (req) => entityController.create(req))
      .put('/apiv2/internal/files/:id', requireRole('admin'), (req) => entityController.update(req))
      .patch('/apiv2/internal/files/:id', requireRole('admin'), (req) => entityController.patch(req))
      .delete('/apiv2/internal/files/:id', requireRole('admin'), (req) => entityController.delete(req))
      
      .get('/apiv2/internal/users', requireRole('admin'), (req) => userController.list(req))
      .get('/apiv2/internal/users/:id/meta', requireRole('admin'), (req) => userController.getMeta(req))
      .get('/apiv2/internal/users/:id', requireRole('admin'), (req) => userController.get(req))
      .post('/apiv2/internal/users', requireRole('admin'), (req) => userController.create(req))
      .put('/apiv2/internal/users/:id', requireRole('admin'), (req) => userController.update(req))
      .patch('/apiv2/internal/users/:id', requireRole('admin'), (req) => userController.patch(req))
      .delete('/apiv2/internal/users/:id', requireRole('admin'), (req) => userController.delete(req))
      
      .get('/apiv2/internal/games', requireRole('admin'), (req) => gameController.list(req))
      .get('/apiv2/internal/games/:id/meta', requireRole('admin'), (req) => gameController.getMeta(req))
      .get('/apiv2/internal/games/:id', requireRole('admin'), (req) => gameController.get(req))
      .post('/apiv2/internal/games', requireRole('admin'), (req) => gameController.create(req))
      .put('/apiv2/internal/games/:id', requireRole('admin'), (req) => gameController.update(req))
      .patch('/apiv2/internal/games/:id', requireRole('admin'), (req) => gameController.patch(req))
      .delete('/apiv2/internal/games/:id', requireRole('admin'), (req) => gameController.delete(req))
      .post('/apiv2/internal/games/:id/rounds', requireRole('admin'), (req) => gameController.addRound(req))
      .post('/apiv2/internal/games/:gameId/rounds/:roundId/moves', requireRole('admin'), (req) => gameController.addMove(req))
      .patch('/apiv2/internal/games/:gameId/rounds/:roundId/finish', requireRole('admin'), (req) => gameController.finishRound(req))
      .patch('/apiv2/internal/games/:id/finish', requireRole('admin'), (req) => gameController.finishGame(req));
  }
  return router;
}
```

---

### Phase 6: IAM Roles for Cognito Groups

#### 6.1 Admin IAM Role

```hcl
# terraform/modules/cognito/iam-roles.tf

resource "aws_iam_role" "cognito_admin" {
  name = "vkp-cognito-admin-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
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
      }
    ]
  })
}

resource "aws_iam_role_policy" "cognito_admin_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/ANY/apiv2/internal/*"
        ]
      }
    ]
  })
}
```

#### 6.2 Regular User IAM Role

```hcl
resource "aws_iam_role" "cognito_user" {
  name = "vkp-cognito-user-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
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
      }
    ]
  })
}

resource "aws_iam_role_policy" "cognito_user_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_user.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/ANY/apiv2/internal/*"
        ]
      }
    ]
  })
}
```

#### 6.3 Guest IAM Role

```hcl
resource "aws_iam_role" "cognito_guest" {
  name = "vkp-cognito-guest-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cognito_guest_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_guest.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/ANY/apiv2/internal/*"
        ]
      }
    ]
  })
}
```

---

### Phase 7: Frontend Integration

#### 7.1 OAuth Callback Handler

```html
<!-- site/callback.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Authenticating...</h2>
    <p>Please wait while we complete your sign-in.</p>
  </div>

  <script>
    (async function() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        alert('Authentication failed: ' + error);
        window.location.href = '/';
        return;
      }

      if (!code) {
        alert('No authorization code received');
        window.location.href = '/';
        return;
      }

      try {
        // Exchange code for tokens
        const tokenEndpoint = 'https://vkp-auth.auth.eu-north-1.amazoncognito.com/oauth2/token';
        
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: 'YOUR_CLIENT_ID',
            code: code,
            redirect_uri: 'https://vkp-consulting.fr/callback'
          })
        });

        if (!response.ok) {
          throw new Error('Token exchange failed');
        }

        const tokens = await response.json();

        // Store tokens in HttpOnly cookies (via API endpoint)
        await fetch('/api/auth/set-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tokens)
        });

        // Redirect to home
        window.location.href = '/';
      } catch (error) {
        console.error('Authentication error:', error);
        alert('Authentication failed. Please try again.');
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>
```

#### 7.2 Update UI to Include JWT in API Calls

```javascript
// site/users/index.html (update app object)

const app = {
  apiBase: 'https://vkp-consulting.fr/apiv2/internal',
  users: [],
  selectedUser: null,

  async request(method, path, body = null, headers = {}) {
    // Get JWT from cookie
    const cookies = document.cookie.split(';');
    const idTokenCookie = cookies.find(c => c.trim().startsWith('idToken='));
    const idToken = idTokenCookie ? idTokenCookie.split('=')[1] : null;

    const url = `${this.apiBase}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`, // Add JWT
        ...headers
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
      window.location.href = 'https://vkp-auth.auth.eu-north-1.amazoncognito.com/login?client_id=YOUR_CLIENT_ID&response_type=code&scope=email+openid+profile&redirect_uri=https://vkp-consulting.fr/callback';
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || errorData.title || `HTTP ${response.status}`);
      } catch {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }

    const data = response.status === 204 ? null : await response.json();
    return {
      data,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  },

  // ... rest of the app code
};
```

#### 7.3 Add Logout Functionality

```html
<!-- Add to site/index.html -->
<div class="user-menu">
  <button onclick="logout()">Logout</button>
</div>

<script>
  function logout() {
    // Clear cookies
    document.cookie = 'idToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Redirect to Cognito logout
    window.location.href = 'https://vkp-auth.auth.eu-north-1.amazoncognito.com/logout?client_id=YOUR_CLIENT_ID&logout_uri=https://vkp-consulting.fr';
  }
</script>
```

---

### Phase 8: Customize Cognito Hosted UI

#### 8.1 Custom CSS for Hosted UI

```css
/* cognito-custom.css */

/* Logo */
.logo-customizable {
  max-width: 200px;
  max-height: 100px;
}

/* Background */
.background-customizable {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
}

/* Banner */
.banner-customizable {
  padding: 25px 0px 25px 0px;
  background-color: rgba(255, 255, 255, 0.1);
}

/* Labels */
.label-customizable {
  font-weight: 500;
  color: #1f2937;
}

/* Inputs */
.textbox-customizable {
  border-radius: 8px;
  border: 2px solid #d1d5db;
  padding: 10px;
}

.textbox-customizable:focus {
  border-color: #1e3a8a;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
}

/* Buttons */
.submitButton-customizable {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  border-radius: 8px;
  padding: 12px;
  font-weight: 600;
  border: none;
}

.submitButton-customizable:hover {
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(30, 58, 138, 0.3);
}

/* Links */
.redirect-customizable {
  color: #1e3a8a;
  text-decoration: none;
}

.redirect-customizable:hover {
  text-decoration: underline;
}

/* Guest Access Button */
.guest-button {
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px;
  width: 100%;
  margin-top: 10px;
  font-weight: 600;
  cursor: pointer;
}

.guest-button:hover {
  background: #4b5563;
}
```

#### 8.2 Upload Custom CSS to S3

```bash
# Upload custom CSS
aws s3 cp cognito-custom.css s3://vkp-consulting.fr/cognito/custom.css

# Update Cognito User Pool UI customization
aws cognito-idp set-ui-customization \
  --user-pool-id YOUR_USER_POOL_ID \
  --css "$(cat cognito-custom.css)"
```

---

## 📋 Implementation Checklist

### Prerequisites
- [ ] Google OAuth credentials (Client ID & Secret)
- [ ] Backup current infrastructure state
- [ ] Test environment setup

### Phase 1: Cognito Setup
- [ ] Create Cognito User Pool
- [ ] Configure password policy
- [ ] Add custom attributes (role, display_name)
- [ ] Configure Google Identity Provider
- [ ] Create User Pool Client
- [ ] Configure Cognito Domain
- [ ] Create User Pool Groups (admin, user, guest)

### Phase 2: Lambda Triggers
- [ ] Implement pre-signup Lambda (name uniqueness)
- [ ] Implement post-confirmation Lambda (assign role)
- [ ] Implement pre-token-generation Lambda (add claims)
- [ ] Deploy Lambda functions
- [ ] Configure Lambda permissions
- [ ] Test Lambda triggers

### Phase 3: Lambda@Edge
- [ ] Implement viewer-request Lambda@Edge
- [ ] Deploy to us-east-1
- [ ] Attach to CloudFront distribution
- [ ] Test authentication redirect

### Phase 4: API Gateway
- [ ] Configure JWT Authorizer
- [ ] Update routes to use authorizer
- [ ] Test API authentication

### Phase 5: Lambda API Updates
- [ ] Add JWT verification middleware
- [ ] Add role-based authorization middleware
- [ ] Update routes with role requirements
- [ ] Deploy updated Lambda
- [ ] Test role-based access

### Phase 6: IAM Roles
- [ ] Create Cognito Identity Pool
- [ ] Create admin IAM role
- [ ] Create user IAM role
- [ ] Create guest IAM role
- [ ] Test IAM-based access control

### Phase 7: Frontend
- [ ] Create callback handler page
- [ ] Update UI to include JWT in requests
- [ ] Add logout functionality
- [ ] Test authentication flow
- [ ] Test guest access

### Phase 8: UI Customization
- [ ] Create custom CSS
- [ ] Upload to S3
- [ ] Apply to Cognito Hosted UI
- [ ] Test UI appearance

### Testing
- [ ] Test regular user login
- [ ] Test Google OAuth login
- [ ] Test guest access
- [ ] Test new user registration
- [ ] Test name uniqueness validation
- [ ] Test admin access to /internal/*
- [ ] Test user denied access to /internal/*
- [ ] Test guest denied access to /internal/*
- [ ] Test token expiration
- [ ] Test logout

### Documentation
- [ ] Update API documentation
- [ ] Update infrastructure overview
- [ ] Create user guide
- [ ] Create admin guide

---

## 🔒 Security Considerations

### Token Security
- **HttpOnly Cookies**: Store JWT in HttpOnly cookies to prevent XSS attacks
- **Secure Flag**: Use Secure flag for HTTPS-only transmission
- **SameSite**: Set SameSite=Strict to prevent CSRF
- **Short Expiration**: ID tokens expire in 60 minutes
- **Refresh Tokens**: Use refresh tokens for seamless re-authentication

### Password Policy
- Minimum 12 characters
- Requires uppercase, lowercase, numbers, and symbols
- Account lockout after failed attempts

### API Security
- JWT verification on every request
- Role-based authorization
- IAM-based access control for sensitive endpoints
- Rate limiting (API Gateway throttling)

### Guest Access
- Limited token validity (60 minutes)
- No refresh token
- Restricted permissions
- No persistent data storage

---

## 💰 Cost Estimation

### Additional Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| **Cognito User Pool** | 10,000 MAU | $0 (Free tier: 50,000 MAU) |
| **Cognito Advanced Security** | Optional | $0.05/MAU |
| **Lambda@Edge** | 1M requests | $0.60 |
| **Lambda Triggers** | 10,000 invocations | $0.20 |
| **CloudWatch Logs** | Additional 500MB | $0.25 |
| **Total Additional** | - | **~$1.05/month** |

**Note**: Costs are minimal due to Cognito's generous free tier.

---

## 🚀 Deployment Steps

### Step 1: Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://vkp-auth.auth.eu-north-1.amazoncognito.com/oauth2/idpresponse`
6. Save Client ID and Client Secret

### Step 2: Deploy Cognito Infrastructure

```bash
cd terraform

# Add Cognito module variables
cat >> terraform.tfvars <<EOF
google_client_id     = "YOUR_GOOGLE_CLIENT_ID"
google_client_secret = "YOUR_GOOGLE_CLIENT_SECRET"
EOF

# Plan and apply
terraform plan -out=tfplan
terraform apply tfplan
```

### Step 3: Deploy Lambda Triggers

```bash
cd lambda/cognito-triggers

# Build and package
npm install
npm run build
npm run zip

# Deploy via Terraform
cd ../../terraform
terraform apply -target=module.cognito.aws_lambda_function.pre_signup
terraform apply -target=module.cognito.aws_lambda_function.post_confirmation
terraform apply -target=module.cognito.aws_lambda_function.pre_token_generation
```

### Step 4: Deploy Lambda@Edge

```bash
cd lambda/edge

# Build and package
npm install
npm run build
npm run zip

# Deploy to us-east-1
cd ../../terraform
terraform apply -target=module.cloudfront.aws_lambda_function.viewer_request
```

### Step 5: Update API Lambda

```bash
cd apiv2

# Install new dependencies
npm install jsonwebtoken jwks-rsa

# Build and deploy
npm run build
./buildAndDeploy.sh
```

### Step 6: Deploy Frontend Updates

```bash
# Upload callback page
aws s3 cp site/callback.html s3://vkp-consulting.fr/callback.html

# Upload updated UI files
aws s3 sync site/ s3://vkp-consulting.fr/ --exclude ".DS_Store"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/*"
```

### Step 7: Create Admin User

```bash
# Create admin user via AWS CLI
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@vkp-consulting.fr \
  --user-attributes Name=email,Value=admin@vkp-consulting.fr Name=custom:role,Value=admin \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@vkp-consulting.fr \
  --group-name admin
```

---

## 🧪 Testing Guide

### Test Regular User Login

1. Visit https://vkp-consulting.fr
2. Should redirect to Cognito login
3. Click "Sign up"
4. Enter:
   - Email: test@example.com
   - Name: Test User
   - Password: TestPassword123!
5. Verify email
6. Login with credentials
7. Should redirect to application
8. Try accessing `/apiv2/internal/users` → Should get 403 Forbidden

### Test Google OAuth

1. Visit https://vkp-consulting.fr
2. Click "Continue with Google"
3. Select Google account
4. Should redirect to application
5. Verify user is authenticated

### Test Guest Access

1. Visit https://vkp-consulting.fr
2. Click "Skip login" or "Continue as guest"
3. Should get temporary token
4. Can access public endpoints
5. Cannot access `/apiv2/internal/*`

### Test Admin Access

1. Login as admin user
2. Try accessing `/apiv2/internal/users` → Should succeed
3. Verify full CRUD operations work

---

## 📚 Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Lambda@Edge Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
- [API Gateway JWT Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)

---

**Document Version**: 1.0  
**Last Updated**: November 2, 2025  
**Status**: Ready for Implementation

