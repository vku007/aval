# API v2 Improvements Applied

## Summary
Applied REST API best practices improvements to the JSON file storage service.

## Changes Implemented

### 1. ✅ CORS Headers on Error Responses
**Issue:** Error responses from `problem()` function didn't include CORS headers, causing browser blocking.

**Fix:** Added CORS headers to all error responses:
```typescript
headers: {
  "content-type": "application/problem+json",
  "access-control-allow-origin": corsOrigin,
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,if-match,if-none-match"
}
```

### 2. ✅ Content-Type Validation
**Issue:** API accepted non-JSON payloads on POST/PUT/PATCH without validation.

**Fix:** Added early validation for mutation methods:
- Returns `415 Unsupported Media Type` if `Content-Type` is not `application/json`
- Validates before body parsing to fail fast
- Logs warning with structured logging

### 3. ✅ Structured Logging with Request ID
**Issue:** Logs were generic and hard to trace in CloudWatch.

**Fix:** Implemented structured JSON logging:
```typescript
// New signature
log(level: "info" | "warn" | "error", data: Record<string, unknown>)

// Example usage
log("info", { 
  requestId, 
  method, 
  path, 
  event: "request", 
  duration_ms: Date.now() - t0 
});
```

All logs now include:
- `timestamp` - ISO 8601 timestamp
- `level` - info/warn/error
- `requestId` - AWS request ID for tracing
- `event` - event type (request, error, unsupported_media_type)
- Context-specific fields (method, path, status, duration_ms)

### 4. ✅ Allow Header on 405 Method Not Allowed
**Issue:** When method not allowed, response didn't include `Allow` header per HTTP spec.

**Fix:** Return proper 405 response with `Allow` header:
```typescript
statusCode: 405,
headers: {
  "allow": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  // ... CORS headers
}
```

### 5. ✅ Comprehensive Unit Tests
**Coverage:** 26 tests covering all endpoints and edge cases

**Test Categories:**
- **CORS & Preflight** - OPTIONS handling, CORS headers on errors
- **Content-Type Validation** - Reject invalid content types, accept valid JSON
- **GET /files** - List with pagination, cursor handling
- **GET /files/{name}** - File retrieval, 304 Not Modified, 404 handling
- **POST /files** - Create files, 409 conflict, validation errors
- **PUT /files/{name}** - Create/replace, If-Match preconditions, 412 failures
- **PATCH /files/{name}** - Require If-Match (428), merge updates, 404/412 handling
- **DELETE /files/{name}** - Delete with 204, If-Match validation, 404/412
- **GET /files/{name}/meta** - Metadata retrieval, 404 handling
- **405 Method Not Allowed** - Proper Allow header
- **Error Handling** - 500 errors, 413 payload too large

**Test Results:**
```
✓ 26 tests passed
Duration: 290ms
```

## Files Modified
- `src/errors.ts` - Added CORS headers to problem responses
- `src/logging.ts` - Structured logging with levels
- `src/app.ts` - Content-Type validation, requestId tracking, 405 with Allow header
- `src/app.test.ts` - Comprehensive test suite (new file)

## Testing
Run tests:
```bash
npm test
```

## Deployment
After deploying these changes:
1. Build: `npm run build`
2. Package: `npm run zip`
3. Deploy to Lambda function `vkp-api2-service`
4. Test via CloudFront: `https://vkp-consulting.fr/apiv2/files`

## Remaining Improvements (Lower Priority)
6. Cache-Control headers (performance)
7. Location header on PUT 201 (REST semantics)
8. Security headers (X-Content-Type-Options, etc.)
9. Health endpoint (/apiv2/health)
10. Preflight cache optimization (Access-Control-Max-Age)
11. Rate limiting headers
12. Link header for pagination
13. Name validation to allow hierarchical paths
14. JSON Merge Patch documentation

## Observability Improvements
With structured logging, you can now query CloudWatch Logs Insights:

```
# Find all errors
fields @timestamp, level, requestId, method, path, status, detail
| filter level = "error"
| sort @timestamp desc

# Track request duration
fields @timestamp, requestId, path, duration_ms
| filter event = "request"
| stats avg(duration_ms), max(duration_ms), count() by path

# Monitor 415 errors
fields @timestamp, requestId, method, path, contentType
| filter event = "unsupported_media_type"
```
