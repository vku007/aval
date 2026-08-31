# VKP REST API - Complete Documentation

## Overview

The VKP REST API is a comprehensive file, user, and game management system built with AWS Lambda, providing CRUD operations for JSON documents, user entities, and game entities. The API follows RESTful principles with proper HTTP status codes, ETag-based concurrency control, and RFC 7807 problem+json error responses.

## Base URL

```
https://your-api-gateway-url.amazonaws.com
```

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible.

## Content Types

- **Request Content-Type**: `application/json` (required for POST, PUT, PATCH)
- **Response Content-Type**: `application/json`
- **Error Content-Type**: `application/problem+json` (RFC 7807)

## CORS

The API supports CORS with the following configuration:
- **Allowed Origin**: `https://vkp-consulting.fr` (configurable)
- **Allowed Methods**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization`

---

## API Endpoints Summary

| Resource | Endpoint | Methods | Description |
|----------|----------|---------|-------------|
| **Files** | `/apiv2/files` | GET, POST | List/Create JSON files |
| **File** | `/apiv2/files/{id}` | GET, PUT, PATCH, DELETE | Manage specific file |
| **File Meta** | `/apiv2/files/{id}/meta` | GET | Get file metadata |
| **Users** | `/apiv2/users` | GET, POST | List/Create users |
| **User** | `/apiv2/users/{id}` | GET, PUT, PATCH, DELETE | Manage specific user |
| **User Meta** | `/apiv2/users/{id}/meta` | GET | Get user metadata |
| **Games** | `/apiv2/games` | GET, POST | List/Create games |
| **Game** | `/apiv2/games/{id}` | GET, PUT, PATCH, DELETE | Manage specific game |
| **Game Meta** | `/apiv2/games/{id}/meta` | GET | Get game metadata |

---

## Files API (`/apiv2/files`)

The Files API provides unified management for JSON documents and user entity files. It can read from both `json/` and `json/users/` folders, providing a single interface for all file types.

### List Files

**GET** `/apiv2/files`

Retrieve a paginated list of all files (including both regular JSON files and user files).

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum number of files to return (1-1000) |
| `cursor` | string | - | Base64-encoded cursor for pagination |
| `prefix` | string | - | Filter files by prefix |

#### Response

```json
{
  "names": ["file1", "file2", "user-123"],
  "nextCursor": "eyJuZXh0VG9rZW4iOiIxMjMifQ=="
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/files?limit=10"
```

---

### Get File

**GET** `/apiv2/files/{id}`

Retrieve a specific file by its ID. Works for both regular JSON files and user files.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | File identifier (alphanumeric, dots, hyphens, underscores, 1-128 chars) |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-None-Match` | string | No | ETag to check if file has been modified |

#### Response

**Success (200)**:
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

**Not Modified (304)**: When `If-None-Match` matches current ETag

#### Response Headers

| Header | Description |
|--------|-------------|
| `ETag` | Entity tag for concurrency control |
| `Cache-Control` | `private, must-revalidate` |

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/files/config" \
  -H "If-None-Match: \"abc123\""
```

---

### Get File Metadata

**GET** `/apiv2/files/{id}/meta`

Retrieve metadata for a specific file without downloading the content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | File identifier |

#### Response

```json
{
  "etag": "\"abc123def456\"",
  "size": 1024,
  "lastModified": "2023-10-12T18:30:00.000Z"
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/files/config/meta"
```

---

### Create File

**POST** `/apiv2/files`

Create a new file with the specified ID and data.

#### Request Body

```json
{
  "id": "new-file",
  "data": {
    "content": "any valid JSON structure",
    "metadata": {
      "version": "1.0"
    }
  }
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-None-Match` | string | No | Set to `*` to ensure file doesn't exist |

#### Response

**Success (201)**:
```json
{
  "id": "new-file",
  "data": {
    "content": "any valid JSON structure",
    "metadata": {
      "version": "1.0"
    }
  }
}
```

#### Response Headers

| Header | Description |
|--------|-------------|
| `Location` | URL of the created file |
| `ETag` | Entity tag for the created file |

#### Example

```bash
curl -X POST "https://api.example.com/apiv2/files" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{
    "id": "config",
    "data": {
      "database": {
        "host": "localhost",
        "port": 5432
      },
      "features": ["auth", "logging"]
    }
  }'
```

---

### Update File (Replace)

**PUT** `/apiv2/files/{id}`

Replace the entire content of a file.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | File identifier |

#### Request Body

```json
{
  "key": "new value",
  "completely": "new structure"
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure file hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "file-123",
  "data": {
    "key": "new value",
    "completely": "new structure"
  }
}
```

#### Example

```bash
curl -X PUT "https://api.example.com/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "database": {
      "host": "production-db",
      "port": 5432
    },
    "features": ["auth", "logging", "monitoring"]
  }'
```

---

### Update File (Merge)

**PATCH** `/apiv2/files/{id}`

Partially update a file by merging new data with existing content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | File identifier |

#### Request Body

```json
{
  "merge": true,
  "data": {
    "newField": "value",
    "existingField": "updated value"
  }
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure file hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "file-123",
  "data": {
    "existingField": "updated value",
    "newField": "value",
    "otherExistingField": "preserved"
  }
}
```

#### Example

```bash
curl -X PATCH "https://api.example.com/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "merge": true,
    "data": {
      "database": {
        "host": "new-host"
      },
      "newFeature": "enabled"
    }
  }'
