# Implementation Plan: AWS Cognito Authentication for API v2

## 🎯 Objective

Add AWS Cognito authentication to the existing VKP Consulting infrastructure with:
1. AWS Cognito User Pool for authentication (simplified requirements: 12-char password, name only)
2. **Selective authentication**: Public routes for browsing, authentication required for modifications
3. Display Cognito user ID on all UI screens when logged in (top banner)
4. **Optional**: Support for anonymous/guest users via Identity Pools

---

## 📋 Task Breakdown for AI Agent

### Phase 1: AWS Cognito Infrastructure Setup

**Task 1.1: Create Cognito User Pool with Terraform**

```markdown
Create a new Terraform configuration file `terraform/cognito.tf` with:

1. AWS Cognito User Pool with:
   - Name: "vkp-user-pool"
   - Password policy: minimum 12 characters only (no complexity requirements)
   - MFA: Optional (disabled by default)
   - Email verification: DISABLED (no verification required)
   - Auto-verified attributes: none
   - Schema attributes: name (required only)
   
2. Cognito User Pool Client:
   - Name: "vkp-web-client"
   - OAuth flows: code, implicit
   - OAuth scopes: email, openid, profile
   - Callback URLs: 
     - https://vkp-consulting.fr/auth/callback
     - http://localhost:3000/auth/callback (for testing)
   - Logout URLs:
     - https://vkp-consulting.fr/
     - http://localhost:3000/
   - Token validity: 
     - Access token: 60 minutes
     - ID token: 60 minutes
     - Refresh token: 30 days
   - Generate secret: false (public client)

3. Cognito User Pool Domain:
   - Domain prefix: "auth-vkp"
   - This creates hosted UI at: https://auth-vkp.auth.eu-north-1.amazoncognito.com

4. Cognito User Groups:
   - "admins" group (precedence: 1)
   - "users" group (precedence: 10)

5. Output values:
   - User Pool ID
   - User Pool ARN
   - Client ID
   - Hosted UI URL

Apply the Terraform configuration and save the output values.
```

**Task 1.2: Create Lambda Authorizer**

```markdown
Create a new Lambda function for JWT token validation:

1. Create directory: `lambda-authorizer/`

2. Create `lambda-authorizer/package.json`:
   - Dependencies: aws-jwt-verify
   - Scripts: build, test, zip
   - Runtime: Node.js 20

3. Create `lambda-authorizer/tsconfig.json`:
   - Target: ES2022
   - Module: ESNext
   - Output to dist/

4. Create `lambda-authorizer/src/index.ts`:
   - Import CognitoJwtVerifier from aws-jwt-verify
   - Verify JWT access token
   - Extract user information: sub, cognito:username, email, cognito:groups
   - Return IAM policy with Allow effect
   - Include context: userId, username, email, groups, isAdmin
   - Handle errors by returning Deny policy
   - Log all authorization attempts

5. Create Terraform module `terraform/modules/lambda-authorizer/`:
   - Lambda function resource
   - IAM role for Lambda execution
   - CloudWatch Logs permissions
   - Environment variables: USER_POOL_ID, CLIENT_ID
   - Memory: 256 MB
   - Timeout: 10 seconds

6. Add Lambda authorizer to `terraform/main.tf`:
   - Create module instance
   - Pass Cognito User Pool ID and Client ID
   - Output Lambda ARN

Apply Terraform changes.
```

**Task 1.3: Configure API Gateway Authorizer**

```markdown
Update API Gateway configuration to use Lambda authorizer:

1. In `terraform/main.tf`, add:
   - aws_apigatewayv2_authorizer resource
   - Type: REQUEST
   - Authorizer URI: Lambda authorizer invoke ARN
   - Identity sources: $request.header.Authorization
   - Name: "cognito-authorizer"
   - Result TTL: 300 seconds (5 minutes cache)

2. Add Lambda permission:
   - Allow API Gateway to invoke authorizer Lambda
   - Principal: apigateway.amazonaws.com
   - Source ARN: API Gateway execution ARN

3. Update ALL API v2 routes to use authorizer:
   - Find all aws_apigatewayv2_route resources with route_key starting with "ANY /apiv2/"
   - Add: authorization_type = "CUSTOM"
   - Add: authorizer_id = aws_apigatewayv2_authorizer.cognito.id
   
4. Keep health check route public (no auth):
   - Route: "GET /apiv2/health"
   - authorization_type = "NONE"

Apply Terraform changes.
```

**Task 1.4: (OPTIONAL) Add Anonymous User Support with Identity Pools**

