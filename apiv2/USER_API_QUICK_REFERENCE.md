# User API - Quick Reference

## Base URL
```
https://vkp-consulting.fr/apiv2/users
```

## User Entity
```json
{
  "id": "string (1-128 chars, alphanumeric, dots, hyphens, underscores)",
  "name": "string (2-100 chars)",
  "externalId": "number (positive integer)"
}
```

## Endpoints

| Method | Endpoint | Description | Body | Headers |
|--------|----------|-------------|------|---------|
| `POST` | `/users` | Create user | User object | `Content-Type: application/json` |
| `GET` | `/users/{id}` | Get user | - | `If-None-Match: etag` (optional) |
| `PUT` | `/users/{id}` | Replace user | User object | `Content-Type: application/json`, `If-Match: etag` (optional) |
| `PATCH` | `/users/{id}` | Merge user | Partial user object | `Content-Type: application/json`, `If-Match: etag` (optional) |
| `DELETE` | `/users/{id}` | Delete user | - | `If-Match: etag` (optional) |
| `GET` | `/users/{id}/meta` | Get metadata | - | - |
| `GET` | `/users` | List users | - | Query: `?prefix=x&limit=n&cursor=c` |

## Status Codes

| Code | Meaning | When |
|------|---------|------|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE |
| `304` | Not Modified | GET with matching If-None-Match |
| `400` | Bad Request | Invalid input data |
| `404` | Not Found | User doesn't exist |
| `409` | Conflict | User already exists (POST with If-None-Match: *) |
| `412` | Precondition Failed | ETag mismatch |
| `415` | Unsupported Media Type | Missing/wrong Content-Type |

## Common curl Examples

```bash
# Create user
curl -X POST https://vkp-consulting.fr/apiv2/users \
  -H "Content-Type: application/json" \
  -d '{"id":"user-123","name":"John Doe","externalId":1001}'

# Get user
curl https://vkp-consulting.fr/apiv2/users/user-123

# Update user (replace all fields)
curl -X PUT https://vkp-consulting.fr/apiv2/users/user-123 \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"name":"Jane Smith","externalId":2002}'

# Partial update (merge)
curl -X PATCH https://vkp-consulting.fr/apiv2/users/user-123 \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"name":"John Smith"}'

# Delete user
curl -X DELETE https://vkp-consulting.fr/apiv2/users/user-123 \
  -H "If-Match: \"abc123\""

# List users
curl "https://vkp-consulting.fr/apiv2/users?limit=10"

# Get user metadata
curl https://vkp-consulting.fr/apiv2/users/user-123/meta
```

## JavaScript Examples

```javascript
const API_BASE = 'https://vkp-consulting.fr/apiv2/users';

// Create user
const user = await fetch(API_BASE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'user-123',
    name: 'John Doe',
    externalId: 1001
  })
}).then(r => r.json());

// Get user with caching
const getUser = async (id, etag) => {
  const headers = etag ? { 'If-None-Match': etag } : {};
  const response = await fetch(`${API_BASE}/${id}`, { headers });
  
  if (response.status === 304) return null; // Not modified
  if (!response.ok) throw new Error('User not found');
  
  return {
    data: await response.json(),
    etag: response.headers.get('ETag')
  };
};

// Update with concurrency control
const updateUser = async (id, data, etag) => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': etag
    },
    body: JSON.stringify(data)
  });
  
  if (response.status === 412) throw new Error('Concurrent modification');
  return response.json();
};
```

## Error Response Format
```json
{
  "type": "about:blank",
  "title": "Error Title",
  "status": 400,
  "detail": "Error description",
  "instance": "/apiv2/users/user-id",
  "field": "fieldName"
}
```

## ETag Concurrency Control

1. **Get ETag**: Include `ETag` header in all responses
2. **Conditional Updates**: Use `If-Match: "etag"` for PUT/PATCH/DELETE
3. **Conditional Gets**: Use `If-None-Match: "etag"` for GET
4. **Prevent Duplicates**: Use `If-None-Match: "*"` for POST

## Pagination

```bash
# First page
curl "https://vkp-consulting.fr/apiv2/users?limit=10"

# Next page (use nextCursor from previous response)
curl "https://vkp-consulting.fr/apiv2/users?limit=10&cursor=next-page-cursor"
```

## Validation Rules

- **id**: 1-128 characters, alphanumeric + dots, hyphens, underscores
- **name**: 2-100 characters
- **externalId**: Positive integer
- **Content-Type**: Must be `application/json` for POST, PUT, PATCH
