# VKP REST API - Quick Reference

## Base URL
```
https://your-api-gateway-url.amazonaws.com
```

## Authentication
None required (public API)

## Content Types
- **Request**: `application/json` (required for POST, PUT, PATCH)
- **Response**: `application/json`
- **Error**: `application/problem+json` (RFC 7807)

---

## 📁 Files API (`/apiv2/files`)

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `GET` | `/apiv2/files` | List all files | 200 |
| `GET` | `/apiv2/files/{id}` | Get specific file | 200, 304, 404 |
| `GET` | `/apiv2/files/{id}/meta` | Get file metadata | 200, 404 |
| `POST` | `/apiv2/files` | Create new file | 201, 400, 409, 413, 415 |
| `PUT` | `/apiv2/files/{id}` | Replace file content | 200, 400, 404, 412, 413, 415 |
| `PATCH` | `/apiv2/files/{id}` | Merge file content | 200, 400, 404, 412, 413, 415 |
| `DELETE` | `/apiv2/files/{id}` | Delete file | 204, 404, 412 |

### Query Parameters (List)
- `limit` (number, 1-1000, default: 100)
- `cursor` (string, base64-encoded)
- `prefix` (string, filter by prefix)

### Headers
- `If-None-Match` (GET): Check if modified
- `If-Match` (PUT/PATCH/DELETE): Concurrency control
- `Content-Type: application/json` (POST/PUT/PATCH)

---

## 👥 Users API (`/apiv2/users`)

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `GET` | `/apiv2/users` | List all users | 200 |
| `GET` | `/apiv2/users/{id}` | Get specific user | 200, 304, 404 |
| `GET` | `/apiv2/users/{id}/meta` | Get user metadata | 200, 404 |
| `POST` | `/apiv2/users` | Create new user | 201, 400, 409, 413, 415 |
| `PUT` | `/apiv2/users/{id}` | Replace user data | 200, 400, 404, 412, 413, 415 |
| `PATCH` | `/apiv2/users/{id}` | Merge user data | 200, 400, 404, 412, 413, 415 |
| `DELETE` | `/apiv2/users/{id}` | Delete user | 204, 404, 412 |

### User Fields
- `id` (string, 1-128 chars, alphanumeric + dots, hyphens, underscores)
- `name` (string, 2-100 chars)
- `externalId` (number, positive integer)

---

## 🎮 Games API (`/apiv2/games`)

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `GET` | `/apiv2/games` | List all games | 200 |
| `GET` | `/apiv2/games/{id}` | Get specific game | 200, 304, 404 |
| `GET` | `/apiv2/games/{id}/meta` | Get game metadata | 200, 404 |
| `POST` | `/apiv2/games` | Create new game | 201, 400, 409, 413, 415 |
| `PUT` | `/apiv2/games/{id}` | Replace game data | 200, 400, 404, 412, 413, 415 |
| `PATCH` | `/apiv2/games/{id}` | Merge game data | 200, 400, 404, 412, 413, 415 |
| `DELETE` | `/apiv2/games/{id}` | Delete game | 204, 404, 412 |

### Game-Specific Operations

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `POST` | `/apiv2/games/{id}/rounds` | Add round to game | 200, 400, 404, 412, 413, 415 |
| `POST` | `/apiv2/games/{id}/rounds/{roundId}/moves` | Add move to round | 200, 400, 404, 412, 413, 415 |
| `PATCH` | `/apiv2/games/{id}/rounds/{roundId}/finish` | Finish round | 200, 400, 404, 412 |
| `PATCH` | `/apiv2/games/{id}/finish` | Finish game | 200, 400, 404, 412 |

### Game Fields
- `id` (string, 1-128 chars, alphanumeric + dots, hyphens, underscores)
- `type` (string, 1-100 chars)
- `usersIds` (array, 1-10 user IDs, no duplicates)
- `rounds` (array of round objects)
- `isFinished` (boolean, default: false)

### Round Fields
- `id` (string, 1-128 chars, alphanumeric + dots, hyphens, underscores)
- `moves` (array of move objects)
- `isFinished` (boolean, default: false)

### Move Fields
- `id` (string, 1-128 chars, alphanumeric + dots, hyphens, underscores)
- `userId` (string, 1-128 chars, alphanumeric + dots, hyphens, underscores)
- `value` (number)
- `valueDecorated` (string)

---

## 🔧 Common Operations

