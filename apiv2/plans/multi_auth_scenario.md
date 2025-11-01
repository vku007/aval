# Multi-Authentication Scenario Plan

## 🎯 Scenario

User visits API v2 → Redirected to login page with 3 options:
1. **Login with Username/Password** (Cognito User Pool)
2. **Login with Google** (Social Identity Provider)
3. **Continue as Guest** (Anonymous with session token)

All users get a token to distinguish them during the session.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Visits Site                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Login Page Options                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Username   │  │    Google    │  │  Guest Mode  │      │
│  │   Password   │  │    OAuth     │  │   (Skip)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Cognito User   │  │  Google OAuth   │  │ Identity Pool   │
│     Pool        │  │   Federation    │  │ (Unauthenticated)│
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         └────────────────────┴─────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Identity Pool   │
                    │  (Unified Token) │
                    └─────────┬────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   API Gateway    │
                    │  (IAM Auth or    │
                    │  Lambda Auth)    │
                    └─────────┬────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Lambda API v2  │
                    │  (Gets user info)│
                    └──────────────────┘
```

---

## 📋 Implementation Plan

### Phase 1: Setup Cognito with Multiple Auth Methods

**Step 1.1: Create Cognito User Pool with Social Login**

```terraform
# terraform/cognito.tf

# User Pool
resource "aws_cognito_user_pool" "main" {
  name = "vkp-user-pool"
  
  # Simplified password policy
  password_policy {
    minimum_length    = 12
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
  
  # No email verification
  auto_verified_attributes = []
  
  # Username configuration
  username_attributes = ["email"]
  
  # Schema
  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
  
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
}

# Google Identity Provider
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"
  
  provider_details = {
    authorize_scopes = "email profile openid"
    client_id        = var.google_client_id        # From Google Cloud Console
    client_secret    = var.google_client_secret    # From Google Cloud Console
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
  
  # OAuth configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  # Supported identity providers
  supported_identity_providers = [
    "COGNITO",                              # Username/password
    aws_cognito_identity_provider.google.provider_name  # Google
  ]
  
  # Callback URLs
  callback_urls = [
    "https://vkp-consulting.fr/auth/callback",
    "http://localhost:3000/auth/callback"
  ]
  
  logout_urls = [
    "https://vkp-consulting.fr/",
    "http://localhost:3000/"
  ]
  
  # Token validity
  access_token_validity  = 60   # 60 minutes
  id_token_validity      = 60   # 60 minutes
  refresh_token_validity = 30   # 30 days
  
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  
  # Public client (no secret)
  generate_secret = false
  
  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"
}

# Hosted UI Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth-vkp"
  user_pool_id = aws_cognito_user_pool.main.id
}

# User groups
resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users"
  precedence   = 1
}

resource "aws_cognito_user_group" "users" {
  name         = "users"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Regular users"
  precedence   = 10
}
```

**Step 1.2: Create Identity Pool for Unified Authentication**

```terraform
# Identity Pool - handles all auth types including anonymous
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "vkp-identity-pool"
  allow_unauthenticated_identities = true  # Enable guest mode
  allow_classic_flow               = false
  
  # Link to User Pool (handles username/password + Google)
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

# IAM Role for Authenticated Users (logged in via Cognito or Google)
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

# IAM Role for Unauthenticated Users (guest mode)
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

# Attach roles to Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id
  
  roles = {
    authenticated   = aws_iam_role.authenticated.arn
    unauthenticated = aws_iam_role.unauthenticated.arn
  }
}

# Permissions for Authenticated Users (full access)
resource "aws_iam_role_policy" "authenticated" {
  name = "authenticated-policy"
  role = aws_iam_role.authenticated.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "execute-api:Invoke"
      Resource = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
    }]
  })
}