```

---

### Delete File

**DELETE** `/apiv2/files/{id}`

Delete a file permanently.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | File identifier |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | ETag to ensure file hasn't been modified |

#### Response

**Success (204)**: No content

#### Example

```bash
curl -X DELETE "https://api.example.com/apiv2/files/old-config" \
  -H "If-Match: \"abc123\""
```

---

## Users API (`/apiv2/users`)

The Users API provides specialized management for user entities with structured data validation.

### List Users

**GET** `/apiv2/users`

Retrieve a paginated list of all users.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum number of users to return (1-1000) |
| `cursor` | string | - | Base64-encoded cursor for pagination |
| `prefix` | string | - | Filter users by ID prefix |

#### Response

```json
{
  "names": ["user-001", "user-002", "admin-123"],
  "nextCursor": "eyJuZXh0VG9rZW4iOiIxMjMifQ=="
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/users?limit=20"
```

---

### Get User

**GET** `/apiv2/users/{id}`

Retrieve a specific user by ID.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User identifier (alphanumeric, dots, hyphens, underscores, 1-128 chars) |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-None-Match` | string | No | ETag to check if user has been modified |

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

**Not Modified (304)**: When `If-None-Match` matches current ETag

#### Response Headers

| Header | Description |
|--------|-------------|
| `ETag` | Entity tag for concurrency control |
| `Cache-Control` | `private, must-revalidate` |

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/users/user-123" \
  -H "If-None-Match: \"abc123\""
```

---

### Get User Metadata

**GET** `/apiv2/users/{id}/meta`

Retrieve metadata for a specific user without downloading the content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User identifier |

#### Response

```json
{
  "etag": "\"abc123def456\"",
  "size": 45,
  "lastModified": "2023-10-12T18:30:00.000Z"
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/users/user-123/meta"
```

---

### Create User

**POST** `/apiv2/users`

Create a new user with the specified ID, name, and external ID.

#### Request Body

```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

#### Field Validation

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | string | Yes | 1-128 chars, alphanumeric + dots, hyphens, underscores |
| `name` | string | Yes | 2-100 characters |
| `externalId` | number | Yes | Positive integer |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-None-Match` | string | No | Set to `*` to ensure user doesn't exist |

#### Response

**Success (201)**:
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

#### Response Headers

| Header | Description |
|--------|-------------|
| `Location` | URL of the created user |
| `ETag` | Entity tag for the created user |

#### Example

```bash
curl -X POST "https://api.example.com/apiv2/users" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{
    "id": "user-456",
    "name": "Jane Smith",
    "externalId": 2002
  }'
```

---

### Update User (Replace)

**PUT** `/apiv2/users/{id}`

Replace the entire user data.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User identifier |

#### Request Body

```json
{
  "name": "John Smith",
  "externalId": 1002
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure user hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "name": "John Smith",
  "externalId": 1002
}
```

#### Example

```bash
curl -X PUT "https://api.example.com/apiv2/users/user-123" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "name": "John Smith",
    "externalId": 1002
  }'
```

---

### Update User (Merge)

**PATCH** `/apiv2/users/{id}`

Partially update a user by merging new data with existing content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User identifier |

#### Request Body

```json
{
  "merge": true,
  "data": {
    "name": "John Smith"
  }
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure user hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "name": "John Smith",
  "externalId": 1001
}
```

#### Example

```bash
curl -X PATCH "https://api.example.com/apiv2/users/user-123" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "merge": true,
    "data": {
      "name": "John Smith"
    }
  }'
