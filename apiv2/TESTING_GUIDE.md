# Game API Testing Guide

## Overview
This guide provides comprehensive curl commands for testing the Game API endpoints. The Game API supports full CRUD operations for games, rounds, and moves with proper HTTP semantics and concurrency control.

## Prerequisites
1. **API Gateway URL**: Replace `https://your-api-gateway-url.amazonaws.com` with your actual API Gateway URL
2. **ETags**: Copy ETags from responses and use them in subsequent requests for concurrency control
3. **Content-Type**: Always include `Content-Type: application/json` for POST/PUT/PATCH requests

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/apiv2/games` | List all games |
| `GET` | `/apiv2/games/:id` | Get specific game |
| `GET` | `/apiv2/games/:id/meta` | Get game metadata |
| `POST` | `/apiv2/games` | Create new game |
| `PUT` | `/apiv2/games/:id` | Update game (replace) |
| `PATCH` | `/apiv2/games/:id` | Update game (merge) |
| `DELETE` | `/apiv2/games/:id` | Delete game |
| `POST` | `/apiv2/games/:id/rounds` | Add round to game |
| `POST` | `/apiv2/games/:gameId/rounds/:roundId/moves` | Add move to round |
| `PATCH` | `/apiv2/games/:gameId/rounds/:roundId/finish` | Finish specific round |
| `PATCH` | `/apiv2/games/:id/finish` | Finish entire game |

## Testing Files

### 1. `test-game-api.sh` - Complete Testing Script
- Comprehensive test suite with all endpoints
- Error scenarios and edge cases
- Complete game flow example
- Color-coded output for easy reading

### 2. `quick-test-commands.txt` - Essential Commands
- Quick reference for basic operations
- Step-by-step game creation and management
- Error testing examples

### 3. `test-data.json` - Sample Data
- Pre-formatted JSON data for copy-paste testing
- Various game configurations
- Invalid data examples for error testing

## Quick Start Testing

### Step 1: Create a Game
```bash
curl -X POST 'https://your-api-gateway-url.amazonaws.com/apiv2/games' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "test-game",
    "type": "tournament",
    "usersIds": ["player1", "player2"],
    "rounds": [],
    "isFinished": false
  }'
```

**Expected Response:**
- Status: `201 Created`
- Headers: `Location: /apiv2/games/test-game`, `ETag: "..."`

### Step 2: Get the Game
```bash
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game'
```

**Expected Response:**
- Status: `200 OK`
- Headers: `ETag: "..."`, `Cache-Control: private, must-revalidate`
- Body: Complete game object

### Step 3: Add a Round
```bash
curl -X POST 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game/rounds' \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "ETAG_FROM_STEP_2"' \
  -d '{
    "id": "round-1",
    "moves": [],
    "isFinished": false
  }'
```

**Expected Response:**
- Status: `200 OK`
- Headers: `ETag: "..."` (new ETag)
- Body: Game object with new round

### Step 4: Add Moves to Round
```bash
curl -X POST 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game/rounds/round-1/moves' \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "ETAG_FROM_STEP_3"' \
  -d '{
    "id": "move-1",
    "userId": "player1",
    "value": 10,
    "valueDecorated": "ten"
  }'
```

### Step 5: Finish Round
```bash
curl -X PATCH 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game/rounds/round-1/finish' \
  -H 'If-Match: "ETAG_FROM_STEP_4"'
```

### Step 6: Finish Game
```bash
curl -X PATCH 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game/finish' \
  -H 'If-Match: "ETAG_FROM_STEP_5"'
```

### Step 7: Delete Game
```bash
curl -X DELETE 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game' \
  -H 'If-Match: "ETAG_FROM_STEP_6"'
```

**Expected Response:**
- Status: `204 No Content`

## Error Testing

### Invalid Game Data
```bash
curl -X POST 'https://your-api-gateway-url.amazonaws.com/apiv2/games' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "invalid@game",
    "type": "",
    "usersIds": [],
    "rounds": [],
    "isFinished": false
  }'
```
**Expected:** `400 Bad Request` with validation errors

### Game Not Found
```bash
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games/non-existent'
```
**Expected:** `404 Not Found`

### ETag Mismatch (Concurrency Error)
```bash
curl -X PUT 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game' \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "wrong-etag"' \
  -d '{"type": "updated", "usersIds": ["player1"], "rounds": [], "isFinished": false}'
```
**Expected:** `412 Precondition Failed`

### Missing Content-Type
```bash
curl -X POST 'https://your-api-gateway-url.amazonaws.com/apiv2/games' \
  -d '{"id": "test", "type": "test", "usersIds": ["user1"], "rounds": [], "isFinished": false}'
```
**Expected:** `415 Unsupported Media Type`

## Advanced Features

### Conditional Requests
```bash
# If-None-Match (Not Modified)
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game' \
  -H 'If-None-Match: "current-etag"'

# If-None-Match (Modified)
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games/test-game' \
  -H 'If-None-Match: "old-etag"'
```

### Pagination
```bash
# List with limit
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games?limit=5'

# List with prefix filter
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games?prefix=tournament'

# List with cursor (for pagination)
curl -X GET 'https://your-api-gateway-url.amazonaws.com/apiv2/games?cursor=next-token'
```

### CORS Preflight
```bash
curl -X OPTIONS 'https://your-api-gateway-url.amazonaws.com/apiv2/games' \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type'
```

## Response Headers

### Standard Headers
- `Content-Type: application/json` - Response format
- `ETag: "..."` - Entity version for concurrency control
- `Cache-Control: private, must-revalidate` - Caching policy
- `Location: /apiv2/games/:id` - Resource location (for 201 Created)

### CORS Headers
- `Access-Control-Allow-Origin: https://vkp-consulting.fr`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: content-type,authorization,if-match,if-none-match`
- `Access-Control-Expose-Headers: etag,location`

## Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE |
| `304` | Not Modified | Conditional GET with matching ETag |
| `400` | Bad Request | Invalid request data |
| `404` | Not Found | Resource doesn't exist |
| `412` | Precondition Failed | ETag mismatch |
| `415` | Unsupported Media Type | Missing/invalid Content-Type |

## Tips for Testing

1. **Always use ETags**: Copy ETags from responses and use them in `If-Match` headers
2. **Test concurrency**: Try updating the same game from different terminals
3. **Validate responses**: Check status codes, headers, and response bodies
4. **Test error cases**: Include invalid data, missing resources, and malformed requests
5. **Use pagination**: Test with large datasets to verify pagination works
6. **Check CORS**: Test from browser to ensure CORS headers are correct

## Running the Tests

### Option 1: Use the Complete Script
```bash
./test-game-api.sh
```

### Option 2: Copy Individual Commands
Copy commands from `quick-test-commands.txt` and execute them one by one.

### Option 3: Use Sample Data
Copy JSON from `test-data.json` and paste into curl commands.

## Troubleshooting

### Common Issues
1. **403 Forbidden**: Check API Gateway permissions and CORS configuration
2. **500 Internal Server Error**: Check Lambda logs in CloudWatch
3. **ETag Mismatch**: Ensure you're using the latest ETag from the resource
4. **Validation Errors**: Check request body format and required fields

### Debugging
1. Add `-v` flag to curl for verbose output
2. Check API Gateway logs
3. Monitor Lambda function logs in CloudWatch
4. Verify S3 bucket permissions

## Next Steps

After manual testing:
1. Create automated integration tests
2. Set up monitoring and alerting
3. Configure API Gateway throttling
4. Implement API versioning if needed
5. Add comprehensive logging and metrics