# Permissions for Unauthenticated Users (read-only)
resource "aws_iam_role_policy" "unauthenticated" {
  name = "unauthenticated-policy"
  role = aws_iam_role.unauthenticated.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "execute-api:Invoke"
        Resource = [
          "${aws_apigatewayv2_api.main.execution_arn}/*/GET/apiv2/games*",
          "${aws_apigatewayv2_api.main.execution_arn}/*/GET/apiv2/entities*",
          "${aws_apigatewayv2_api.main.execution_arn}/*/GET/apiv2/health"
        ]
      },
      {
        Effect = "Deny"
        Action = "execute-api:Invoke"
        Resource = [
          "${aws_apigatewayv2_api.main.execution_arn}/*/POST/*",
          "${aws_apigatewayv2_api.main.execution_arn}/*/PUT/*",
          "${aws_apigatewayv2_api.main.execution_arn}/*/DELETE/*",
          "${aws_apigatewayv2_api.main.execution_arn}/*/*/apiv2/users*"
        ]
      }
    ]
  })
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

**Step 1.3: Get Google OAuth Credentials**

```bash
# Steps to get Google OAuth credentials:

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Authorized redirect URIs:
   - https://auth-vkp.auth.eu-north-1.amazoncognito.com/oauth2/idpresponse
   - http://localhost:3000/oauth2/idpresponse (for testing)
7. Copy Client ID and Client Secret
8. Add to terraform.tfvars:
   google_client_id     = "your-client-id.apps.googleusercontent.com"
   google_client_secret = "your-client-secret"
```

---

### Phase 2: Update API Gateway for IAM Authorization

**Step 2.1: Configure API Gateway Routes**

```terraform
# terraform/main.tf

# Update API Gateway to use IAM authorization
# This allows Identity Pool credentials to work

resource "aws_apigatewayv2_route" "games_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "AWS_IAM"  # Use IAM auth for Identity Pool
}

resource "aws_apigatewayv2_route" "games_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /apiv2/games/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "AWS_IAM"
}

resource "aws_apigatewayv2_route" "games_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /apiv2/games"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  
  authorization_type = "AWS_IAM"  # IAM policy will deny unauthenticated
}

# Similar for all other routes...
```

---

### Phase 3: Frontend Implementation

**Step 3.1: Install AWS Amplify**

```bash
cd site
npm init -y
npm install aws-amplify
```

**Step 3.2: Create Amplify Configuration**

```javascript
// site/js/amplify-config.js

export const amplifyConfig = {
  Auth: {
    // User Pool (for username/password and Google)
    region: 'eu-north-1',
    userPoolId: 'eu-north-1_xxxxx',        // From Terraform output
    userPoolWebClientId: 'xxxxx',          // From Terraform output
    
    // Identity Pool (for unified auth + guest)
    identityPoolId: 'eu-north-1:xxxxx',    // From Terraform output
    
    // OAuth configuration (for Google login)
    oauth: {
      domain: 'auth-vkp.auth.eu-north-1.amazoncognito.com',
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: 'https://vkp-consulting.fr/auth/callback',
      redirectSignOut: 'https://vkp-consulting.fr/',
      responseType: 'code'
    }
  },
  API: {
    endpoints: [
      {
        name: 'api',
        endpoint: 'https://vkp-consulting.fr/apiv2',
        region: 'eu-north-1'
      }
    ]
  }
};
```

**Step 3.3: Create Authentication Service**