```

---

### Delete User

**DELETE** `/apiv2/users/{id}`

Delete a user permanently.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User identifier |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | ETag to ensure user hasn't been modified |

#### Response

**Success (204)**: No content

#### Example

```bash
curl -X DELETE "https://api.example.com/apiv2/users/user-123" \
  -H "If-Match: \"abc123\""
```

---

## Games API (`/apiv2/games`)

The Games API provides comprehensive management for game entities with rounds, moves, and player management.

### List Games

**GET** `/apiv2/games`

Retrieve a paginated list of all games.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum number of games to return (1-1000) |
| `cursor` | string | - | Base64-encoded cursor for pagination |
| `prefix` | string | - | Filter games by ID prefix |

#### Response

```json
{
  "names": ["game-001", "game-002", "tournament-123"],
  "nextCursor": "eyJuZXh0VG9rZW4iOiIxMjMifQ=="
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/games?limit=20"
```

---

### Get Game

**GET** `/apiv2/games/{id}`

Retrieve a specific game by ID.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier (alphanumeric, dots, hyphens, underscores, 1-128 chars) |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-None-Match` | string | No | ETag to check if game has been modified |

#### Response

**Success (200)**:
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
      "isFinished": false,
      "time": 1640995200000
    }
  ],
  "isFinished": false
}
```

**Not Modified (304)**: When `If-None-Match` matches current ETag

#### Response Headers

| Header | Description |
|--------|-------------|
| `ETag` | Entity tag for concurrency control |
| `Cache-Control` | `private, must-revalidate` |

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/games/game-123" \
  -H "If-None-Match: \"abc123\""
```

---

### Get Game Metadata

**GET** `/apiv2/games/{id}/meta`

Retrieve metadata for a specific game without downloading the content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Response

```json
{
  "etag": "\"abc123def456\"",
  "size": 1024,
  "lastModified": "2023-10-12T18:30:00.000Z"
}
```

#### Example

```bash
curl -X GET "https://api.example.com/apiv2/games/game-123/meta"
```

---

### Create Game

**POST** `/apiv2/games`

Create a new game with the specified ID, type, users, rounds, and status.

#### Request Body

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
      "isFinished": false,
      "time": 1640995200000
    }
  ],
  "isFinished": false
}
```

#### Field Validation

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | string | Yes | 1-128 chars, alphanumeric + dots, hyphens, underscores |
| `type` | string | Yes | 1-100 characters |
| `usersIds` | array | Yes | 1-10 user IDs, no duplicates |
| `rounds` | array | No | Array of round objects |
| `isFinished` | boolean | No | Default: false |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-None-Match` | string | No | Set to `*` to ensure game doesn't exist |

#### Response

**Success (201)**:
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
      "isFinished": false,
      "time": 1640995200000
    }
  ],
  "isFinished": false
}
```

#### Response Headers

| Header | Description |
|--------|-------------|
| `Location` | URL of the created game |
| `ETag` | Entity tag for the created game |

#### Example

```bash
curl -X POST "https://api.example.com/apiv2/games" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{
    "id": "tournament-456",
    "type": "championship",
    "usersIds": ["user-1", "user-2", "user-3"],
    "rounds": [],
    "isFinished": false
  }'