### Create with Concurrency Control
```bash
curl -X POST "https://api.example.com/apiv2/files" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{"id": "new-file", "data": {"key": "value"}}'
```

### Update with Concurrency Control
```bash
curl -X PUT "https://api.example.com/apiv2/files/existing" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"key": "new-value"}'
```

### Check if Modified
```bash
curl -X GET "https://api.example.com/apiv2/files/config" \
  -H "If-None-Match: \"abc123\""
# Returns 304 if not modified
```

### Pagination
```bash
# First page
curl -X GET "https://api.example.com/apiv2/files?limit=10"

# Next page
curl -X GET "https://api.example.com/apiv2/files?limit=10&cursor=eyJuZXh0VG9rZW4iOiIxMjMifQ=="
```

---

## 📊 Response Examples

### File Response
```json
{
  "id": "file-123",
  "data": {
    "key": "value",
    "nested": {
      "property": "data"
    }
  }
}
```

### User Response
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

### Game Response
```json
{
  "id": "game-123",
  "type": "tournament",
  "usersIds": ["user-1", "user-2"],
  "rounds": [
    {
      "id": "round-1",
      "moves": [
        {
          "id": "move-1",
          "userId": "user-1",
          "value": 10,
          "valueDecorated": "ten"
        }
      ],
      "isFinished": false
    }
  ],
  "isFinished": false
}
```

### List Response
```json
{
  "names": ["file1", "file2", "user-123"],
  "nextCursor": "eyJuZXh0VG9rZW4iOiIxMjMifQ=="
}
```

### Error Response (RFC 7807)
```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 400,
  "detail": "ID must contain only alphanumeric characters, dots, hyphens, and underscores",
  "instance": "/apiv2/files/invalid-id!"
}
```

---

## 🚨 Status Codes

| Code | Description | When Used |
|------|-------------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 304 | Not Modified | GET with matching If-None-Match |
| 400 | Bad Request | Invalid request body or parameters |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (POST with If-None-Match: *) |
| 412 | Precondition Failed | ETag mismatch (If-Match) |
| 413 | Payload Too Large | Request body exceeds size limit |
| 415 | Unsupported Media Type | Missing or invalid Content-Type |
| 500 | Internal Server Error | Unexpected server error |

---

## 🔗 ETag Concurrency Control

### Reading
```bash
# Get ETag
curl -X GET "https://api.example.com/apiv2/files/config" -i | grep ETag
# ETag: "abc123def456"

# Check if modified
curl -X GET "https://api.example.com/apiv2/files/config" \
  -H "If-None-Match: \"abc123def456\""
# Returns 304 if not modified
```

### Updating
```bash
# Update only if not changed
curl -X PUT "https://api.example.com/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123def456\"" \
  -d '{"new": "data"}'
# Returns 412 if ETag doesn't match
```

### Creating
```bash
# Ensure doesn't exist
curl -X POST "https://api.example.com/apiv2/files/new-file" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{"initial": "data"}'
# Returns 409 if already exists
```

---

## 📝 Validation Rules

### ID Format
- Pattern: `^[a-zA-Z0-9._-]{1,128}$`
- 1-128 characters
- Alphanumeric + dots, hyphens, underscores

### User Name
- 2-100 characters
- Any UTF-8 characters

### External ID
- Positive integer
- Minimum: 1

### Game Type
- 1-100 characters
- Any UTF-8 characters

### User IDs Array
- 1-10 user IDs
- No duplicates
- Each ID follows ID format rules

---

## 🎯 Quick Examples

### Create a User
```bash
curl -X POST "https://api.example.com/apiv2/users" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "name": "John Doe",
    "externalId": 1001
  }'
```

### Create a Game
```bash
curl -X POST "https://api.example.com/apiv2/games" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "game-123",
    "type": "tournament",
    "usersIds": ["user-1", "user-2"],
    "rounds": [],
    "isFinished": false
  }'
```

### Add a Move to Game
```bash
curl -X POST "https://api.example.com/apiv2/games/game-123/rounds/round-1/moves" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "id": "move-1",
    "userId": "user-1",
    "value": 10,
    "valueDecorated": "ten"
  }'
```

### Finish a Game
```bash
curl -X PATCH "https://api.example.com/apiv2/games/game-123/finish" \
  -H "If-Match: \"abc123\""
```

---

*Last updated: October 17, 2025*