```javascript
// site/js/auth-service.js

import { Amplify, Auth } from 'aws-amplify';
import { amplifyConfig } from './amplify-config.js';

Amplify.configure(amplifyConfig);

export class AuthService {
  constructor() {
    this.currentUser = null;
    this.userType = null; // 'authenticated', 'guest', or null
  }
  
  /**
   * Initialize auth - check current session
   */
  async init() {
    try {
      // Try to get current authenticated user
      this.currentUser = await Auth.currentAuthenticatedUser();
      this.userType = 'authenticated';
      console.log('User is authenticated:', this.currentUser);
      return {
        type: 'authenticated',
        user: this.currentUser
      };
    } catch (error) {
      // No authenticated user, check for guest credentials
      try {
        const credentials = await Auth.currentCredentials();
        if (credentials.authenticated === false) {
          this.userType = 'guest';
          console.log('User is guest:', credentials.identityId);
          return {
            type: 'guest',
            identityId: credentials.identityId
          };
        }
      } catch (guestError) {
        console.log('No session found');
      }
      
      return {
        type: null,
        user: null
      };
    }
  }
  
  /**
   * Login with username and password
   */
  async loginWithPassword(username, password) {
    try {
      const user = await Auth.signIn(username, password);
      this.currentUser = user;
      this.userType = 'authenticated';
      console.log('Logged in successfully:', user);
      return {
        success: true,
        user: user
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Login with Google (redirects to Google)
   */
  async loginWithGoogle() {
    try {
      await Auth.federatedSignIn({ provider: 'Google' });
      // This will redirect to Google login page
      // After success, user will be redirected back to callback URL
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }
  
  /**
   * Continue as guest (anonymous)
   */
  async continueAsGuest() {
    try {
      // Get guest credentials from Identity Pool
      const credentials = await Auth.currentCredentials();
      this.userType = 'guest';
      console.log('Guest credentials:', credentials.identityId);
      
      // Store guest identity ID for session tracking
      localStorage.setItem('guestIdentityId', credentials.identityId);
      
      return {
        success: true,
        identityId: credentials.identityId,
        type: 'guest'
      };
    } catch (error) {
      console.error('Guest mode error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Sign up new user
   */
  async signUp(username, password, name) {
    try {
      const result = await Auth.signUp({
        username: username,
        password: password,
        attributes: {
          name: name
        }
      });
      console.log('Sign up successful:', result);
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Logout
   */
  async logout() {
    try {
      if (this.userType === 'authenticated') {
        await Auth.signOut();
      } else if (this.userType === 'guest') {
        // Clear guest credentials
        await Auth.clearCachedId();
        localStorage.removeItem('guestIdentityId');
      }
      
      this.currentUser = null;
      this.userType = null;
      console.log('Logged out successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get current user info
   */
  async getUserInfo() {
    if (this.userType === 'authenticated') {
      const user = await Auth.currentAuthenticatedUser();
      const attributes = await Auth.userAttributes(user);
      
      return {
        type: 'authenticated',
        id: user.username,
        name: attributes.find(attr => attr.Name === 'name')?.Value,
        email: attributes.find(attr => attr.Name === 'email')?.Value,
        identityId: (await Auth.currentCredentials()).identityId
      };
    } else if (this.userType === 'guest') {
      const credentials = await Auth.currentCredentials();
      return {
        type: 'guest',
        id: credentials.identityId,
        name: 'Guest User',
        email: null,
        identityId: credentials.identityId
      };
    }
    
    return null;
  }
  
  /**
   * Check if user is authenticated (not guest)
   */
  isAuthenticated() {
    return this.userType === 'authenticated';
  }
  
  /**
   * Check if user is guest
   */
  isGuest() {
    return this.userType === 'guest';
  }
  
  /**
   * Check if user has any session (authenticated or guest)
   */
  hasSession() {
    return this.userType !== null;
  }
  
  /**
   * Upgrade guest to authenticated user
   */
  async upgradeGuestToUser(username, password, name) {
    if (this.userType !== 'guest') {
      throw new Error('Can only upgrade guest users');
    }
    
    // Sign up new user
    const signUpResult = await this.signUp(username, password, name);
    if (!signUpResult.success) {
      return signUpResult;
    }
    
    // Login with new credentials
    const loginResult = await this.loginWithPassword(username, password);
    if (loginResult.success) {
      // Clear old guest identity
      localStorage.removeItem('guestIdentityId');
    }
    
    return loginResult;
  }
}

// Export singleton instance
export const authService = new AuthService();
```

**Step 3.4: Create API Client with AWS Signature**