```markdown
If you want to support anonymous/guest users who can use the app without registration:

1. Create Cognito Identity Pool in `terraform/cognito.tf`:
   - Name: "vkp-identity-pool"
   - Allow unauthenticated identities: true
   - Authentication providers: link to User Pool from Task 1.1
   - IAM roles:
     - Authenticated role: full API access
     - Unauthenticated role: limited API access (read-only)

2. Configure unauthenticated role permissions:
   - Allow: execute-api:Invoke for GET /apiv2/games/*
   - Allow: execute-api:Invoke for GET /apiv2/entities/*
   - Deny: all POST, PUT, DELETE operations
   - Deny: /apiv2/users/* endpoints

3. Update API Gateway authorizer:
   - Add IAM authorization type for anonymous access
   - Keep Lambda authorizer for authenticated users
   - Configure per-route authorization:
     - Public routes (no auth): health check
     - Anonymous routes (IAM auth): GET games, entities
     - Authenticated routes (Lambda auth): POST/PUT/DELETE, user management

4. Frontend changes:
   - Use AWS Amplify SDK to get guest credentials
   - Sign requests with AWS Signature V4 for anonymous users
   - Upgrade to authenticated user when they sign up/login

Note: This is OPTIONAL. You can skip this task if you only want authenticated users.
For simpler anonymous access, consider making certain routes public (no auth required).
```

**Task 1.5: Configure Public vs Protected Routes**

```markdown
Decide which routes need authentication:

RECOMMENDED APPROACH (Selective Authentication):

Public routes (no authentication required):
- GET /apiv2/health
- GET /apiv2/games (list all games)
- GET /apiv2/games/{id} (view game details)
- GET /apiv2/entities (list entities)
- GET /apiv2/entities/{id} (view entity details)

Protected routes (authentication required):
- POST /apiv2/games (create game)
- PUT /apiv2/games/{id} (update game)
- DELETE /apiv2/games/{id} (delete game)
- ALL /apiv2/users/* (user management)
- POST /apiv2/entities (create entity)
- PUT /apiv2/entities/{id} (update entity)
- DELETE /apiv2/entities/{id} (delete entity)

Implementation in Terraform:
1. For public routes: authorization_type = "NONE"
2. For protected routes: authorization_type = "CUSTOM", authorizer_id = cognito_authorizer

This allows visitors to browse content without login, but requires authentication for modifications.
```

---

### Phase 2: Update API v2 Lambda Function

**Task 2.1: Update Lambda Handler to Extract Auth Context**

```markdown
Update `apiv2/src/index.ts`:

1. Add AuthUser interface:
   - id: string (Cognito sub)
   - username: string
   - email?: string
   - groups: string[]
   - isAdmin: boolean

2. Update handler function:
   - Extract authContext from event.requestContext.authorizer?.lambda
   - If authContext exists, create AuthUser object:
     - id: authContext.userId
     - username: authContext.username
     - email: authContext.email
     - groups: split authContext.groups by comma
     - isAdmin: authContext.isAdmin === 'true'
   - Add user property to request object
   - Pass authenticated request to router

3. Update Request type in `apiv2/src/types.ts`:
   - Add optional user property of type AuthUser

4. Log authenticated requests:
   - Log userId, username, method, path for all authenticated requests
```

**Task 2.2: Create Authorization Middleware**

```markdown
Create `apiv2/src/presentation/middleware/authorization.ts`:

1. Import Request type and error classes

2. Create requireAuth function:
   - Check if req.user exists
   - If not, throw UnauthorizedError('Authentication required')
   - If yes, call handler

3. Create requireAdmin function:
   - Check if req.user exists and req.user.isAdmin is true
   - If not, throw ForbiddenError('Admin access required')
   - If yes, call handler

4. Create requireOwnershipOrAdmin function:
   - Takes resourceUserId parameter
   - Returns middleware function
   - Check if req.user.id === resourceUserId OR req.user.isAdmin
   - If not, throw ForbiddenError('You can only access your own resources')
   - If yes, call handler

5. Export all middleware functions
```

**Task 2.3: Add Unauthorized and Forbidden Error Classes**

```markdown
If not already exist, create error classes:

1. In `apiv2/src/shared/errors/`:
   - Create UnauthorizedError.ts (extends base error, statusCode: 401)
   - Create ForbiddenError.ts (extends base error, statusCode: 403)

2. Export from `apiv2/src/shared/errors/index.ts`

3. Update error handler in router to handle these errors
```

**Task 2.4: Build and Deploy Updated Lambda**

