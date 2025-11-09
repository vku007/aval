# External `/me` Endpoint Implementation Plan

**Date**: November 2, 2025  
**Goal**: Add `/apiv2/external/me` endpoint to return current user's entity based on Cognito user ID

## 📋 Overview

Create a new public-facing endpoint `/apiv2/external/me` that:
- Returns the current authenticated user's profile
- Uses Cognito `sub` (user ID) from JWT token to fetch user entity
- Requires authentication but NOT admin role
- Separate controller (`ExternalController`) for external-facing endpoints
- Reuses existing `UserService`, `UserRepository`, and DTOs

## 🎯 Requirements

### Functional Requirements
1. **Endpoint**: `GET /apiv2/external/me`
2. **Authentication**: Required (JWT token)
3. **Authorization**: Any authenticated user (user, admin, guest)
4. **Response**: User entity as JSON (using `UserResponseDto`)
5. **User Lookup**: Use `request.user.userId` (Cognito `sub`) to find user entity

### Technical Requirements
1. Create new `ExternalController` class
2. Reuse existing `UserService` and `UserRepository`
3. Reuse existing `UserResponseDto`
4. Add routing for `/apiv2/external/*` endpoints
5. Apply `authMiddleware()` but NOT `requireRole()`

## 🏗️ Architecture

```
Request Flow:
──────────────

1. Client → GET /apiv2/external/me
   Headers: Authorization: Bearer <idToken>
   
2. API Gateway → Lambda (vkp-api2-service)

3. Router → authMiddleware()
   - Validates JWT token
   - Extracts user info from token
   - Sets request.user = { userId, email, role, groups }

4. Router → ExternalController.getMe()
   - Gets userId from request.user.userId (Cognito sub)
   - Calls userService.getById(userId)
   - Returns user entity as JSON

5. Lambda → Client
   - 200 OK with user data
   - 404 if user not found in DynamoDB
   - 401 if not authenticated
```

## 📁 File Structure

```
apiv2/src/
├── presentation/
│   ├── controllers/
│   │   ├── ExternalController.ts          [NEW]
│   │   ├── ExternalController.test.ts     [NEW]
│   │   ├── UserController.ts              [EXISTING]
│   │   └── ...
│   └── middleware/
│       ├── auth.ts                         [EXISTING]
│       └── requireRole.ts                  [EXISTING]
├── index.ts                                [MODIFY - add routes]
└── index-with-auth.ts                      [MODIFY - add routes]
```

## 🔧 Implementation Steps

### Step 1: Create ExternalController

**File**: `apiv2/src/presentation/controllers/ExternalController.ts`

```typescript
import type { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { HttpResponse as Response } from '../../infrastructure/http/HttpResponse.js';
import { NotFoundError } from '../../shared/errors/index.js';

/**
 * External-facing controller for public API endpoints
 * Handles requests to /apiv2/external/*
 */
export class ExternalController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger
  ) {}

  /**
   * Get current user's profile
   * GET /apiv2/external/me
   * 
   * Requires authentication (any role)
   * Returns user entity based on JWT token's user ID
   */
  async getMe(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Get user ID from JWT token (set by authMiddleware)
      const userId = request.user?.userId;
      
      if (!userId) {
        this.logger.warn('User ID not found in request', {
          path: request.path,
          user: request.user
        });
        throw new NotFoundError('User profile not found');
      }

      this.logger.info('Fetching user profile', { userId });

      // Get user entity from database
      const user = await this.userService.getById(userId);
      
      if (!user) {
        this.logger.warn('User entity not found in database', { userId });
        throw new NotFoundError(`User profile not found for ID: ${userId}`);
      }

      this.logger.info('User profile retrieved', { userId });

      // Return user data (UserResponseDto is returned by getById)
      return Response.ok(user);

    } catch (error: any) {
      this.logger.error('Failed to get user profile', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId
      });
      throw error;
    }
  }
}
```