```javascript
// site/js/api-client.js

import { API, Auth } from 'aws-amplify';
import { authService } from './auth-service.js';

export class APIClient {
  constructor() {
    this.baseURL = 'https://vkp-consulting.fr/apiv2';
  }
  
  /**
   * Make authenticated API request
   * Works for both authenticated users and guests
   */
  async request(method, path, data = null) {
    try {
      // Ensure we have credentials (authenticated or guest)
      const credentials = await Auth.currentCredentials();
      
      // Use Amplify API to automatically sign requests
      const apiName = 'api';
      const apiPath = path;
      const init = {
        headers: {},
        body: data
      };
      
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await API.get(apiName, apiPath, init);
          break;
        case 'POST':
          response = await API.post(apiName, apiPath, init);
          break;
        case 'PUT':
          response = await API.put(apiName, apiPath, init);
          break;
        case 'DELETE':
          response = await API.del(apiName, apiPath, init);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
      
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('API request error:', error);
      
      // If 403 and user is guest, prompt to login
      if (error.response?.status === 403 && authService.isGuest()) {
        return {
          success: false,
          error: 'This action requires login',
          requiresAuth: true
        };
      }
      
      return {
        success: false,
        error: error.message || 'Request failed'
      };
    }
  }
  
  // Convenience methods
  async getGames() {
    return this.request('GET', '/games');
  }
  
  async getGame(id) {
    return this.request('GET', `/games/${id}`);
  }
  
  async createGame(data) {
    return this.request('POST', '/games', data);
  }
  
  async updateGame(id, data) {
    return this.request('PUT', `/games/${id}`, data);
  }
  
  async deleteGame(id) {
    return this.request('DELETE', `/games/${id}`);
  }
  
  async getUsers() {
    return this.request('GET', '/users');
  }
  
  async getUser(id) {
    return this.request('GET', `/users/${id}`);
  }
  
  async updateUser(id, data) {
    return this.request('PUT', `/users/${id}`, data);
  }
}

// Export singleton instance
export const apiClient = new APIClient();
```

**Step 3.5: Create Login Page**

```html
<!-- site/login.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - VKP Consulting</title>
  <link rel="stylesheet" href="/css/login.css">
</head>
<body>
  <div class="login-container">
    <div class="login-box">
      <h1>Welcome to VKP Consulting</h1>
      <p class="subtitle">Choose how you want to continue</p>
      
      <!-- Option 1: Username/Password -->
      <div class="auth-section">
        <h2>Login with Account</h2>
        <form id="login-form">
          <input type="email" id="username" placeholder="Email" required>
          <input type="password" id="password" placeholder="Password (min 12 chars)" required minlength="12">
          <button type="submit" class="btn btn-primary">Login</button>
        </form>
        <p class="form-footer">
          Don't have an account? <a href="#" id="show-signup">Sign up</a>
        </p>
      </div>
      
      <div class="divider">
        <span>OR</span>
      </div>
      
      <!-- Option 2: Google Login -->
      <div class="auth-section">
        <button id="google-login" class="btn btn-google">
          <img src="/images/google-icon.svg" alt="Google">
          Continue with Google
        </button>
      </div>
      
      <div class="divider">
        <span>OR</span>
      </div>
      
      <!-- Option 3: Guest Mode -->
      <div class="auth-section">
        <button id="guest-login" class="btn btn-guest">
          Continue as Guest
        </button>
        <p class="guest-info">
          Browse content without creating an account. Limited features available.
        </p>
      </div>
      
      <div id="error-message" class="error-message" style="display: none;"></div>
      <div id="loading" class="loading" style="display: none;">Loading...</div>
    </div>
    
    <!-- Sign Up Form (hidden by default) -->
    <div class="login-box" id="signup-box" style="display: none;">
      <h1>Create Account</h1>
      <form id="signup-form">
        <input type="text" id="signup-name" placeholder="Full Name" required>
        <input type="email" id="signup-username" placeholder="Email" required>
        <input type="password" id="signup-password" placeholder="Password (min 12 chars)" required minlength="12">
        <button type="submit" class="btn btn-primary">Sign Up</button>
      </form>
      <p class="form-footer">
        Already have an account? <a href="#" id="show-login">Login</a>
      </p>
    </div>
  </div>
  
  <script type="module" src="/js/login.js"></script>
</body>
</html>
```