```

---

### Update Game (Replace)

**PUT** `/apiv2/games/{id}`

Replace the entire game data.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Request Body

```json
{
  "type": "championship",
  "usersIds": ["user-1", "user-2", "user-3"],
  "rounds": [
    {
      "id": "round-1",
      "moves": [],
      "isFinished": false
    }
  ],
  "isFinished": false
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "game-123",
  "type": "championship",
  "usersIds": ["user-1", "user-2", "user-3"],
  "rounds": [
    {
      "id": "round-1",
      "moves": [],
      "isFinished": false
    }
  ],
  "isFinished": false
}
```

#### Example

```bash
curl -X PUT "https://api.example.com/apiv2/games/game-123" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "type": "championship",
    "usersIds": ["user-1", "user-2", "user-3"],
    "rounds": [],
    "isFinished": false
  }'
```

---

### Update Game (Merge)

**PATCH** `/apiv2/games/{id}`

Partially update a game by merging new data with existing content.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Request Body

```json
{
  "type": "championship",
  "isFinished": true
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**:
```json
{
  "id": "game-123",
  "type": "championship",
  "usersIds": ["user-1", "user-2"],
  "rounds": [],
  "isFinished": true
}
```

#### Example

```bash
curl -X PATCH "https://api.example.com/apiv2/games/game-123" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "type": "championship",
    "isFinished": true
  }'
```

---

### Delete Game

**DELETE** `/apiv2/games/{id}`

Delete a game permanently.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (204)**: No content

#### Example

```bash
curl -X DELETE "https://api.example.com/apiv2/games/game-123" \
  -H "If-Match: \"abc123\""
```

---

## Game-Specific Operations

### Add Round to Game

**POST** `/apiv2/games/{id}/rounds`

Add a new round to an existing game.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Request Body

```json
{
  "id": "round-2",
  "moves": [],
  "isFinished": false,
  "time": 1640995200000
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**: Updated game with new round

#### Example

```bash
curl -X POST "https://api.example.com/apiv2/games/game-123/rounds" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "id": "round-2",
    "moves": [],
    "isFinished": false,
    "time": 1640995200000
  }'
```

---

### Add Move to Game Round

**POST** `/apiv2/games/{id}/rounds/{roundId}/moves`

Add a move to a specific round in a game.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |
| `roundId` | string | Yes | Round identifier |

#### Request Body

```json
{
  "id": "move-2",
  "userId": "user-2",
  "value": 20,
  "valueDecorated": "twenty"
}
```

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Content-Type` | string | Yes | Must be `application/json` |
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**: Updated game with new move

#### Example

```bash
curl -X POST "https://api.example.com/apiv2/games/game-123/rounds/round-1/moves" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "id": "move-2",
    "userId": "user-2",
    "value": 20,
    "valueDecorated": "twenty"
  }'
```

---

### Finish Game Round

**PATCH** `/apiv2/games/{id}/rounds/{roundId}/finish`

Mark a specific round as finished.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |
| `roundId` | string | Yes | Round identifier |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**: Updated game with finished round

#### Example

```bash
curl -X PATCH "https://api.example.com/apiv2/games/game-123/rounds/round-1/finish" \
  -H "If-Match: \"abc123\""
```

---

### Finish Game

**PATCH** `/apiv2/games/{id}/finish`

Mark the entire game as finished.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Game identifier |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | ETag to ensure game hasn't been modified |

#### Response

**Success (200)**: Updated game marked as finished

#### Example

```bash
curl -X PATCH "https://api.example.com/apiv2/games/game-123/finish" \
  -H "If-Match: \"abc123\""
```

---

## Error Responses

All errors follow the RFC 7807 problem+json format.

### Error Response Format

```json
{
  "type": "about:blank",
  "title": "Error Title",
  "status": 400,
  "detail": "Detailed error description",
  "instance": "/apiv2/files/invalid-id"
}
```

### HTTP Status Codes

| Status | Description | When Used |
|--------|-------------|-----------|
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

### Common Error Examples

#### Validation Error (400)

```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 400,
  "detail": "ID must contain only alphanumeric characters, dots, hyphens, and underscores",
  "instance": "/apiv2/files/invalid-id!"
}
```

#### Not Found Error (404)

```json
{
  "type": "about:blank",
  "title": "File Not Found",
  "status": 404,
  "detail": "Entity 'nonexistent-file' not found",
  "instance": "/apiv2/files/nonexistent-file"
}
```