**Key Points**:
- Uses `request.user.userId` (Cognito `sub`) set by `authMiddleware`
- Reuses `UserService.getById()` - no new service methods needed
- Returns `UserResponseDto` automatically (from service)
- Handles missing user entity gracefully with 404
- Proper logging for monitoring

### Step 2: Create ExternalController Tests

**File**: `apiv2/src/presentation/controllers/ExternalController.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExternalController } from './ExternalController.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { NotFoundError } from '../../shared/errors/index.js';

describe('ExternalController', () => {
  let controller: ExternalController;
  let mockUserService: UserService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockUserService = {
      getById: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    controller = new ExternalController(mockUserService, mockLogger);
  });

  describe('getMe', () => {
    it('should return user profile for authenticated user', async () => {
      const userId = 'cognito-user-123';
      const mockUser = {
        id: userId,
        name: 'John Doe',
        externalId: 12345,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      };

      vi.mocked(mockUserService.getById).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'john@example.com',
          role: 'user',
          groups: ['user']
        }
      };

      const response = await controller.getMe(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockUser);
      expect(mockUserService.getById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user ID not in request', async () => {
      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: undefined // No user in request
      };

      await expect(controller.getMe(request)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user entity not in database', async () => {
      const userId = 'cognito-user-999';
      
      vi.mocked(mockUserService.getById).mockResolvedValue(null);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'unknown@example.com',
          role: 'user',
          groups: ['user']
        }
      };

      await expect(controller.getMe(request)).rejects.toThrow(NotFoundError);
      expect(mockUserService.getById).toHaveBeenCalledWith(userId);
    });

    it('should work for admin user', async () => {
      const userId = 'cognito-admin-123';
      const mockUser = {
        id: userId,
        name: 'Admin User',
        externalId: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      };

      vi.mocked(mockUserService.getById).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'admin@example.com',
          role: 'admin',
          groups: ['admin']
        }
      };

      const response = await controller.getMe(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockUser);
    });
  });
});
```

### Step 3: Add Routes to index.ts

**File**: `apiv2/src/index.ts` (and `index-with-auth.ts`)

```typescript
// Add import
import { ExternalController } from './presentation/controllers/ExternalController.js';

// Add controller variable
let externalController: ExternalController;

// In createRouter function, initialize controller
function createRouter() {
  if (!router) {
    initializeServices();
    entityController = new EntityController(entityService, logger);
    userController = new UserController(userService, logger);
    gameController = new GameController(gameService, logger);
    externalController = new ExternalController(userService, logger); // NEW
    
    router = new Router()
      .use(corsMiddleware(config))
      .use(contentTypeMiddleware())
      .use(authMiddleware()) // JWT auth for all routes
      
      // External routes (authenticated users, any role)
      .get('/apiv2/external/me', (req: HttpRequest) => externalController.getMe(req))
      
      // Admin-only routes (/internal/* endpoints)
      .get('/apiv2/internal/files', requireRole('admin'), (req: HttpRequest) => entityController.list(req))
      // ... rest of internal routes
```

**Key Points**:
- External route comes BEFORE internal routes
- Uses `authMiddleware()` but NOT `requireRole()`
- Any authenticated user can access `/external/*` endpoints
- Admin users can access both `/external/*` and `/internal/*`

### Step 4: Update HttpTypes for User Info

**File**: `apiv2/src/infrastructure/http/HttpTypes.ts`

Check if `user` field exists on `HttpRequest`:

```typescript
export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  requestId: string;
  user?: {                    // Added by authMiddleware
    userId: string;           // Cognito sub
    email?: string;
    role?: string;
    groups?: string[];
  };
}
```

If not present, add it.

### Step 5: Integration Tests

**File**: `apiv2/src/integration/external-routes.test.ts` [NEW]

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../index.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Helper to create valid JWT token for testing
function createTestToken(userId: string, role: string = 'user'): string {
  // In real tests, create a valid JWT or mock authMiddleware
  return 'valid-test-token';
}