**Step 3.6: Create Login JavaScript**

```javascript
// site/js/login.js

import { authService } from './auth-service.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  const session = await authService.init();
  if (session.type) {
    // Already has session, redirect to home
    window.location.href = '/';
    return;
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  // Username/Password Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handlePasswordLogin();
  });
  
  // Google Login
  document.getElementById('google-login').addEventListener('click', async () => {
    await handleGoogleLogin();
  });
  
  // Guest Login
  document.getElementById('guest-login').addEventListener('click', async () => {
    await handleGuestLogin();
  });
  
  // Show/Hide Sign Up
  document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.login-box:first-child').style.display = 'none';
    document.getElementById('signup-box').style.display = 'block';
  });
  
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-box').style.display = 'none';
    document.querySelector('.login-box:first-child').style.display = 'block';
  });
  
  // Sign Up
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSignUp();
  });
}

async function handlePasswordLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  showLoading(true);
  hideError();
  
  const result = await authService.loginWithPassword(username, password);
  
  showLoading(false);
  
  if (result.success) {
    // Redirect to home or original destination
    const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/';
    window.location.href = redirectTo;
  } else {
    showError(result.error);
  }
}

async function handleGoogleLogin() {
  showLoading(true);
  hideError();
  
  try {
    await authService.loginWithGoogle();
    // Will redirect to Google, then back to callback URL
  } catch (error) {
    showLoading(false);
    showError('Google login failed: ' + error.message);
  }
}

async function handleGuestLogin() {
  showLoading(true);
  hideError();
  
  const result = await authService.continueAsGuest();
  
  showLoading(false);
  
  if (result.success) {
    console.log('Guest session created:', result.identityId);
    // Redirect to home
    const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/';
    window.location.href = redirectTo;
  } else {
    showError('Failed to start guest session: ' + result.error);
  }
}

async function handleSignUp() {
  const name = document.getElementById('signup-name').value;
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;
  
  showLoading(true);
  hideError();
  
  const result = await authService.signUp(username, password, name);
  
  if (result.success) {
    // Auto-login after signup
    const loginResult = await authService.loginWithPassword(username, password);
    showLoading(false);
    
    if (loginResult.success) {
      window.location.href = '/';
    } else {
      showError('Account created! Please login.');
      document.getElementById('signup-box').style.display = 'none';
      document.querySelector('.login-box:first-child').style.display = 'block';
    }
  } else {
    showLoading(false);
    showError(result.error);
  }
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideError() {
  document.getElementById('error-message').style.display = 'none';
}
```

**Step 3.7: Create User Banner Component**

