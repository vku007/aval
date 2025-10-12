# JSON File Storage API

RESTful API for managing JSON files in S3 with ETag concurrency control.

## Base URL
```
https://vkp-consulting.fr/apiv2
```

## Endpoints

### List Files
```http
GET /files?prefix={prefix}&limit={limit}&cursor={cursor}
```
**Query Parameters:**
- `prefix` (optional) - Filter by name prefix
- `limit` (optional) - Max items, 1-1000, default 100
- `cursor` (optional) - Pagination token from previous response

**Response 200:**
```json
{
  "items": [
    {
      "name": "file1",
      "etag": "abc123",
      "size": 256,
      "lastModified": "2025-01-01T00:00:00Z"
    }
  ],
  "nextCursor": "..."
}
```

---

### Get File
```http
GET /files/{name}
If-None-Match: {etag}
```
**Response 200:**
```json
{ "your": "data" }
```
**Headers:** `ETag: "abc123"`

**Response 304:** Not Modified (when ETag matches)

**Response 404:** File not found

---

### Create File
```http
POST /files
Content-Type: application/json

{
  "name": "myfile",
  "data": { "key": "value" }
}
```
**Response 201:**
```json
{ "name": "myfile", "etag": "xyz789" }
```
**Headers:** `ETag`, `Location: /apiv2/files/myfile`

**Response 409:** File already exists  
**Response 415:** Invalid Content-Type

---

### Replace File
```http
PUT /files/{name}
Content-Type: application/json
If-Match: {etag}

{ "updated": "data" }
```
**Response 200:**
```json
{ "name": "myfile", "etag": "new-etag" }
```
**Headers:** `ETag`

**Response 412:** Precondition Failed (ETag mismatch)

---

### Partial Update (Merge)
```http
PATCH /files/{name}
Content-Type: application/json
If-Match: {etag}

{ "newField": "value" }
```
Deep merges with existing data (arrays replaced, objects merged).

**Response 200:**
```json
{ "name": "myfile", "etag": "merged-etag" }
```

**Response 428:** If-Match header required  
**Response 412:** ETag mismatch  
**Response 404:** File not found

---

### Delete File
```http
DELETE /files/{name}
If-Match: {etag}
```
**Response 204:** No Content

**Response 412:** ETag mismatch (if If-Match provided)  
**Response 404:** File not found

---

### Get File Metadata
```http
GET /files/{name}/meta
```
**Response 200:**
```json
{
  "etag": "abc123",
  "size": 512,
  "lastModified": "2025-01-01T00:00:00Z"
}
```
**Headers:** `ETag`

---

## Headers

### Request
- `Content-Type: application/json` - Required for POST/PUT/PATCH
- `If-Match: {etag}` - Conditional write (PUT/PATCH/DELETE)
- `If-None-Match: {etag}` - Conditional read (GET), prevents create (POST)

### Response
- `ETag: "{etag}"` - Resource version
- `Location: /apiv2/files/{name}` - On 201 Created
- `Allow: GET, POST, ...` - On 405 Method Not Allowed
- `Access-Control-Allow-Origin: ...` - CORS

---

## Error Format (RFC 7807)
```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "File not found",
  "instance": "/apiv2/files/missing"
}
```
**Content-Type:** `application/problem+json`

---

## Status Codes
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE success) |
| 304 | Not Modified (cached) |
| 400 | Bad Request (invalid JSON) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict (file exists) |
| 412 | Precondition Failed (ETag mismatch) |
| 413 | Payload Too Large (>1MB) |
| 415 | Unsupported Media Type |
| 428 | Precondition Required |
| 500 | Internal Server Error |

---

## Concurrency Control

**Optimistic locking with ETags:**

1. **Read:** `GET /files/doc` → `ETag: "v1"`
2. **Modify locally**
3. **Write:** `PUT /files/doc` with `If-Match: "v1"`
   - ✅ Success → `ETag: "v2"`
   - ❌ 412 if someone else updated → retry from step 1

**Prevent overwrites:**
- Use `If-Match` on PUT/PATCH/DELETE
- Use `If-None-Match: *` on POST to ensure new file

---

