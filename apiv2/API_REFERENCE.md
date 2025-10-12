# VKP API Reference

## Quick Reference

### Base URL
```
https://your-api-gateway-url.amazonaws.com
```

### Content Type
```
Content-Type: application/json
```

---

## Files API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/apiv2/files` | List all files |
| `GET` | `/apiv2/files/{id}` | Get file by ID |
| `GET` | `/apiv2/files/{id}/meta` | Get file metadata |
| `POST` | `/apiv2/files` | Create new file |
| `PUT` | `/apiv2/files/{id}` | Replace file content |
| `PATCH` | `/apiv2/files/{id}` | Merge file content |
| `DELETE` | `/apiv2/files/{id}` | Delete file |

### Files API Examples

```bash
# List files
curl -X GET "/apiv2/files?limit=10"

# Get file
curl -X GET "/apiv2/files/config"

# Create file
curl -X POST "/apiv2/files" \
  -H "Content-Type: application/json" \
  -d '{"id": "config", "data": {"setting": "value"}}'

# Update file
curl -X PUT "/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"etag\"" \
  -d '{"setting": "new-value"}'

# Delete file
curl -X DELETE "/apiv2/files/config" \
  -H "If-Match: \"etag\""
```

---

## Users API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/apiv2/users` | List all users |
| `GET` | `/apiv2/users/{id}` | Get user by ID |
| `GET` | `/apiv2/users/{id}/meta` | Get user metadata |
| `POST` | `/apiv2/users` | Create new user |
| `PUT` | `/apiv2/users/{id}` | Replace user data |
| `PATCH` | `/apiv2/users/{id}` | Merge user data |
| `DELETE` | `/apiv2/users/{id}` | Delete user |

### Users API Examples

```bash
# List users
curl -X GET "/apiv2/users?limit=10"

# Get user
curl -X GET "/apiv2/users/user-123"

# Create user
curl -X POST "/apiv2/users" \
  -H "Content-Type: application/json" \
  -d '{"id": "user-123", "name": "John Doe", "externalId": 1001}'

# Update user
curl -X PUT "/apiv2/users/user-123" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"etag\"" \
  -d '{"name": "John Smith", "externalId": 1002}'

# Delete user
curl -X DELETE "/apiv2/users/user-123" \
  -H "If-Match: \"etag\""
```

---

## Request/Response Formats

### Create File Request
```json
{
  "id": "file-id",
  "data": {
    "any": "valid JSON"
  }
}
```

### Create User Request
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

### File Response
```json
{
  "id": "file-id",
  "data": {
    "any": "valid JSON"
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

### List Response
```json
{
  "names": ["file1", "file2", "user-123"],
  "nextCursor": "base64-encoded-cursor"
}
```

### Metadata Response
```json
{
  "etag": "\"abc123\"",
  "size": 1024,
  "lastModified": "2023-10-12T18:30:00.000Z"
}
```

### Error Response
```json
{
  "type": "about:blank",
  "title": "Error Title",
  "status": 400,
  "detail": "Error description",
  "instance": "/apiv2/files/invalid-id"
}
```

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 304 | Not Modified |
| 400 | Bad Request |
| 404 | Not Found |
| 409 | Conflict |
| 412 | Precondition Failed |
| 413 | Payload Too Large |
| 415 | Unsupported Media Type |
| 500 | Internal Server Error |

---

## Headers

### Request Headers
- `Content-Type: application/json` (required for POST/PUT/PATCH)
- `If-Match: "etag"` (for conditional updates)
- `If-None-Match: "etag"` or `*` (for conditional gets/creates)

### Response Headers
- `ETag: "etag"` (for concurrency control)
- `Location: /apiv2/files/id` (for created resources)
- `Cache-Control: private, must-revalidate`

---

## Query Parameters

### Pagination
- `limit`: Number of items (1-1000, default: 100)
- `cursor`: Base64-encoded pagination cursor
- `prefix`: Filter by prefix

### Example
```
GET /apiv2/files?limit=20&cursor=eyJuZXh0VG9rZW4iOiIxMjMifQ==&prefix=user-
```

---

## Validation Rules

### File ID
- Required: Yes
- Type: String
- Length: 1-128 characters
- Pattern: `^[a-zA-Z0-9._-]+$`

### User ID
- Required: Yes
- Type: String
- Length: 1-128 characters
- Pattern: `^[a-zA-Z0-9._-]+$`

### User Name
- Required: Yes
- Type: String
- Length: 2-100 characters

### User External ID
- Required: Yes
- Type: Number
- Value: Positive integer

### File Data
- Required: Yes (for files)
- Type: Any valid JSON value
- Size: Max 1MB

---

## Concurrency Control

### ETag Usage
```bash
# Get current ETag
curl -X GET "/apiv2/files/config" -i | grep ETag

# Conditional update
curl -X PUT "/apiv2/files/config" \
  -H "If-Match: \"current-etag\"" \
  -d '{"new": "data"}'

# Conditional create (ensure doesn't exist)
curl -X POST "/apiv2/files/new" \
  -H "If-None-Match: *" \
  -d '{"initial": "data"}'
```

---

## CORS

- **Allowed Origin**: `https://vkp-consulting.fr`
- **Allowed Methods**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization`

---

*For detailed documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)*