#### Conflict Error (409)

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Entity 'existing-file' already exists",
  "instance": "/apiv2/files/existing-file"
}
```

#### Precondition Failed (412)

```json
{
  "type": "about:blank",
  "title": "Precondition Failed",
  "status": 412,
  "detail": "Entity 'file-123' ETag mismatch",
  "instance": "/apiv2/files/file-123"
}
```

---

## Concurrency Control

The API uses ETags for optimistic concurrency control:

### Reading with ETags

```bash
# Get file and capture ETag
curl -X GET "https://api.example.com/apiv2/files/config" \
  -i | grep ETag
# ETag: "abc123def456"

# Use ETag to avoid unnecessary downloads
curl -X GET "https://api.example.com/apiv2/files/config" \
  -H "If-None-Match: \"abc123def456\""
# Returns 304 Not Modified if unchanged
```

### Updating with ETags

```bash
# Update only if file hasn't changed
curl -X PUT "https://api.example.com/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123def456\"" \
  -d '{"new": "data"}'
# Returns 412 Precondition Failed if ETag doesn't match
```

### Creating with ETags

```bash
# Ensure file doesn't exist before creating
curl -X POST "https://api.example.com/apiv2/files/new-config" \
  -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{"initial": "data"}'
# Returns 409 Conflict if file already exists
```

---

## Pagination

List endpoints support cursor-based pagination:

### Using Pagination

```bash
# Get first page
curl -X GET "https://api.example.com/apiv2/files?limit=10"
# Response: {"names": [...], "nextCursor": "eyJuZXh0VG9rZW4iOiIxMjMifQ=="}

# Get next page using cursor
curl -X GET "https://api.example.com/apiv2/files?limit=10&cursor=eyJuZXh0VG9rZW4iOiIxMjMifQ=="
# Response: {"names": [...], "nextCursor": "..."}

# No nextCursor means you've reached the end
curl -X GET "https://api.example.com/apiv2/files?limit=10&cursor=finalCursor"
# Response: {"names": [...]} // No nextCursor field
```

---

## Rate Limiting

Currently, no rate limiting is implemented. All requests are processed immediately.

---

## File Storage Details

### File Locations

- **Regular JSON files**: Stored in `json/{id}.json`
- **User files**: Stored in `json/users/{id}.json`
- **Game files**: Stored in `json/games/{id}.json`
- **Files API**: Can read from both `json/` and `json/users/` locations automatically

### File Size Limits

- **Maximum file size**: 1MB (1,048,576 bytes)
- **Request body limit**: 1MB for POST, PUT, PATCH operations

### Supported Characters

- **File IDs**: Alphanumeric characters, dots (.), hyphens (-), underscores (_)
- **User names**: Any UTF-8 characters (2-100 length)
- **External IDs**: Positive integers
- **Game types**: Any UTF-8 characters (1-100 length)

---

## SDK Examples

### JavaScript/Node.js

```javascript
// Using fetch API
const response = await fetch('https://api.example.com/apiv2/files/config', {
  headers: {
    'If-None-Match': '"abc123"'
  }
});

if (response.status === 304) {
  console.log('File not modified');
} else {
  const data = await response.json();
  console.log('File data:', data.data);
}

// Creating a user
const userResponse = await fetch('https://api.example.com/apiv2/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'If-None-Match': '*'
  },
  body: JSON.stringify({
    id: 'user-123',
    name: 'John Doe',
    externalId: 1001
  })
});

const user = await userResponse.json();
console.log('Created user:', user);

// Creating a game
const gameResponse = await fetch('https://api.example.com/apiv2/games', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'If-None-Match': '*'
  },
  body: JSON.stringify({
    id: 'game-123',
    type: 'tournament',
    usersIds: ['user-1', 'user-2'],
    rounds: [],
    isFinished: false
  })
});

const game = await gameResponse.json();
console.log('Created game:', game);
```

### Python

```python
import requests
import json

# Get file with ETag check
headers = {'If-None-Match': '"abc123"'}
response = requests.get('https://api.example.com/apiv2/files/config', headers=headers)

if response.status_code == 304:
    print('File not modified')
else:
    data = response.json()
    print('File data:', data['data'])

