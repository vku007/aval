# API Documentation Update Summary

**Date**: November 1, 2025  
**Updated File**: `apiv2/API_DOCUMENTATION.md`

## Overview

The API documentation has been comprehensively reviewed and updated to reflect the current state of the VKP REST API, including the newly implemented Games API.

## Major Changes

### 1. Base URL Updates
- **Added production URL**: `https://vkp-consulting.fr` (via CloudFront)
- **Added direct API Gateway URL**: `https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com` (for testing)
- **Replaced all example URLs**: Changed from generic `https://api.example.com` to actual production URLs

### 2. Games API Documentation (NEW)
Added complete documentation for the Games API (`/apiv2/games`), including:

#### Standard CRUD Operations
- **List Games**: `GET /apiv2/games`
- **Get Game**: `GET /apiv2/games/{id}`
- **Get Game Metadata**: `GET /apiv2/games/{id}/meta`
- **Create Game**: `POST /apiv2/games`
- **Update Game (Replace)**: `PUT /apiv2/games/{id}`
- **Update Game (Merge)**: `PATCH /apiv2/games/{id}`
- **Delete Game**: `DELETE /apiv2/games/{id}`

#### Game-Specific Operations
- **Add Round to Game**: `POST /apiv2/games/{id}/rounds`
- **Add Move to Round**: `POST /apiv2/games/{gameId}/rounds/{roundId}/moves`
- **Finish Round**: `PATCH /apiv2/games/{gameId}/rounds/{roundId}/finish`
- **Finish Game**: `PATCH /apiv2/games/{id}/finish`

#### Game Entity Structure
Documented the complete structure of games, rounds, and moves:

**Game Object**:
- `id`: string (1-128 chars, alphanumeric + dots, hyphens, underscores)
- `type`: string (1-100 characters)
- `usersIds`: string[] (1-10 unique user IDs)
- `rounds`: Round[] (array of round objects)
- `isFinished`: boolean

**Round Object**:
- `id`: string (1-128 chars, alphanumeric + dots, hyphens, underscores)
- `moves`: Move[] (array of move objects)
- `isFinished`: boolean
- `time`: number (Unix timestamp in milliseconds)

**Move Object**:
- `id`: string (1-128 chars, alphanumeric + dots, hyphens, underscores)
- `userId`: string (must be a valid user ID)
- `value`: number (finite number)
- `valueDecorated`: string (display representation)
- `time`: number (Unix timestamp in milliseconds)

### 3. API Endpoints Summary Table
Added a comprehensive table listing all available endpoints:
- 13 total endpoint patterns documented
- Includes Files API (7 endpoints)
- Includes Users API (7 endpoints)
- Includes Games API (11 endpoints)

### 4. Updated Descriptions
- **Overview**: Updated to mention "file, user, and game management"
- **Files API**: Updated to mention it can read from `json/`, `json/users/`, and `json/games/` folders
- **CORS**: Added `If-Match` and `If-None-Match` to allowed headers list
- **File Storage Details**: Added game files location (`json/games/{id}.json`)

### 5. Enhanced SDK Examples

#### JavaScript/Node.js
- Added game creation example
- Shows complete workflow: file → user → game

#### Python
- Added game creation example with proper Python syntax
- Demonstrates `False` boolean for Python

#### cURL
- Added game creation example
- Added "add round to game" example
- Shows practical multi-step game operations

### 6. Updated Changelog
- **Version 2.1 (Current)**: Added Games API features
  - Complete game management with rounds and moves
  - Game operations (add rounds, add moves, finish rounds, finish games)
  - Structured validation for games, rounds, and moves
  - Multi-user games (1-10 users per game)
  - Immutable game entities with functional approach

- **Version 2.0**: Updated to reflect all three entity types (files, users, games)

- **Last Updated**: Changed from "October 12, 2023" to "November 1, 2025"

## Technical Details

### Validation Rules Documented
- Game IDs: 1-128 characters, alphanumeric + dots, hyphens, underscores
- Game types: 1-100 characters
- User IDs per game: 1-10 unique IDs
- Round IDs: Same pattern as game IDs
- Move IDs: Same pattern as game IDs
- Move values: Must be finite numbers
- Timestamps: Unix timestamps in milliseconds (validated range)

### ETag Support
All game endpoints support ETag-based concurrency control:
- `If-Match` header for updates and deletes
- `If-None-Match` header for conditional creates and reads
- ETag returned in response headers

### Error Handling
All game endpoints follow RFC 7807 problem+json format:
- 400 Bad Request: Validation errors
- 404 Not Found: Game doesn't exist
- 409 Conflict: Game already exists (with If-None-Match: *)
- 412 Precondition Failed: ETag mismatch

## Files Modified
- `/Users/main/vkp/aval/apiv2/API_DOCUMENTATION.md` (1,711 lines)

## Documentation Quality Improvements
1. **Consistency**: All URLs now use production endpoints
2. **Completeness**: All implemented endpoints are documented
3. **Accuracy**: Reflects current codebase implementation
4. **Examples**: Practical, working examples for all major operations
5. **Structure**: Clear organization with consistent formatting

## Next Steps (Recommendations)
1. Consider adding OpenAPI/Swagger specification
2. Add sequence diagrams for complex game workflows
3. Document rate limiting when implemented
4. Add authentication documentation when implemented
5. Create a separate "Quick Start" guide for games
6. Add troubleshooting section for common game-related errors

## Verification
The documentation has been verified against:
- ✅ Source code in `/apiv2/src/`
- ✅ Route definitions in `/apiv2/src/index.ts`
- ✅ Entity models in `/apiv2/src/domain/entity/`
- ✅ DTOs in `/apiv2/src/application/dto/`
- ✅ Controllers in `/apiv2/src/presentation/controllers/`
- ✅ Infrastructure configuration in `/terraform/main.tf`

## Summary
The API documentation is now complete, accurate, and ready for use by developers integrating with the VKP REST API. All three major entity types (Files, Users, Games) are fully documented with examples, validation rules, and error handling details.