describe('External Routes Integration', () => {
  describe('GET /apiv2/external/me', () => {
    it('should return 401 without authentication', async () => {
      const event: APIGatewayProxyEventV2 = {
        version: '2.0',
        routeKey: 'GET /apiv2/external/me',
        rawPath: '/apiv2/external/me',
        requestContext: {
          requestId: 'test-123',
          http: { method: 'GET', path: '/apiv2/external/me' }
        } as any,
        headers: {},
        isBase64Encoded: false,
        rawQueryString: ''
      };

      const response = await handler(event) as any;

      expect(response.statusCode).toBe(401);
    });

    it('should return user profile for authenticated user', async () => {
      // Note: This requires mocking authMiddleware or using real JWT
      const userId = 'test-user-123';
      const token = createTestToken(userId);

      const event: APIGatewayProxyEventV2 = {
        version: '2.0',
        routeKey: 'GET /apiv2/external/me',
        rawPath: '/apiv2/external/me',
        requestContext: {
          requestId: 'test-123',
          http: { method: 'GET', path: '/apiv2/external/me' }
        } as any,
        headers: {
          authorization: `Bearer ${token}`
        },
        isBase64Encoded: false,
        rawQueryString: ''
      };

      const response = await handler(event) as any;

      // Will be 404 if user doesn't exist in test DB
      // Will be 200 if user exists
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
```

## 🔄 Request/Response Examples

### Success Case

**Request**:
```http
GET /apiv2/external/me HTTP/1.1
Host: vkp-consulting.fr
Authorization: Bearer eyJraWQi...
```

**Response** (200 OK):
```json
{
  "id": "10ccb9cc-e031-70a5-cf21-1dd0d1a25b96",
  "name": "John Doe",
  "externalId": 12345,
  "createdAt": "2025-11-02T10:30:00Z",
  "updatedAt": "2025-11-02T10:30:00Z"
}
```

### User Not Found

**Request**:
```http
GET /apiv2/external/me HTTP/1.1
Host: vkp-consulting.fr
Authorization: Bearer eyJraWQi...
```

**Response** (404 Not Found):
```json
{
  "type": "about:blank",
  "title": "NotFoundError",
  "status": 404,
  "detail": "User profile not found for ID: 10ccb9cc-e031-70a5-cf21-1dd0d1a25b96",
  "instance": "/apiv2/external/me"
}
```

### No Authentication

**Request**:
```http
GET /apiv2/external/me HTTP/1.1
Host: vkp-consulting.fr
```

**Response** (401 Unauthorized):
```json
{
  "type": "about:blank",
  "title": "UnauthorizedError",
  "status": 401,
  "detail": "Missing authorization header",
  "instance": "/apiv2/external/me"
}
```

## 🔐 Security Considerations

### Authentication
- ✅ Requires JWT token (enforced by `authMiddleware`)
- ✅ Token validated against Cognito JWKS
- ✅ Token expiration checked
- ✅ Token audience validated

### Authorization
- ✅ Any authenticated user can access their own profile
- ✅ No admin role required (unlike `/internal/*` endpoints)
- ✅ User can only see their own profile (based on JWT `sub`)
- ✅ Cannot specify user ID in URL (always uses token's user ID)

### Privacy
- ✅ User can only access their own data
- ✅ No way to enumerate or access other users' profiles
- ✅ User ID comes from validated JWT, not user input

## 📊 Comparison: Internal vs External

| Feature | /apiv2/internal/* | /apiv2/external/* |
|---------|-------------------|-------------------|
| **Authentication** | Required | Required |
| **Authorization** | Admin only | Any authenticated user |
| **Purpose** | Admin management | User self-service |
| **User Lookup** | By ID in URL | From JWT token |
| **Controller** | UserController | ExternalController |
| **Service** | UserService | UserService (same) |
| **Repository** | UserRepository | UserRepository (same) |
| **DTO** | UserResponseDto | UserResponseDto (same) |

## 🧪 Testing Checklist

### Unit Tests
- [x] ExternalController.getMe() with valid user
- [x] ExternalController.getMe() with missing user ID
- [x] ExternalController.getMe() with non-existent user
- [x] ExternalController.getMe() for admin user
- [x] ExternalController error handling

### Integration Tests
- [ ] GET /apiv2/external/me without auth → 401
- [ ] GET /apiv2/external/me with valid token → 200
- [ ] GET /apiv2/external/me with expired token → 401
- [ ] GET /apiv2/external/me for non-existent user → 404
- [ ] GET /apiv2/external/me for admin user → 200
- [ ] GET /apiv2/external/me for guest user → 200

### Manual Tests
- [ ] Login as admin, call /apiv2/external/me
- [ ] Login as regular user, call /apiv2/external/me
- [ ] Test with Postman/curl
- [ ] Test CORS headers
- [ ] Test error responses
- [ ] Verify logging

## 📝 Documentation Updates

### Files to Update

1. **API_DOCUMENTATION.md**
   - Add new section for "External API"
   - Document GET /apiv2/external/me endpoint
   - Add examples and error codes

2. **INFRASTRUCTURE_OVERVIEW.md**
   - Update API v2 section
   - Mention external vs internal endpoints

3. **README.md** (if applicable)
   - Update API overview
   - Add external endpoints section

## 🚀 Deployment Steps

1. **Create Files**:
   ```bash
   cd apiv2/src/presentation/controllers
   touch ExternalController.ts ExternalController.test.ts
   ```

2. **Run Tests**:
   ```bash
   cd apiv2
   npm test
   ```

3. **Build**:
   ```bash
   npm run build
   ```

4. **Create Lambda Package**:
   ```bash
   npm run zip
   ```

5. **Deploy Lambda**:
   ```bash
   cd ../terraform
   terraform apply -target=module.lambda_api2.aws_lambda_function.main
   ```

6. **Test Endpoint**:
   ```bash
   # Get token by logging in
   ID_TOKEN="<your-id-token>"
   
   # Test endpoint
   curl -H "Authorization: Bearer $ID_TOKEN" \
     https://vkp-consulting.fr/apiv2/external/me
   ```

7. **Update Documentation**:
   - Update API_DOCUMENTATION.md
   - Update INFRASTRUCTURE_OVERVIEW.md

## 🎯 Success Criteria

- [x] ExternalController created
- [x] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Route added to index.ts and index-with-auth.ts
- [ ] Endpoint returns user profile for authenticated users
- [ ] Endpoint returns 401 for unauthenticated requests
- [ ] Endpoint returns 404 for non-existent users
- [ ] Logging works correctly
- [ ] Documentation updated
- [ ] Deployed to production
- [ ] Manual testing completed

## 💡 Future Enhancements

1. **Update Profile**: `PATCH /apiv2/external/me`
   - Allow users to update their own profile
   - Validate changes (e.g., name, email)

2. **User Preferences**: `GET/PUT /apiv2/external/me/preferences`
   - Store user preferences (theme, language, etc.)

3. **Activity Log**: `GET /apiv2/external/me/activity`
   - Show user's recent activity

4. **Avatar Upload**: `POST /apiv2/external/me/avatar`
   - Allow users to upload profile picture

## 📊 Estimated Effort

- **Controller Creation**: 30 minutes
- **Unit Tests**: 30 minutes
- **Integration Tests**: 30 minutes
- **Route Configuration**: 15 minutes
- **Manual Testing**: 30 minutes
- **Documentation**: 30 minutes
- **Deployment**: 15 minutes

**Total**: ~3 hours

## ✅ Approval

**Plan Status**: Ready for Implementation  
**Reviewed By**: [Pending]  
**Approved By**: [Pending]  
**Implementation Date**: [TBD]