# Create user
user_data = {
    'id': 'user-123',
    'name': 'John Doe',
    'externalId': 1001
}

response = requests.post(
    'https://api.example.com/apiv2/users',
    headers={
        'Content-Type': 'application/json',
        'If-None-Match': '*'
    },
    data=json.dumps(user_data)
)

user = response.json()
print('Created user:', user)

# Create game
game_data = {
    'id': 'game-123',
    'type': 'tournament',
    'usersIds': ['user-1', 'user-2'],
    'rounds': [],
    'isFinished': False
}

response = requests.post(
    'https://api.example.com/apiv2/games',
    headers={
        'Content-Type': 'application/json',
        'If-None-Match': '*'
    },
    data=json.dumps(game_data)
)

game = response.json()
print('Created game:', game)
```

### cURL Examples

```bash
# List all files
curl -X GET "https://api.example.com/apiv2/files"

# Get specific file
curl -X GET "https://api.example.com/apiv2/files/config"

# Create new file
curl -X POST "https://api.example.com/apiv2/files" \
  -H "Content-Type: application/json" \
  -d '{"id": "config", "data": {"setting": "value"}}'

# Update file with ETag
curl -X PUT "https://api.example.com/apiv2/files/config" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"setting": "new-value"}'

# Create user
curl -X POST "https://api.example.com/apiv2/users" \
  -H "Content-Type: application/json" \
  -d '{"id": "user-123", "name": "John Doe", "externalId": 1001}'

# Create game
curl -X POST "https://api.example.com/apiv2/games" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "game-123",
    "type": "tournament",
    "usersIds": ["user-1", "user-2"],
    "rounds": [],
    "isFinished": false
  }'

# Add round to game
curl -X POST "https://api.example.com/apiv2/games/game-123/rounds" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "id": "round-1",
    "moves": [],
    "isFinished": false,
    "time": 1640995200000
  }'

# Add move to round
curl -X POST "https://api.example.com/apiv2/games/game-123/rounds/round-1/moves" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{
    "id": "move-1",
    "userId": "user-1",
    "value": 10,
    "valueDecorated": "ten"
  }'

# Finish game
curl -X PATCH "https://api.example.com/apiv2/games/game-123/finish" \
  -H "If-Match: \"abc123\""

# Delete file
curl -X DELETE "https://api.example.com/apiv2/files/config" \
  -H "If-Match: \"abc123\""
```

---

## Changelog

### Version 2.2 (Current)

- ✅ **Round Time Property**: Added `time` property to Round class (Unix timestamp in milliseconds)
- ✅ **Enhanced Round Validation**: Comprehensive timestamp validation for Round entities
- ✅ **Backward Compatibility**: Existing data without time property uses current timestamp
- ✅ **Updated API Examples**: All documentation updated with time property examples
- ✅ **Complete Test Coverage**: All Round-related tests updated and passing

### Version 2.1

- ✅ **GameEntity Implementation**: Complete game management with rounds and moves
- ✅ **Game-Specific Operations**: Add rounds, moves, finish rounds/games
- ✅ **Comprehensive Validation**: Full validation for game data structures
- ✅ **Backing Store Pattern**: GameEntity uses JsonEntity for S3 storage
- ✅ **Immutable Operations**: Thread-safe game modifications
- ✅ **Enhanced Testing**: 226 tests covering all functionality

### Version 2.0

- ✅ **Unified Files API**: Files API can now read both regular JSON files and user files
- ✅ **Enhanced User Management**: Dedicated Users API with structured validation
- ✅ **Domain Architecture**: Clean separation of concerns with layered architecture
- ✅ **ETag Concurrency Control**: Full optimistic concurrency control support
- ✅ **RFC 7807 Error Format**: Standardized problem+json error responses
- ✅ **Comprehensive Testing**: 109 tests covering all functionality
- ✅ **CORS Support**: Cross-origin request handling
- ✅ **Pagination**: Cursor-based pagination for list endpoints

### Version 1.0

- ✅ Basic file CRUD operations
- ✅ JSON document storage
- ✅ S3 integration
- ✅ API Gateway deployment

---

## Support

For API support and questions, please refer to the project documentation or contact the development team.

---

*Last updated: October 25, 2025*
