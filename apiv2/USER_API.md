# User API Documentation

## Overview

The User API provides RESTful endpoints for managing user entities in the system. Users have structured data with validation and support for optimistic concurrency control using ETags.

## Base URL

```
https://vkp-consulting.fr/apiv2/users
```

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **Error Response**: `application/problem+json` (RFC 7807)

## User Entity

A User entity contains the following fields:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | string | Yes | Unique identifier for the user | 1-128 characters, alphanumeric, dots, hyphens, underscores |
| `name` | string | Yes | Display name of the user | 2-100 characters |
| `externalId` | number | Yes | External system identifier | Positive integer |

### Example User Object

```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

## Endpoints

### 1. Create User

Creates a new user in the system.

**Endpoint:** `POST /apiv2/users`

**Request Body:**
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

**Headers:**
- `Content-Type: application/json`
- `If-None-Match: *` (optional) - Prevents creation if user already exists

**Success Response:** `201 Created`
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

**Response Headers:**
- `Location: /apiv2/users/user-123`
- `ETag: "abc123def456"`

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `409 Conflict` - User already exists (when If-None-Match: * is used)
- `415 Unsupported Media Type` - Missing or invalid Content-Type

### 2. Get User

Retrieves a specific user by ID.

**Endpoint:** `GET /apiv2/users/{id}`

**Path Parameters:**
- `id` (string) - The user ID

**Headers:**
- `If-None-Match: "etag-value"` (optional) - Returns 304 if unchanged

**Success Response:** `200 OK`
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

**Response Headers:**
- `ETag: "abc123def456"`
- `Cache-Control: private, max-age=300`

**Error Responses:**
- `304 Not Modified` - User unchanged (when If-None-Match matches)
- `404 Not Found` - User does not exist

### 3. Update User (Replace)

Replaces all user data with new values.

**Endpoint:** `PUT /apiv2/users/{id}`

**Path Parameters:**
- `id` (string) - The user ID

**Request Body:**
```json
{
  "name": "Jane Smith",
  "externalId": 2002
}
```

**Headers:**
- `Content-Type: application/json`
- `If-Match: "etag-value"` (optional) - Prevents lost updates

**Success Response:** `200 OK`
```json
{
  "id": "user-123",
  "name": "Jane Smith",
  "externalId": 2002
}
```

**Response Headers:**
- `ETag: "new-etag-value"`
- `Cache-Control: private, max-age=300`

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `404 Not Found` - User does not exist
- `412 Precondition Failed` - ETag mismatch (when If-Match provided)

### 4. Update User (Merge)

Partially updates user data, preserving existing values.

**Endpoint:** `PATCH /apiv2/users/{id}`

**Path Parameters:**
- `id` (string) - The user ID

**Request Body:**
```json
{
  "name": "John Smith"
}
```

**Headers:**
- `Content-Type: application/json`
- `If-Match: "etag-value"` (optional) - Prevents lost updates

**Success Response:** `200 OK`
```json
{
  "id": "user-123",
  "name": "John Smith",
  "externalId": 1001
}
```

**Response Headers:**
- `ETag: "new-etag-value"`
- `Cache-Control: private, max-age=300`

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `404 Not Found` - User does not exist
- `412 Precondition Failed` - ETag mismatch (when If-Match provided)

### 5. Delete User

Removes a user from the system.

**Endpoint:** `DELETE /apiv2/users/{id}`

**Path Parameters:**
- `id` (string) - The user ID

**Headers:**
- `If-Match: "etag-value"` (optional) - Prevents accidental deletion

**Success Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - User does not exist
- `412 Precondition Failed` - ETag mismatch (when If-Match provided)

### 6. Get User Metadata

Retrieves metadata about a user without the full data.

**Endpoint:** `GET /apiv2/users/{id}/meta`

**Path Parameters:**
- `id` (string) - The user ID

**Success Response:** `200 OK`
```json
{
  "etag": "abc123def456",
  "size": 1024,
  "lastModified": "2023-01-01T00:00:00.000Z"
}
```

**Response Headers:**
- `ETag: "abc123def456"`
- `Cache-Control: private, max-age=300`

**Error Responses:**
- `404 Not Found` - User does not exist

### 7. List Users

Retrieves a paginated list of user IDs.

**Endpoint:** `GET /apiv2/users`

**Query Parameters:**
- `prefix` (string, optional) - Filter users by ID prefix
- `limit` (number, optional) - Maximum number of results (default: 100)
- `cursor` (string, optional) - Pagination cursor for next page

**Success Response:** `200 OK`
```json
{
  "names": ["user-1", "user-2", "user-3"],
  "nextCursor": "next-page-cursor"
}
```

**Response Headers:**
- `Cache-Control: private, max-age=60`

## Error Handling

All errors follow the RFC 7807 Problem Details for HTTP APIs standard.

### Error Response Format

```json
{
  "type": "about:blank",
  "title": "Error Title",
  "status": 400,
  "detail": "Detailed error message",
  "instance": "/apiv2/users/invalid-id",
  "field": "id"
}
```

### Common Error Codes

| Status | Title | Description |
|--------|-------|-------------|
| 400 | Validation Error | Invalid input data or validation failure |
| 404 | User Not Found | Requested user does not exist |
| 409 | Conflict | User already exists or resource conflict |
| 412 | Precondition Failed | ETag mismatch or precondition not met |
| 415 | Unsupported Media Type | Invalid or missing Content-Type header |
| 500 | Internal Server Error | Unexpected server error |

## Concurrency Control

The API supports optimistic concurrency control using ETags:

### ETag Usage

1. **ETags in Responses**: All successful responses include an `ETag` header
2. **Conditional Requests**: Use `If-Match` or `If-None-Match` headers
3. **Lost Update Prevention**: Always use `If-Match` for updates
4. **Creation Safety**: Use `If-None-Match: *` to prevent duplicate creation

### Example Workflow

```bash
# 1. Get user with ETag
curl -H "Accept: application/json" /apiv2/users/user-123
# Response includes: ETag: "abc123"