```markdown
Build and deploy API v2:

1. Run tests: `cd apiv2 && npm test`
2. Build: `npm run build`
3. Create deployment package: `npm run zip`
4. Deploy via Terraform: `cd ../terraform && terraform apply -target=module.lambda_api2`

Verify deployment by checking Lambda function version.
```

---

### Phase 3: Frontend Integration

**Task 3.1: Create Authentication Service**

```markdown
Create `site/js/auth-service.js`:

1. Configure Cognito:
   - UserPoolId: (from Terraform output)
   - ClientId: (from Terraform output)
   - Domain: https://auth-vkp.auth.eu-north-1.amazoncognito.com

2. Implement functions:
   - login(): Redirect to Cognito hosted UI
   - handleCallback(): Parse tokens from URL after redirect
   - logout(): Clear tokens and redirect to logout URL
   - getAccessToken(): Get token from localStorage
   - getIdToken(): Get ID token from localStorage
   - getUserInfo(): Decode ID token and extract user info (sub, email, name)
   - isAuthenticated(): Check if valid token exists
   - refreshToken(): Get new tokens using refresh token

3. Token storage:
   - Store in localStorage: accessToken, idToken, refreshToken
   - Store token expiration time

4. Automatic token refresh:
   - Check token expiration before API calls
   - Refresh if expired
   - Logout if refresh fails
```

**Task 3.2: Create API Client with Authentication**

```markdown
Create `site/js/api-client.js`:

1. Import auth-service

2. Create APIClient class:
   - baseURL: https://vkp-consulting.fr/apiv2

3. Implement request method:
   - Get access token from auth-service
   - Add Authorization header: `Bearer ${token}`
   - Make fetch request
   - Handle 401 response:
     - Try to refresh token
     - Retry request with new token
     - If refresh fails, redirect to login
   - Handle other errors appropriately

4. Implement API methods:
   - getGames()
   - createGame(data)
   - getUsers()
   - getUser(id)
   - updateUser(id, data)
   - etc.

5. Export singleton instance
```

**Task 3.3: Create User Info Banner Component**

```markdown
Create `site/js/components/user-banner.js`:

1. Create UserBanner class:
   - Constructor: takes container element ID
   - render(): Display user info banner

2. Banner should display:
   - User ID (Cognito sub)
   - Username
   - Email
   - Logout button

3. Styling:
   - Fixed position at top of page
   - Background: light gray
   - Padding: 10px
   - Display flex with space-between
   - Font size: 14px
   - Z-index: 1000

4. Logout button:
   - Call auth-service.logout()
   - Redirect to home page

5. Create CSS file: `site/css/user-banner.css`
```

**Task 3.4: Create Authentication Check Script**

```markdown
Create `site/js/auth-check.js`:

1. Import auth-service and user-banner

2. On page load:
   - Check if on callback page (/auth/callback)
   - If yes, call handleCallback()
   - Extract tokens from URL
   - Store tokens
   - Redirect to home page

3. For all other pages:
   - Check if authenticated
   - If authenticated:
     - Initialize user banner
     - Display user info at top of page
   - If NOT authenticated:
     - Show "Login" button in header
     - Allow browsing public content
     - Redirect to login only when accessing protected features

4. Handle protected actions:
   - When user tries to create/edit/delete
   - Check if authenticated
   - If not, show modal: "Please login to perform this action"
   - Redirect to Cognito login
   - After login, redirect back to original page

5. Export init function
```

**Task 3.5: Update All HTML Pages**

```markdown
Update ALL HTML pages in `site/` directory:

1. Add to <head> section:
   - <link rel="stylesheet" href="/css/user-banner.css">

2. Add to <body> at the very top:
   - <div id="user-banner"></div>

3. Add before closing </body>:
   - <script type="module" src="/js/auth-check.js"></script>
   - <script type="module">
       import { init } from '/js/auth-check.js';
       init();
     </script>

4. Update existing API calls:
   - Replace direct fetch with api-client methods
   - Remove manual token handling (api-client handles it)

Pages to update:
- site/index.html
- site/games/index.html
- site/users/index.html
- site/entities/index.html
- Any other HTML pages
```

**Task 3.6: Create Auth Callback Page**

```markdown
Create `site/auth/callback.html`:

1. Simple HTML page with:
   - Title: "Authenticating..."
   - Loading spinner
   - Message: "Please wait while we log you in..."

2. Include auth-check.js script:
   - Will automatically handle callback
   - Extract tokens
   - Redirect to home page

3. No user banner on this page (not yet authenticated)
```

---

### Phase 4: Configuration and Deployment

**Task 4.1: Create Configuration File**