```javascript
// site/js/components/user-banner.js

import { authService } from '../auth-service.js';

export class UserBanner {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  async render() {
    const userInfo = await authService.getUserInfo();
    
    if (!userInfo) {
      // No session, show login button
      this.container.innerHTML = `
        <div class="user-banner">
          <div class="banner-content">
            <span>Welcome to VKP Consulting</span>
            <a href="/login.html" class="btn btn-login">Login</a>
          </div>
        </div>
      `;
      return;
    }
    
    if (userInfo.type === 'guest') {
      // Guest user
      this.container.innerHTML = `
        <div class="user-banner guest">
          <div class="banner-content">
            <div class="user-info">
              <span class="user-badge guest-badge">👤 Guest</span>
              <span class="user-id">ID: ${userInfo.identityId.substring(0, 8)}...</span>
            </div>
            <div class="banner-actions">
              <button id="upgrade-account" class="btn btn-small btn-primary">Create Account</button>
              <button id="logout-btn" class="btn btn-small btn-secondary">Exit</button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Authenticated user
      this.container.innerHTML = `
        <div class="user-banner authenticated">
          <div class="banner-content">
            <div class="user-info">
              <span class="user-badge auth-badge">✓ ${userInfo.name}</span>
              <span class="user-email">${userInfo.email || ''}</span>
              <span class="user-id">ID: ${userInfo.identityId.substring(0, 8)}...</span>
            </div>
            <div class="banner-actions">
              <button id="logout-btn" class="btn btn-small btn-secondary">Logout</button>
            </div>
          </div>
        </div>
      `;
    }
    
    // Attach event listeners
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await authService.logout();
        window.location.href = '/login.html';
      });
    }
    
    const upgradeBtn = document.getElementById('upgrade-account');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        window.location.href = '/signup.html?upgrade=true';
      });
    }
  }
}
```

**Step 3.8: Create Auth Check Script**

```javascript
// site/js/auth-check.js

import { authService } from './auth-service.js';
import { UserBanner } from './components/user-banner.js';

export async function init() {
  // Handle OAuth callback
  if (window.location.pathname === '/auth/callback') {
    await handleCallback();
    return;
  }
  
  // Initialize auth session
  const session = await authService.init();
  
  // Render user banner
  const banner = new UserBanner('user-banner');
  await banner.render();
  
  // Check if page requires authentication
  const requiresAuth = document.body.dataset.requiresAuth === 'true';
  
  if (requiresAuth && !authService.hasSession()) {
    // Redirect to login
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
  }
}