# 2. Update with ETag to prevent lost updates
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "If-Match: abc123" \
  -d '{"name":"Updated Name","externalId":1001}' \
  /apiv2/users/user-123

# 3. If ETag matches, update succeeds
# If ETag differs, returns 412 Precondition Failed
```

## CORS Support

The API includes CORS headers for cross-origin requests:

- `Access-Control-Allow-Origin: https://vkp-consulting.fr`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: content-type,authorization,if-match,if-none-match`

## Rate Limiting

Currently, no rate limiting is implemented. All requests are processed immediately.

## Pagination

The list endpoint supports cursor-based pagination:

### Example Pagination Flow

```bash
# 1. Get first page
curl "/apiv2/users?limit=10"
# Response: {"names": [...], "nextCursor": "cursor-123"}

# 2. Get next page
curl "/apiv2/users?limit=10&cursor=cursor-123"
# Response: {"names": [...], "nextCursor": "cursor-456"}

# 3. Continue until no nextCursor
```

## Examples

### Complete CRUD Example

```bash
# Create user
curl -X POST /apiv2/users \
  -H "Content-Type: application/json" \
  -d '{"id":"user-123","name":"John Doe","externalId":1001}'

# Get user
curl /apiv2/users/user-123

# Update user (replace)
curl -X PUT /apiv2/users/user-123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","externalId":2002}'

# Partial update (merge)
curl -X PATCH /apiv2/users/user-123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe"}'

# Get metadata
curl /apiv2/users/user-123/meta

# List users
curl /apiv2/users

# Delete user
curl -X DELETE /apiv2/users/user-123
```

### JavaScript Example

```javascript
const baseUrl = 'https://vkp-consulting.fr/apiv2/users';

// Create user
const createUser = async (userData) => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Get user with caching
const getUser = async (id, etag) => {
  const headers = {};
  if (etag) headers['If-None-Match'] = etag;
  
  const response = await fetch(`${baseUrl}/${id}`, { headers });
  if (response.status === 304) return null; // Not modified
  
  return {
    data: await response.json(),
    etag: response.headers.get('ETag')
  };
};

// Update user with concurrency control
const updateUser = async (id, userData, etag) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (etag) headers['If-Match'] = etag;
  
  const response = await fetch(`${baseUrl}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(userData)
  });
  
  if (response.status === 412) {
    throw new Error('User was modified by another process');
  }
  
  return response.json();
};
```

## Changelog

### Version 1.0.0
- Initial release
- Full CRUD operations for User entities
- ETag-based concurrency control
- Pagination support
- RFC 7807 error responses
- CORS support