## Name Constraints
- **Pattern:** `[a-zA-Z0-9._-]{1,128}`
- **Examples:** `config`, `user.settings`, `data-2025`
- **Invalid:** `/path/to/file`, `file with spaces`, `file@domain`

---

## Examples

### Create and Update
```bash
# Create
curl -X POST https://vkp-consulting.fr/apiv2/files \
  -H 'Content-Type: application/json' \
  -d '{"name":"config","data":{"theme":"dark"}}'
# → {"name":"config","etag":"abc"}

# Update
curl -X PUT https://vkp-consulting.fr/apiv2/files/config \
  -H 'Content-Type: application/json' \
  -H 'If-Match: abc' \
  -d '{"theme":"light","lang":"en"}'
# → {"name":"config","etag":"def"}
```

### Conditional Read
```bash
# First request
curl -i https://vkp-consulting.fr/apiv2/files/config
# ETag: "def"

# Subsequent request (cached)
curl -i https://vkp-consulting.fr/apiv2/files/config \
  -H 'If-None-Match: def'
# → 304 Not Modified
```

### Pagination
```bash
# Page 1
curl 'https://vkp-consulting.fr/apiv2/files?limit=10'
# → {"items":[...],"nextCursor":"xyz"}

# Page 2
curl 'https://vkp-consulting.fr/apiv2/files?limit=10&cursor=xyz'
```

---

## Limits
- **Max body size:** 1 MB (configurable via `MAX_BODY_BYTES`)
- **Max file name:** 128 characters
- **Pagination limit:** 1-1000 items

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUCKET_NAME` | (required) | S3 bucket name |
| `JSON_PREFIX` | `json/` | S3 key prefix |
| `CORS_ORIGIN` | `https://vkp-consulting.fr` | Allowed origin |
| `MAX_BODY_BYTES` | `1048576` | Max payload (1MB) |
| `ENVIRONMENT` | `prod` | Environment tag |
| `APP_TAG` | `vkp-api` | Application tag |

---

## Development

**Build:**
```bash
npm run build
```

**Test:**
```bash
npm test
```

**Deploy:**
```bash
npm run build && npm run zip
aws lambda update-function-code --function-name vkp-api2-service --zip-file fileb://lambda.zip
```

---

## Architecture
- **Runtime:** Node.js 20 (AWS Lambda)
- **Storage:** S3 with server-side encryption (AES256)
- **API Gateway:** HTTP API (v2) at `/apiv2/*`
- **CDN:** CloudFront routes `/apiv2/*` to API Gateway (no caching)

---

## Notes
- **S3 Consistency:** S3 PutObject doesn't support atomic If-Match; we use HEAD-then-PUT for best-effort concurrency
- **PATCH Merge:** Deep merge strategy; arrays replaced, objects merged recursively
- **Versioning:** Enable S3 versioning on bucket for better conflict recovery
- **Monitoring:** Structured JSON logs to CloudWatch with `requestId` for tracing

---

## User Entity API

The API also includes a structured User entity with domain-driven design:

### User Endpoints
- `GET /apiv2/users` - List users with pagination
- `GET /apiv2/users/{id}` - Get user by ID  
- `GET /apiv2/users/{id}/meta` - Get user metadata
- `POST /apiv2/users` - Create new user
- `PUT /apiv2/users/{id}` - Replace user (full update)
- `PATCH /apiv2/users/{id}` - Merge user (partial update)
- `DELETE /apiv2/users/{id}` - Delete user

### User Entity Structure
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

### User API Documentation
- **[Complete User API Reference](./USER_API.md)** - Full API documentation
- **[User API Quick Reference](./USER_API_QUICK_REFERENCE.md)** - Developer quick reference
- **[User Entity Implementation Guide](./USER_ENTITY_README.md)** - Architecture and implementation details

---

## See Also
- [IMPROVEMENTS.md](./IMPROVEMENTS.md) - Recent REST best practices applied
- [USER_API.md](./USER_API.md) - Complete User API documentation
- [USER_ENTITY_README.md](./USER_ENTITY_README.md) - User entity implementation guide
- [RFC 7807](https://tools.ietf.org/html/rfc7807) - Problem Details for HTTP APIs
- [RFC 7232](https://tools.ietf.org/html/rfc7232) - HTTP Conditional Requests