async function handleCallback() {
  // Show loading
  document.body.innerHTML = '<div class="loading-screen">Authenticating...</div>';
  
  try {
    // Amplify will automatically handle the OAuth callback
    await authService.init();
    
    // Redirect to home or original destination
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get('redirect') || '/';
    window.location.href = redirectTo;
  } catch (error) {
    console.error('Callback error:', error);
    document.body.innerHTML = `
      <div class="error-screen">
        <h1>Authentication Error</h1>
        <p>${error.message}</p>
        <a href="/login.html">Try again</a>
      </div>
    `;
  }
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

### Phase 4: Update Lambda to Handle Identity Pool Context

**Step 4.1: Update Lambda Handler**

```typescript
// apiv2/src/index.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { router } from './presentation/routing/Router.js';

export interface AuthUser {
  id: string;           // Cognito Identity ID (works for all auth types)
  type: 'authenticated' | 'guest';
  username?: string;    // Only for authenticated users
  email?: string;       // Only for authenticated users
  name?: string;        // Only for authenticated users
  cognitoUserId?: string; // Cognito User Pool sub (only for authenticated)
}

export interface AuthenticatedRequest extends APIGatewayProxyEventV2 {
  user?: AuthUser;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Extract user from IAM context (Identity Pool)
  let user: AuthUser | undefined;
  
  const requestContext = event.requestContext;
  const identity = requestContext.identity;
  
  // Check if request is authenticated via IAM (Identity Pool)
  if (identity?.cognitoIdentityId) {
    const identityId = identity.cognitoIdentityId;
    const cognitoAuthType = identity.cognitoAuthenticationType;
    
    if (cognitoAuthType === 'authenticated') {
      // Authenticated user (via User Pool or Google)
      // Get user details from Identity Pool
      const cognitoUserId = identity.cognitoIdentityPoolId; // User Pool sub
      
      user = {
        id: identityId,
        type: 'authenticated',
        cognitoUserId: cognitoUserId,
        // Additional details would come from User Pool if needed
      };
      
      console.log('Authenticated user:', user);
    } else if (cognitoAuthType === 'unauthenticated') {
      // Guest user
      user = {
        id: identityId,
        type: 'guest'
      };
      
      console.log('Guest user:', user);
    }
  }
  
  // Add user to request
  const authenticatedRequest: AuthenticatedRequest = {
    ...event,
    user
  };
  
  // Route request
  return router.handle(authenticatedRequest);
}
```

**Step 4.2: Update Request Type**

```typescript
// apiv2/src/types.ts

export interface AuthUser {
  id: string;
  type: 'authenticated' | 'guest';
  username?: string;
  email?: string;
  name?: string;
  cognitoUserId?: string;
}

export interface Request {
  // ... existing properties
  user?: AuthUser;
}
```

**Step 4.3: Create Authorization Middleware**

```typescript
// apiv2/src/presentation/middleware/authorization.ts

import { Request } from '../../types.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';

/**
 * Require any session (authenticated or guest)
 */
export function requireSession(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user) {
      throw new UnauthorizedError('Session required');
    }
    return handler(req);
  };
}

/**
 * Require authenticated user (not guest)
 */
export function requireAuth(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (req.user.type === 'guest') {
      throw new ForbiddenError('This action requires a registered account');
    }
    return handler(req);
  };
}

/**
 * Require admin role
 */
export function requireAdmin(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    if (!req.user || req.user.type === 'guest') {
      throw new UnauthorizedError('Authentication required');
    }
    // Check admin status (would need to query User Pool or check groups)
    // For now, simplified check
    throw new ForbiddenError('Admin access required');
  };
}

/**
 * Allow guest with limited access
 */
export function allowGuest(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    // Allow both authenticated and guest users
    return handler(req);
  };
}
```

---

## 📊 User Flow Diagram

```
User visits site
       │
       ▼
┌──────────────┐
│ Login Page   │
└──────┬───────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Username/   │   │   Google    │   │   Guest     │
│ Password    │   │   OAuth     │   │   Mode      │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
                ▼                 ▼
         ┌─────────────┐   ┌─────────────┐
         │ User Pool   │   │ Identity    │
         │ (Auth)      │   │ Pool (Guest)│
         └──────┬──────┘   └──────┬──────┘
                │                 │
                └────────┬────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ Identity    │
                  │ Pool Token  │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ API Gateway │
                  │ (IAM Auth)  │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ Lambda API  │
                  │ (Gets user  │
                  │  context)   │
                  └─────────────┘
```

---

## 🎯 Key Features

1. **Three Login Methods**:
   - ✅ Username/Password (Cognito User Pool)
   - ✅ Google OAuth (Federated Identity)
   - ✅ Guest Mode (Anonymous Identity Pool)

2. **Unified Token System**:
   - All users get Identity Pool credentials
   - Single authentication flow in API
   - Consistent user identification

3. **Session Tracking**:
   - Authenticated users: Cognito User Pool ID + Identity ID
   - Guest users: Identity Pool ID only
   - Can distinguish user type in Lambda

4. **Upgrade Path**:
   - Guests can upgrade to full accounts
   - Seamless transition
   - Keep session continuity

5. **Permissions**:
   - Guests: Read-only access
   - Authenticated: Full access
   - Enforced at IAM and Lambda level

---

## 💰 Cost Estimate

- **Cognito User Pool**: Free (up to 50K MAU)
- **Cognito Identity Pool**: Free (up to 50K MAU)
- **Google OAuth**: Free
- **API Gateway IAM Auth**: No additional cost
- **Total**: ~$0/month for typical usage

---

## 🚀 Deployment Checklist

- [ ] Set up Google OAuth credentials
- [ ] Deploy Cognito User Pool with Google provider
- [ ] Deploy Identity Pool with unauthenticated access
- [ ] Configure IAM roles and policies
- [ ] Update API Gateway to use IAM authorization
- [ ] Deploy frontend with Amplify
- [ ] Test all three login methods
- [ ] Test guest upgrade flow
- [ ] Verify permissions (guest vs authenticated)
- [ ] Test session persistence

---

**This gives you exactly what you want: 3 login options, all with tokens, and ability to distinguish users during the session!** 🎉