```markdown
Create `site/js/config.js`:

1. Export configuration object:
   - cognitoUserPoolId: (from Terraform output)
   - cognitoClientId: (from Terraform output)
   - cognitoDomain: https://auth-vkp.auth.eu-north-1.amazoncognito.com
   - redirectUri: https://vkp-consulting.fr/auth/callback
   - logoutUri: https://vkp-consulting.fr/
   - apiBaseUrl: https://vkp-consulting.fr/apiv2

2. For local development, also export:
   - redirectUriLocal: http://localhost:3000/auth/callback
   - logoutUriLocal: http://localhost:3000/

3. Add logic to detect environment:
   - If hostname is localhost, use local URIs
   - Otherwise use production URIs
```

**Task 4.2: Update CloudFront Cache Behavior**

```markdown
Update CloudFront configuration for auth callback:

1. In `terraform/modules/cloudfront/main.tf`:
   - Add ordered_cache_behavior for /auth/* path
   - Forward query strings (contains tokens)
   - Do not cache (TTL = 0)
   - Forward Authorization header

2. Apply Terraform changes
```

**Task 4.3: Deploy Frontend**

```markdown
Deploy updated frontend to S3:

1. Sync files to S3:
   ```bash
   cd site
   aws s3 sync . s3://vkp-consulting.fr/ --delete
   ```

2. Invalidate CloudFront cache:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EJWBLACWDMFAZ \
     --paths "/*"
   ```

3. Verify deployment:
   - Check files are uploaded
   - Check CloudFront invalidation status
```

---

### Phase 5: Testing and Verification

**Task 5.1: Create Test User**

```markdown
Create a test user in Cognito:

1. Using AWS CLI:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <USER_POOL_ID> \
     --username test@example.com \
     --user-attributes Name=email,Value=test@example.com Name=name,Value="Test User" \
     --temporary-password "TempPass123!" \
     --message-action SUPPRESS
   ```

2. Set permanent password:
   ```bash
   aws cognito-idp admin-set-user-password \
     --user-pool-id <USER_POOL_ID> \
     --username test@example.com \
     --password "TestPass123!" \
     --permanent
   ```

3. Add user to "users" group:
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <USER_POOL_ID> \
     --username test@example.com \
     --group-name users
   ```
```

**Task 5.2: Test Authentication Flow**

```markdown
Test the complete authentication flow:

1. Open browser and navigate to: https://vkp-consulting.fr/

2. Verify redirect to Cognito login:
   - Should redirect to: https://auth-vkp.auth.eu-north-1.amazoncognito.com/login?...
   - Login page should display

3. Login with test user:
   - Email: test@example.com
   - Password: TestPass123!

4. Verify redirect back to site:
   - Should redirect to: https://vkp-consulting.fr/auth/callback?code=...
   - Should then redirect to: https://vkp-consulting.fr/

5. Verify user banner displays:
   - User ID (Cognito sub) should be visible at top
   - Username should display
   - Email should display
   - Logout button should be present

6. Test API calls:
   - Navigate to games page
   - Verify games load (API call with auth token)
   - Check browser DevTools Network tab:
     - API requests should include Authorization header
     - Should receive 200 responses

7. Test logout:
   - Click logout button
   - Should redirect to Cognito logout
   - Should redirect back to home page
   - Should redirect to login again (not authenticated)

8. Test unauthenticated access:
   - Open incognito/private window
   - Navigate to: https://vkp-consulting.fr/games/
   - Should immediately redirect to login
```

**Task 5.3: Test Error Scenarios**

```markdown
Test error handling:

1. Test expired token:
   - Login and wait for token to expire (or manually expire in localStorage)
   - Make API call
   - Should automatically refresh token
   - API call should succeed

2. Test invalid token:
   - Login successfully
   - Manually modify token in localStorage
   - Make API call
   - Should redirect to login

3. Test 403 Forbidden:
   - Try to access admin-only endpoint as regular user
   - Should receive 403 error
   - Should display appropriate error message

4. Test network errors:
   - Disconnect network
   - Try to make API call
   - Should display error message
   - Should not crash application
```

**Task 5.4: Create Test Script**

```markdown
Create `test-auth-flow.sh` script:

```bash
#!/bin/bash
set -e

echo "🧪 Testing Authentication Flow"

# Get Cognito configuration
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
CLIENT_ID=$(terraform output -raw cognito_client_id)
DOMAIN="https://auth-vkp.auth.eu-north-1.amazoncognito.com"

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"

# Test 1: Unauthenticated API call should fail
echo "1. Testing unauthenticated API call..."
RESPONSE=$(curl -s -w "\n%{http_code}" https://vkp-consulting.fr/apiv2/games)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Unauthenticated call correctly rejected"
else
  echo "❌ Expected 401, got $HTTP_CODE"
  exit 1
fi

# Test 2: Get token and make authenticated call
echo "2. Getting authentication token..."
# Note: This requires manual login via browser
# Automated testing would need Selenium or Puppeteer

echo "3. Testing authenticated API call..."
# Assuming token is in TOKEN variable
if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    https://vkp-consulting.fr/apiv2/games)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Authenticated call succeeded"
  else
    echo "❌ Expected 200, got $HTTP_CODE"
    exit 1
  fi
else
  echo "⚠️  Skipping authenticated test (no token)"
fi

echo "🎉 Basic tests passed!"
```

Make script executable and run it.
```

---

### Phase 6: Documentation

**Task 6.1: Update Documentation**

```markdown
Update the following documentation files:

1. Update `README.md`:
   - Add Authentication section
   - Document login process
   - Document user management
   - Add troubleshooting section

2. Update `INFRASTRUCTURE_OVERVIEW.md`:
   - Add Cognito User Pool to resources
   - Add Lambda Authorizer to resources
   - Update architecture diagram
   - Update request flow to include authentication

3. Create `AUTH_USER_GUIDE.md`:
   - How to login
   - How to logout
   - How to reset password
   - How to enable MFA
   - FAQ section

4. Update `apiv2/COMPLETE_API_DOCUMENTATION.md`:
   - Add authentication requirements to all endpoints
   - Document Authorization header format
   - Document error responses (401, 403)
   - Add authentication examples
```

**Task 6.2: Create Quick Reference**

```markdown
Create `AUTH_QUICK_REFERENCE.md`:

```markdown
# Authentication Quick Reference

## Login
Navigate to any page → Automatically redirected to login

## Logout
Click "Logout" button in top banner

## User Info
Displayed at top of every page:
- User ID (Cognito sub)
- Username
- Email

## API Calls
All API calls automatically include authentication token.
No manual token handling required.

## Troubleshooting

### "Unauthorized" error
- Token expired → Refresh page
- Invalid token → Logout and login again

### Redirect loop
- Clear browser cache and cookies
- Check Cognito callback URL configuration

### User banner not showing
- Check browser console for errors
- Verify auth-check.js is loaded
- Check localStorage for tokens
```
```

---

## 📊 Success Criteria Checklist

```markdown
- [ ] Cognito User Pool created and configured
- [ ] Lambda Authorizer deployed and working
- [ ] API Gateway routes protected with authorizer
- [ ] All API v2 calls require authentication
- [ ] Unauthenticated users redirected to Cognito login
- [ ] User banner displays on all pages
- [ ] User ID (Cognito sub) visible in banner
- [ ] Username visible in banner
- [ ] Email visible in banner
- [ ] Logout button works
- [ ] Token refresh works automatically
- [ ] Test user can login successfully
- [ ] Test user can access protected resources
- [ ] Unauthenticated access blocked
- [ ] Documentation updated
- [ ] Tests passing
```

---

## 🚀 Deployment Order

Execute tasks in this order:

1. **Phase 1** (Infrastructure): Tasks 1.1 → 1.2 → 1.3
2. **Phase 2** (Backend): Tasks 2.1 → 2.2 → 2.3 → 2.4
3. **Phase 3** (Frontend): Tasks 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
4. **Phase 4** (Deploy): Tasks 4.1 → 4.2 → 4.3
5. **Phase 5** (Test): Tasks 5.1 → 5.2 → 5.3 → 5.4
6. **Phase 6** (Docs): Tasks 6.1 → 6.2

---

## ⚠️ Important Notes

1. **Terraform State**: Always run `terraform plan` before `terraform apply`
2. **Token Storage**: Tokens are stored in localStorage (not secure for sensitive apps, but OK for this use case)
3. **HTTPS Only**: Authentication only works over HTTPS (already configured)
4. **CORS**: Cognito domain must be in CORS allowed origins
5. **Cache**: CloudFront cache must not cache auth callback URLs
6. **Testing**: Test in incognito window to verify fresh authentication flow

---

## 💰 Cost Impact

- **Cognito User Pool**: $0 (free tier up to 50K MAU)
- **Lambda Authorizer**: ~$0.20/month (100K invocations)
- **Total Additional Cost**: ~$0.20/month

---

**Plan Version**: 1.0  
**Created**: November 1, 2025  
**Estimated Time**: 4-6 hours for complete implementation  
**Complexity**: Medium

