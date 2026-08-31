# VKP REST API - Application Architecture Design

**Version**: 2.3  
**Last Updated**: November 1, 2025  
**Status**: Production  
**AWS Region**: eu-north-1

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Patterns](#architecture-patterns)
4. [Layered Architecture](#layered-architecture)
5. [Domain Model](#domain-model)
6. [Infrastructure Architecture](#infrastructure-architecture)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Scalability & Performance](#scalability--performance)
10. [Deployment Architecture](#deployment-architecture)
11. [Testing Strategy](#testing-strategy)
12. [Design Decisions](#design-decisions)

---

## Executive Summary

The VKP REST API is a serverless, domain-driven application built on AWS Lambda, providing comprehensive file, user, and game management capabilities. The system follows clean architecture principles with clear separation of concerns across domain, application, infrastructure, and presentation layers.

### Key Characteristics

- **Architecture Style**: Clean Architecture / Hexagonal Architecture
- **Deployment Model**: Serverless (AWS Lambda)
- **Data Storage**: S3-based document store
- **API Style**: RESTful HTTP API
- **Concurrency Control**: Optimistic locking with ETags
- **Error Handling**: RFC 7807 Problem Details
- **Testing**: 95%+ code coverage with unit and integration tests

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Runtime** | Node.js 20.x (ARM64) |
| **Language** | TypeScript 5.6+ |
| **Framework** | Custom lightweight framework |
| **Validation** | Zod 3.23+ |
| **Testing** | Vitest 2.0+ |
| **Build** | esbuild 0.23+ |
| **Infrastructure** | Terraform 1.13+ |
| **Cloud Platform** | AWS (Lambda, S3, API Gateway, CloudFront) |

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet Users                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Route53 DNS   │
                    │ vkp-consulting.fr│
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────────────┐
                    │    CloudFront CDN (Global)      │
                    │  - TLS Termination              │
                    │  - Edge Caching                 │
                    │  - DDoS Protection              │
                    └────┬──────────────────┬─────────┘
                         │                  │
              ┌──────────▼────────┐  ┌─────▼──────────────────┐
              │  S3 Static Site   │  │  API Gateway HTTP API  │
              │  (Origin 1)       │  │  (Origin 2)            │
              └───────────────────┘  └─────┬──────────────────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                    ┌─────────▼──────────┐   ┌─────────▼──────────┐
                    │  Lambda Simple     │   │  Lambda API v2     │
                    │  vkp-simple-service│   │  vkp-api2-service  │
                    │                    │   │                    │
                    │  - Basic CRUD      │   │  - Domain-Driven   │
                    │  - JSON files      │   │  - Clean Arch      │
                    │  - 128MB RAM       │   │  - 128MB RAM       │
                    │  - 3s timeout      │   │  - 3s timeout      │
                    └─────────┬──────────┘   └─────────┬──────────┘
                              │                        │
                              └────────────┬───────────┘
                                           │
                              ┌────────────▼────────────┐
                              │   S3 Data Bucket        │
                              │   data-1-088455116440   │
                              │                         │
                              │   json/                 │
                              │   ├── {file-id}.json    │
                              │   ├── users/            │
                              │   │   └── {user-id}.json│
                              │   └── games/            │
                              │       └── {game-id}.json│
                              └─────────────────────────┘
```

### System Context

The VKP REST API serves as a backend system for:

1. **File Management**: Generic JSON document storage and retrieval
2. **User Management**: Structured user entity operations
3. **Game Management**: Complex game state with rounds and moves
4. **Web Applications**: Static website hosted on S3
5. **External Integrations**: RESTful API for third-party systems

---

## Architecture Patterns

### 1. Clean Architecture (Primary Pattern)

The application follows Uncle Bob's Clean Architecture principles:

```
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                          │
│  (AWS Lambda, API Gateway, S3, CloudWatch)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  PRESENTATION LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Controllers  │  │  Middleware  │  │   Router     │     │
│  │              │  │              │  │              │     │
│  │ - Entity     │  │ - CORS       │  │ - HTTP       │     │
│  │ - User       │  │ - Content    │  │ - Routing    │     │
│  │ - Game       │  │ - Error      │  │ - Params     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Services    │  │     DTOs     │  │  Use Cases   │     │
│  │              │  │              │  │              │     │
│  │ - Entity     │  │ - Create     │  │ - List       │     │
│  │ - User       │  │ - Update     │  │ - Get        │     │
│  │ - Game       │  │ - Response   │  │ - Create     │     │
│  │              │  │              │  │ - Update     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     DOMAIN LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Entities    │  │ Value Objects│  │ Repositories │     │
│  │              │  │              │  │ (Interfaces) │     │
│  │ - JsonEntity │  │ - Round      │  │              │     │
│  │ - User       │  │ - Move       │  │ - IEntity    │     │
│  │ - GameEntity │  │              │  │   Repository │     │
│  │ - Game       │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Repositories │  │   Adapters   │  │   External   │     │
│  │              │  │              │  │              │     │
│  │ - S3Entity   │  │ - ApiGateway │  │ - AWS SDK    │     │
│  │ - S3User     │  │   Adapter    │  │ - S3 Client  │     │
│  │ - S3Game     │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles Applied**:

1. **Dependency Inversion**: Domain layer defines interfaces, infrastructure implements
2. **Single Responsibility**: Each layer has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Interface Segregation**: Small, focused interfaces
5. **Dependency Rule**: Dependencies point inward toward domain

### 2. Repository Pattern

Abstracts data persistence behind interfaces:

```typescript
// Domain Layer - Interface (Port)
interface IEntityRepository<T> {
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<ListResult<T>>;
  findByName(name: string, opts?: FindOptions): Promise<T | null>;
  save(entity: T, opts?: SaveOptions): Promise<T>;
  delete(name: string, opts?: SaveOptions): Promise<void>;
  getMetadata(name: string): Promise<EntityMetadata>;
  exists(name: string): Promise<boolean>;
}

// Infrastructure Layer - Implementation (Adapter)
class S3EntityRepository<T> implements IEntityRepository<T> {
  // S3-specific implementation
}
```

### 3. Factory Pattern

Entity creation through factory functions:

```typescript
// Entity factories for dependency injection
const entityFactory = (id, data, etag?, metadata?) => 
  new JsonEntity(id, data, etag, metadata);

const userFactory = (id, name, externalId, etag?, metadata?) => 
  User.create(id, name, externalId, etag, metadata);

const gameFactory = (id, type, usersIds, rounds, isFinished, etag?, metadata?) => 
  GameEntity.create(id, type, usersIds, rounds, isFinished, etag, metadata);
```

### 4. Adapter Pattern

Converts between external and internal representations:

```typescript
class ApiGatewayAdapter {
  // Convert API Gateway event to internal request
  static toRequest(event: APIGatewayProxyEventV2): HttpRequest {
    return {
      method: event.requestContext.http.method,
      path: event.rawPath,
      query: event.queryStringParameters || {},
      headers: event.headers || {},
      body: event.body ? JSON.parse(event.body) : null,
      params: event.pathParameters || {}
    };
  }

  // Convert internal response to API Gateway format
  static toApiGatewayResponse(
    response: HttpResponse, 
    corsOrigin: string
  ): APIGatewayProxyResultV2 {
    return {
      statusCode: response.statusCode,
      headers: { ...response.headers, 'Access-Control-Allow-Origin': corsOrigin },
      body: JSON.stringify(response.body)
    };
  }
}
```

### 5. Backing Store Pattern

Separates domain logic from persistence concerns:

```typescript
class GameEntity {
  private readonly _backed: JsonEntity;  // Backing store
  
  constructor(id, type, usersIds, rounds, isFinished, etag?, metadata?) {
    // Domain validation
    this.validateGameData(type, usersIds, rounds, isFinished);
    
    // Store in backing entity
    this._backed = new JsonEntity(id, gameData, etag, metadata);
  }
  
  // Domain operations
  addRound(round: Round): GameEntity {
    const game = this.toGame();
    const updatedGame = game.addRound(round);
    return this.fromGame(updatedGame);
  }
}
```

### 6. Immutable Entity Pattern

Entities are immutable; operations return new instances:

```typescript
class Round {
  constructor(
    public readonly id: string,
    public readonly moves: Move[],
    public readonly isFinished: boolean,
    public readonly time: number
  ) {}

  addMove(move: Move): Round {
    // Returns new Round instance
    return new Round(this.id, [...this.moves, move], this.isFinished, this.time);
  }

  finish(): Round {
    // Returns new Round instance
    return new Round(this.id, this.moves, true, this.time);
  }
}
```

---

## Layered Architecture

### Layer 1: Presentation Layer

**Responsibility**: HTTP request/response handling, routing, middleware

**Components**:

```
presentation/
├── controllers/
│   ├── EntityController.ts      # Generic file operations
│   ├── UserController.ts        # User-specific operations
│   └── GameController.ts        # Game-specific operations
├── middleware/
│   ├── cors.ts                  # CORS headers
│   ├── contentType.ts           # Content-Type validation
│   └── errorHandler.ts          # RFC 7807 error formatting
└── routing/
    └── Router.ts                # Route matching and middleware chain
```

**Key Responsibilities**:
- HTTP request parsing
- Route matching
- Parameter extraction
- Response formatting
- Error serialization
- CORS handling
- Content-Type validation

**Example Controller**:

```typescript
class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly logger: Logger
  ) {}

  async create(request: HttpRequest): Promise<HttpResponse> {
    try {
      const dto = CreateGameDto.fromRequest(request.body);
      const ifNoneMatch = request.headers['if-none-match'];
      
      const gameDto = await this.gameService.createGame(dto, ifNoneMatch);
      const metadata = await this.gameService.getGameMetadata(gameDto.id);
      
      return HttpResponse.created(gameDto.toJSON())
        .withETag(metadata.etag)
        .withLocation(`/apiv2/games/${gameDto.id}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path
        });
      }
      throw error;
    }
  }
}
```

### Layer 2: Application Layer

**Responsibility**: Business logic orchestration, use case implementation

**Components**:

```
application/
├── services/
│   ├── EntityService.ts         # Generic entity operations
│   ├── UserService.ts           # User business logic
│   └── GameService.ts           # Game business logic
└── dto/
    ├── CreateEntityDto.ts       # File creation DTO
    ├── CreateUserDto.ts         # User creation DTO
    ├── CreateGameDto.ts         # Game creation DTO
    ├── UpdateEntityDto.ts       # File update DTO
    ├── UpdateUserDto.ts         # User update DTO
    ├── UpdateGameDto.ts         # Game update DTO
    ├── EntityResponseDto.ts     # File response DTO
    ├── UserResponseDto.ts       # User response DTO
    ├── GameResponseDto.ts       # Game response DTO
    └── ListResponseDto.ts       # Pagination response DTO
```

**Key Responsibilities**:
- Use case implementation
- Business rule enforcement
- Transaction coordination
- DTO transformation
- Validation orchestration
- Logging and monitoring

**Example Service**:

```typescript
class GameService {
  constructor(private readonly repository: S3GameRepository) {}

  async createGame(dto: CreateGameDto, ifNoneMatch?: string): Promise<GameResponseDto> {
    // Convert DTO to domain entity
    const rounds = dto.rounds.map(r => 
      new Round(r.id, r.moves.map(m => new Move(...)), r.isFinished, r.time)
    );
    
    const game = GameEntity.create(
      dto.id, dto.type, dto.usersIds, rounds, dto.isFinished
    );

    // Save through repository
    const savedGame = await this.repository.save(game, { ifNoneMatch });

    // Convert to response DTO
    return GameResponseDto.fromGameEntity(savedGame);
  }

  async addRoundToGame(
    gameId: string, 
    round: Round, 
    ifMatch?: string
  ): Promise<GameResponseDto> {
    // Load existing game
    const game = await this.repository.findByName(gameId);
    if (!game) throw new NotFoundError(`Game '${gameId}' not found`);

    // Domain operation (immutable)
    const updatedGame = game.addRound(round);

    // Save updated game
    const savedGame = await this.repository.save(updatedGame, { ifMatch });

    return GameResponseDto.fromGameEntity(savedGame);
  }
}
```

### Layer 3: Domain Layer

**Responsibility**: Core business entities, domain logic, business rules

**Components**:

```
domain/
├── entity/
│   ├── BaseEntity.ts            # Abstract base entity
│   ├── JsonEntity.ts            # Generic JSON document
│   ├── User.ts                  # UserEntity (persistence + conversion)
│   ├── UserProfile.ts           # UserProfile (pure domain logic)
│   ├── GameEntity.ts            # Game aggregate root
│   └── Game.ts                  # Game domain logic
├── value-object/
│   ├── Round.ts                 # Round value object
│   └── Move.ts                  # Move value object
└── repository/
    └── IEntityRepository.ts     # Repository interface (port)
```

**Key Responsibilities**:
- Business rule enforcement
- Domain invariants
- Entity lifecycle
- Value object immutability
- Domain events (future)

**Entity Hierarchy**:

```
BaseEntity (abstract)
├── JsonEntity (generic document)
├── UserEntity (structured entity)
│   └── UserProfile (domain logic)
└── GameEntity (complex aggregate)
    └── Game (domain logic)
        ├── Round[] (value objects)
        └── Move[] (value objects)
```

**Example Domain Entity**:

```typescript
class GameEntity {
  private readonly _backed: JsonEntity;

  constructor(
    id: string,
    type: string,
    usersIds: string[],
    rounds: Round[],
    isFinished: boolean,
    etag?: string,
    metadata?: EntityMetadata
  ) {
    // Domain validation (invariants)
    this.validateId(id);
    this.validateType(type);
    this.validateUsersIds(usersIds);  // 1-10 users, unique IDs
    this.validateRounds(rounds);
    this.validateIsFinished(isFinished);
    
    // Store in backing entity
    const gameData = { type, usersIds, rounds: this.serializeRounds(rounds), isFinished };
    this._backed = new JsonEntity(id, gameData, etag, metadata);
  }

  // Domain operations (immutable)
  addRound(round: Round): GameEntity {
    const game = this.toGame();
    const updatedGame = game.addRound(round);
    return this.fromGame(updatedGame);
  }

  finishRound(roundId: string): GameEntity {
    const game = this.toGame();
    const updatedGame = game.finishRound(roundId);
    return this.fromGame(updatedGame);
  }

  // Domain queries
  hasUser(userId: string): boolean {
    return this.usersIds.includes(userId);
  }

  getRound(roundId: string): Round | undefined {
    return this.rounds.find(r => r.id === roundId);
  }
}
```

### Layer 4: Infrastructure Layer

**Responsibility**: External system integration, persistence, AWS SDK

**Components**:

```
infrastructure/
├── persistence/
│   ├── S3EntityRepository.ts    # S3 implementation for generic entities
│   ├── S3UserRepository.ts      # S3 implementation for users
│   └── S3GameRepository.ts      # S3 implementation for games
└── http/
    ├── ApiGatewayAdapter.ts     # API Gateway event conversion
    └── HttpTypes.ts             # HTTP type definitions
```

**Key Responsibilities**:
- AWS S3 operations
- Data serialization/deserialization
- ETag management
- Error translation
- API Gateway integration

**Example Repository Implementation**:

```typescript
class S3GameRepository implements IEntityRepository<GameEntity> {
  constructor(
    private readonly s3Client: S3Client,
    private readonly config: Config,
    private readonly entityFactory: GameFactory
  ) {}

  async save(entity: GameEntity, opts?: SaveOptions): Promise<GameEntity> {
    const key = `${this.config.jsonPrefix}games/${entity.id}.json`;
    
    // Check preconditions
    if (opts?.ifNoneMatch === '*') {
      const exists = await this.exists(entity.id);
      if (exists) throw new ConflictError(`Game '${entity.id}' already exists`);
    }
    
    if (opts?.ifMatch) {
      const metadata = await this.getMetadata(entity.id);
      if (metadata.etag !== opts.ifMatch) {
        throw new PreconditionFailedError(`Game '${entity.id}' ETag mismatch`);
      }
    }

    // Serialize and save
    const backed = entity.internalGetBackingStore();
    const body = JSON.stringify(backed.data);
    
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: body,
      ContentType: 'application/json'
    });

    const response = await this.s3Client.send(command);
    
    // Return entity with new ETag
    return this.entityFactory(
      entity.id,
      entity.type,
      entity.usersIds,
      entity.rounds,
      entity.isFinished,
      response.ETag,
      { etag: response.ETag, size: body.length, lastModified: new Date().toISOString() }
    );
  }

  async findByName(name: string, opts?: FindOptions): Promise<GameEntity | null> {
    const key = `${this.config.jsonPrefix}games/${name}.json`;
    
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      IfNoneMatch: opts?.ifNoneMatch
    });

    try {
      const response = await this.s3Client.send(command);
      const body = await response.Body?.transformToString();
      const data = JSON.parse(body || '{}');
      
      return GameEntity.fromJSON({
        id: name,
        ...data,
        etag: response.ETag,
        metadata: {
          etag: response.ETag,
          size: response.ContentLength,
          lastModified: response.LastModified?.toISOString()
        }
      });
    } catch (error) {
      if (error.name === 'NoSuchKey') return null;
      if (error.name === 'NotModified') throw new NotModifiedError();
      throw error;
    }
  }
}
```

### Layer 5: Shared Layer

**Responsibility**: Cross-cutting concerns, utilities

**Components**:

```
shared/
├── errors/
│   ├── ApplicationError.ts      # Base error class
│   ├── ValidationError.ts       # 400 Bad Request
│   ├── NotFoundError.ts         # 404 Not Found
│   ├── ConflictError.ts         # 409 Conflict
│   ├── PreconditionFailedError.ts  # 412 Precondition Failed
│   └── ...
├── logging/
│   └── Logger.ts                # Structured logging
└── types/
    └── common.ts                # Shared type definitions
```

**Error Hierarchy**:

```
ApplicationError (base)
├── ValidationError (400)
├── NotFoundError (404)
├── ConflictError (409)
├── PreconditionFailedError (412)
├── PreconditionRequiredError (428)
├── PayloadTooLargeError (413)
├── UnsupportedMediaTypeError (415)
└── NotModifiedError (304)
```

---

## Domain Model

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BaseEntity                            │
│  (Abstract)                                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ + id: string                                        │    │
│  │ + metadata?: EntityMetadata                         │    │
│  │ + toJSON(): object                                  │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────┬─────────────────────────────────────────────┘
                │
      ┌─────────┴──────────┬──────────────────┐
      │                    │                  │
┌─────▼──────────┐  ┌──────▼──────┐  ┌───────▼────────────┐
│  JsonEntity    │  │    User     │  │   GameEntity       │
│                │  │             │  │                    │
│ + id: string   │  │ + id        │  │ + id: string       │
│ + data: JSON   │  │ + name      │  │ + type: string     │
│ + etag?        │  │ + externalId│  │ + usersIds: str[]  │
│ + metadata?    │  │ + etag?     │  │ + rounds: Round[]  │
│                │  │ + metadata? │  │ + isFinished: bool │
│                │  │             │  │ + etag?            │
│                │  │             │  │ + metadata?        │
└────────────────┘  └─────────────┘  └─────┬──────────────┘
                                            │
                                            │ contains
                                            │
                                     ┌──────▼──────────┐
                                     │     Round       │
                                     │  (Value Object) │
                                     │                 │
                                     │ + id: string    │
                                     │ + moves: Move[] │
                                     │ + isFinished    │
                                     │ + time: number  │
                                     └─────┬───────────┘
                                           │
                                           │ contains
                                           │
                                     ┌─────▼──────────┐
                                     │      Move      │
                                     │ (Value Object) │
                                     │                │
                                     │ + id: string   │
                                     │ + userId: str  │
                                     │ + value: num   │
                                     │ + valueDecorated│
                                     │ + time: number │
                                     └────────────────┘
```

### Aggregate Boundaries

**GameEntity Aggregate**:
- **Root**: GameEntity
- **Entities**: Game (internal domain logic)
- **Value Objects**: Round, Move
- **Invariants**:
  - Game must have 1-10 unique users
  - Rounds must have valid IDs
  - Moves must belong to game users
  - Finished games cannot be modified

**User Aggregate**:
- **Root**: User
- **Invariants**:
  - Name must be 2-100 characters
  - External ID must be positive integer
  - ID must be unique

**JsonEntity Aggregate**:
- **Root**: JsonEntity
- **Invariants**:
  - Data must be valid JSON
  - Size must be ≤ 1MB

### Domain Events (Future Enhancement)

```typescript
// Planned domain events
interface GameCreated {
  gameId: string;
  type: string;
  userIds: string[];
  timestamp: number;
}

interface RoundAdded {
  gameId: string;
  roundId: string;
  timestamp: number;
}

interface GameFinished {
  gameId: string;
  timestamp: number;
}
```

---

## Infrastructure Architecture

### AWS Resource Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Cloud (eu-north-1)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              CloudFront (Global)                    │    │
│  │  Distribution ID: EJWBLACWDMFAZ                     │    │
│  │  - TLS 1.2+                                         │    │
│  │  - OAC: E3QY4UMB9YVA18                             │    │
│  │  - Cache Policy: CachingOptimized (static)         │    │
│  │  - Cache Policy: CachingDisabled (API)             │    │
│  └──────────┬─────────────────────────┬────────────────┘    │
│             │                         │                     │
│  ┌──────────▼──────────┐   ┌──────────▼──────────────┐    │
│  │  S3: vkp-consulting │   │  API Gateway HTTP API    │    │
│  │  - Static website   │   │  ID: wmrksdxxml          │    │
│  │  - OAC access only  │   │  - CORS enabled          │    │
│  │  - ~100MB           │   │  - CloudWatch logs       │    │
│  └─────────────────────┘   └──────────┬───────────────┘    │
│                                       │                     │
│                          ┌────────────┴────────────┐       │
│                          │                         │       │
│              ┌───────────▼──────────┐  ┌──────────▼──────┐│
│              │ Lambda: vkp-simple   │  │ Lambda: vkp-api2││
│              │ - Runtime: Node 20   │  │ - Runtime: Node20││
│              │ - Arch: ARM64        │  │ - Arch: ARM64   ││
│              │ - Memory: 128MB      │  │ - Memory: 128MB ││
│              │ - Timeout: 3s        │  │ - Timeout: 3s   ││
│              │ - Role: vkp-simple-  │  │ - Role: vkp-api2││
│              │   service-role       │  │   -service-role ││
│              └───────────┬──────────┘  └──────────┬──────┘│
│                          │                        │       │
│                          └────────────┬───────────┘       │
│                                       │                   │
│                          ┌────────────▼────────────┐      │
│                          │  S3: data-1-088455116440│      │
│                          │  - Bucket policy        │      │
│                          │  - HTTPS only           │      │
│                          │  - ~50MB                │      │
│                          │                         │      │
│                          │  json/                  │      │
│                          │  ├── *.json             │      │
│                          │  ├── users/             │      │
│                          │  │   └── *.json         │      │
│                          │  └── games/             │      │
│                          │      └── *.json         │      │
│                          └─────────────────────────┘      │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │           CloudWatch Logs                           │  │
│  │  - /aws/lambda/vkp-api2-service (7 days)          │  │
│  │  - /aws/lambda/vkp-simple-service (7 days)        │  │
│  │  - /aws/apigateway/vkp-http-api (7 days)          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Route53 Hosted Zone                    │  │
│  │  - A record: vkp-consulting.fr → CloudFront        │  │
│  │  - AAAA record: vkp-consulting.fr → CloudFront     │  │
│  │  - A record: www.vkp-consulting.fr → CloudFront    │  │
│  │  - AAAA record: www.vkp-consulting.fr → CloudFront │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### S3 Bucket Structure

```
s3://data-1-088455116440/
└── json/
    ├── {file-id}.json              # Generic JSON files
    ├── users/
    │   ├── user-001.json           # User entities
    │   ├── user-002.json
    │   └── ...
    └── games/
        ├── game-001.json           # Game entities
        ├── game-002.json
        └── ...
```

**File Format Example** (Game):

```json
{
  "type": "poker",
  "usersIds": ["user-001", "user-002"],
  "rounds": [
    {
      "id": "round-1",
      "moves": [
        {
          "id": "move-1",
          "userId": "user-001",
          "value": 10,
          "valueDecorated": "10♠",
          "time": 1697123456789
        }
      ],
      "isFinished": false,
      "time": 1697123456789
    }
  ],
  "isFinished": false
}
```

### IAM Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                  IAM Roles & Policies                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  vkp-api2-service-role                             │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ Managed Policy:                              │ │    │
│  │  │ - AWSLambdaBasicExecutionRole                │ │    │
│  │  │   • logs:CreateLogGroup                      │ │    │
│  │  │   • logs:CreateLogStream                     │ │    │
│  │  │   • logs:PutLogEvents                        │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ Inline Policy: S3 Access                     │ │    │
│  │  │ - s3:GetObject (json/*)                      │ │    │
│  │  │ - s3:PutObject (json/*)                      │ │    │
│  │  │ - s3:DeleteObject (json/*)                   │ │    │
│  │  │ - s3:ListBucket (prefix: json/*)             │ │    │
│  │  │ - s3:PutObjectTagging (json/*)               │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  S3 Bucket Policy: data-1-088455116440             │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ Statement 1: Deny Insecure Transport        │ │    │
│  │  │ - Effect: Deny                               │ │    │
│  │  │ - Condition: aws:SecureTransport = false     │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ Statement 2: Allow Lambda List               │ │    │
│  │  │ - Principal: vkp-api2-service-role           │ │    │
│  │  │ - Action: s3:ListBucket                      │ │    │
│  │  │ - Condition: s3:prefix = json/*              │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ Statement 3: Allow Lambda CRUD               │ │    │
│  │  │ - Principal: vkp-api2-service-role           │ │    │
│  │  │ - Actions: GetObject, PutObject, Delete...   │ │    │
│  │  │ - Resource: json/*                           │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Request Flow: Create Game

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. POST /apiv2/games
     │    Content-Type: application/json
     │    If-None-Match: *
     │    Body: { id, type, usersIds, rounds, isFinished }
     │
┌────▼──────────────────────────────────────────────────────┐
│  CloudFront CDN                                            │
│  - TLS termination                                         │
│  - Forward to API Gateway (no caching for POST)           │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  API Gateway HTTP API                                      │
│  - Route: ANY /apiv2/{proxy+}                             │
│  - Integration: Lambda (vkp-api2-service)                 │
│  - CORS: Add headers                                       │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Lambda Handler (index.ts)                                 │
│  1. ApiGatewayAdapter.toRequest(event)                    │
│  2. Router.handle(request)                                │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Middleware Chain                                          │
│  1. corsMiddleware() - Add CORS headers                   │
│  2. contentTypeMiddleware() - Validate Content-Type       │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  GameController.create()                                   │
│  1. Extract request body                                   │
│  2. Extract If-None-Match header                          │
│  3. Call gameService.createGame(dto, ifNoneMatch)         │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  GameService.createGame()                                  │
│  1. CreateGameDto.fromRequest(body) - Zod validation      │
│  2. Convert DTO to domain entities (Round, Move)          │
│  3. GameEntity.create() - Domain validation               │
│  4. repository.save(game, { ifNoneMatch })                │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  S3GameRepository.save()                                   │
│  1. Check ifNoneMatch precondition                        │
│  2. Serialize GameEntity to JSON                          │
│  3. PutObjectCommand to S3                                │
│  4. Return GameEntity with new ETag                       │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  S3 Bucket: data-1-088455116440                           │
│  - Key: json/games/{game-id}.json                         │
│  - Content-Type: application/json                         │
│  - Returns: ETag, ContentLength, LastModified             │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  GameService (continued)                                   │
│  1. Convert GameEntity to GameResponseDto                 │
│  2. Return DTO to controller                              │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  GameController (continued)                                │
│  1. Get metadata for ETag                                 │
│  2. Build HttpResponse                                     │
│     - Status: 201 Created                                  │
│     - Headers: ETag, Location                             │
│     - Body: GameResponseDto.toJSON()                      │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Lambda Handler (continued)                                │
│  1. ApiGatewayAdapter.toApiGatewayResponse()              │
│  2. Add CORS headers                                       │
│  3. Return to API Gateway                                  │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  API Gateway → CloudFront → Client                        │
│  Response:                                                 │
│  - Status: 201 Created                                     │
│  - Headers:                                                │
│    • ETag: "abc123def456"                                 │
│    • Location: /apiv2/games/game-123                      │
│    • Access-Control-Allow-Origin: https://vkp-consulting.fr│
│  - Body: { id, type, usersIds, rounds, isFinished }       │
└───────────────────────────────────────────────────────────┘
```

### Error Flow: Validation Error

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /apiv2/games
     │ Body: { id: "", type: "poker" }  // Invalid: empty ID
     │
     ↓ (same path as success until...)
     │
┌────▼──────────────────────────────────────────────────────┐
│  CreateGameDto.fromRequest()                               │
│  - Zod validation fails                                    │
│  - Throws ValidationError("ID is required")               │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  GameController.create() - catch block                     │
│  - Catch ValidationError                                   │
│  - Build RFC 7807 error response                          │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Client receives:                                          │
│  Status: 400 Bad Request                                   │
│  Content-Type: application/problem+json                    │
│  Body: {                                                   │
│    "type": "about:blank",                                  │
│    "title": "Validation Error",                           │
│    "status": 400,                                          │
│    "detail": "Validation failed: id: ID is required",     │
│    "instance": "/apiv2/games"                             │
│  }                                                         │
└───────────────────────────────────────────────────────────┘
```

### Concurrency Control Flow: ETag Mismatch

```
┌──────────┐
│ Client A │
└────┬─────┘
     │ 1. GET /apiv2/games/game-123
     │    Response: ETag: "v1"
     │
┌────┴─────┐
│ Client B │
└────┬─────┘
     │ 2. GET /apiv2/games/game-123
     │    Response: ETag: "v1"
     │
     │ 3. PUT /apiv2/games/game-123
     │    If-Match: "v1"
     │    Body: { type: "poker-updated", ... }
     │    Response: 200 OK, ETag: "v2"
     │
┌────┴─────┐
│ Client A │
└────┬─────┘
     │ 4. PUT /apiv2/games/game-123
     │    If-Match: "v1"  // Stale ETag!
     │    Body: { type: "poker-modified", ... }
     │
┌────▼──────────────────────────────────────────────────────┐
│  S3GameRepository.save()                                   │
│  1. Get current metadata                                   │
│  2. Current ETag: "v2"                                     │
│  3. Provided If-Match: "v1"                               │
│  4. Mismatch detected!                                     │
│  5. Throw PreconditionFailedError                         │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Client A receives:                                        │
│  Status: 412 Precondition Failed                          │
│  Content-Type: application/problem+json                    │
│  Body: {                                                   │
│    "type": "about:blank",                                  │
│    "title": "Precondition Failed",                        │
│    "status": 412,                                          │
│    "detail": "Game 'game-123' ETag mismatch",            │
│    "instance": "/apiv2/games/game-123"                    │
│  }                                                         │
│                                                            │
│  → Client A must:                                          │
│     1. GET game-123 again (get ETag "v2")                 │
│     2. Merge changes                                       │
│     3. PUT with If-Match: "v2"                            │
└───────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - HTTPS Only (TLS 1.2+)                               │  │
│  │ - CloudFront DDoS Protection                          │  │
│  │ - Route53 DNS Security                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Application Security                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - CORS Policy (vkp-consulting.fr only)                │  │
│  │ - Content-Type Validation                             │  │
│  │ - Input Validation (Zod schemas)                      │  │
│  │ - Size Limits (1MB max payload)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Identity & Access Management                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - IAM Roles (Least Privilege)                         │  │
│  │ - S3 Bucket Policies                                  │  │
│  │ - Lambda Execution Roles                              │  │
│  │ - CloudFront OAC                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Data Security                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - S3 Encryption at Rest (AES-256)                     │  │
│  │ - HTTPS Encryption in Transit                         │  │
│  │ - ETag Concurrency Control                            │  │
│  │ - No Public S3 Access                                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Monitoring & Audit                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - CloudWatch Logs (7 days retention)                  │  │
│  │ - Structured Logging                                  │  │
│  │ - Request/Response Logging                            │  │
│  │ - Error Tracking                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Input Validation Strategy

```typescript
// Layer 1: Schema Validation (Zod)
const CreateGameSchema = z.object({
  id: z.string()
    .min(1, 'Game ID is required')
    .max(128, 'Game ID must be 128 characters or less')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid characters in ID'),
  
  type: z.string()
    .min(1, 'Game type is required')
    .max(100, 'Game type must be 100 characters or less'),
  
  usersIds: z.array(z.string())
    .min(1, 'Game must have at least one user')
    .max(10, 'Game cannot have more than 10 users')
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate user IDs'),
  
  rounds: z.array(RoundSchema).default([]),
  isFinished: z.boolean().default(false)
});

// Layer 2: Domain Validation
class GameEntity {
  private validateUsersIds(usersIds: string[]): void {
    if (!Array.isArray(usersIds)) {
      throw new ValidationError('Game usersIds must be an array');
    }
    if (usersIds.length === 0) {
      throw new ValidationError('Game must have at least one user');
    }
    if (usersIds.length > 10) {
      throw new ValidationError('Game cannot have more than 10 users');
    }
    // Validate each user ID format
    usersIds.forEach((userId, index) => {
      if (!/^[a-zA-Z0-9._-]{1,128}$/.test(userId)) {
        throw new ValidationError(`Invalid user ID at index ${index}`);
      }
    });
    // Check for duplicates
    const uniqueIds = new Set(usersIds);
    if (uniqueIds.size !== usersIds.length) {
      throw new ValidationError('Game cannot have duplicate user IDs');
    }
  }
}

// Layer 3: Middleware Validation
function contentTypeMiddleware() {
  return (request: HttpRequest): HttpResponse | null => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return HttpResponse.unsupportedMediaType({
          type: 'about:blank',
          title: 'Unsupported Media Type',
          status: 415,
          detail: 'Content-Type must be application/json',
          instance: request.path
        });
      }
    }
    return null; // Continue to next middleware
  };
}
```

### CORS Configuration

```typescript
// Middleware: cors.ts
export function corsMiddleware(config: Config) {
  return (request: HttpRequest): HttpResponse | null => {
    const origin = request.headers['origin'];
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return HttpResponse.noContent()
        .withHeader('Access-Control-Allow-Origin', config.cors.allowedOrigin)
        .withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        .withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-Match, If-None-Match')
        .withHeader('Access-Control-Max-Age', '3600');
    }
    
    // All responses get CORS headers
    return null; // Headers added in ApiGatewayAdapter
  };
}

// API Gateway Configuration (Terraform)
cors_configuration {
  allow_origins = ["https://vkp-consulting.fr", "https://www.vkp-consulting.fr"]
  allow_methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  allow_headers = ["content-type", "authorization", "if-match", "if-none-match"]
  max_age       = 0  // No caching of preflight responses
}
```

---

## Scalability & Performance

### Performance Characteristics

| Metric | Cold Start | Warm Start | Target |
|--------|-----------|------------|--------|
| **Lambda Duration** | ~800ms | ~100-300ms | <500ms (warm) |
| **API Gateway Latency** | ~50ms | ~50ms | <100ms |
| **S3 Operation** | ~50-200ms | ~50-200ms | <200ms |
| **Total Response Time** | ~900-1050ms | ~200-550ms | <1000ms |

### Scalability Limits

| Resource | Current Limit | AWS Limit | Scalability |
|----------|--------------|-----------|-------------|
| **Lambda Concurrent Executions** | 10 (reserved) | 1000 (account) | Horizontal |
| **API Gateway RPS** | Unlimited | 10,000/sec (account) | Horizontal |
| **S3 Requests** | Unlimited | 5,500 GET/sec per prefix | Horizontal |
| **CloudFront RPS** | Unlimited | Unlimited | Global CDN |
| **Lambda Memory** | 128MB | 10,240MB | Vertical |
| **Lambda Timeout** | 3s | 900s | Vertical |

### Optimization Strategies

#### 1. Cold Start Mitigation

```typescript
// Strategy: Lazy initialization of services
let s3Client: S3Client;
let entityService: EntityService;

function initializeServices() {
  if (!s3Client) {
    s3Client = new S3Client({ region: config.aws.region });
    entityRepository = new S3EntityRepository(s3Client, config, entityFactory);
    entityService = new EntityService(entityRepository, logger);
  }
}

// Strategy: Keep Lambda warm (future)
// - Scheduled CloudWatch Events to invoke Lambda every 5 minutes
// - Provisioned Concurrency for critical functions
```

#### 2. S3 Performance Optimization

```typescript
// Strategy: Prefix-based partitioning
const key = `${config.jsonPrefix}games/${gameId}.json`;
// Distributes load across S3 partitions

// Strategy: Parallel operations
async function listAllEntities(): Promise<Entity[]> {
  const [files, users, games] = await Promise.all([
    listFiles('json/'),
    listFiles('json/users/'),
    listFiles('json/games/')
  ]);
  return [...files, ...users, ...games];
}
```

#### 3. CloudFront Caching

```hcl
# Static content: Cache for 1 day
cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized

# API requests: No caching
cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
```

#### 4. ETag-based Conditional Requests

```typescript
// Client-side caching with ETags
const response = await fetch('/apiv2/games/game-123', {
  headers: { 'If-None-Match': storedETag }
});

if (response.status === 304) {
  // Use cached data
  return cachedGame;
}

// Update cache
const game = await response.json();
storedETag = response.headers.get('ETag');
```

### Monitoring & Alerting

```typescript
// Structured logging for performance tracking
logger.info('Request completed', {
  method: request.method,
  path: request.path,
  status: response.statusCode,
  duration_ms: Date.now() - startTime,
  cold_start: !s3Client,
  memory_used_mb: process.memoryUsage().heapUsed / 1024 / 1024
});

// CloudWatch Metrics (automatic)
// - Lambda: Invocations, Duration, Errors, Throttles, ConcurrentExecutions
// - API Gateway: Count, 4XXError, 5XXError, Latency, IntegrationLatency
// - S3: AllRequests, GetRequests, PutRequests, BytesDownloaded
```

---

## Deployment Architecture

### Infrastructure as Code (Terraform)

```
terraform/
├── main.tf                      # Main configuration
├── variables.tf                 # Input variables
├── outputs.tf                   # Output values
├── backend.tf                   # Remote state configuration
├── versions.tf                  # Provider versions
│
├── modules/
│   ├── s3-bucket/              # S3 bucket module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── lambda-function/        # Lambda function module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── iam.tf
│   │
│   ├── apigateway-http/        # API Gateway module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── cloudfront/             # CloudFront module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   └── route53/                # Route53 module
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
└── scripts/
    ├── setup-backend.sh        # Initialize Terraform backend
    ├── plan.sh                 # Run terraform plan
    └── apply.sh                # Run terraform apply
```

### Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  1. Code Changes                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Developer commits to Git                              │  │
│  │ - TypeScript source code                              │  │
│  │ - Tests                                                │  │
│  │ - Documentation                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  2. Local Testing                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ npm test                                              │  │
│  │ - Unit tests (Vitest)                                 │  │
│  │ - Integration tests                                   │  │
│  │ - Coverage report (95%+)                              │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  3. Build                                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ npm run build                                         │  │
│  │ - esbuild compilation                                 │  │
│  │ - TypeScript → JavaScript (ES modules)                │  │
│  │ - Tree shaking                                        │  │
│  │ - Minification                                        │  │
│  │ Output: dist/index.mjs                                │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  4. Package                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ npm run zip                                           │  │
│  │ - Create lambda.zip                                   │  │
│  │ - Include dist/index.mjs                              │  │
│  │ - Include node_modules (AWS SDK v3)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  5. Deploy Infrastructure (if needed)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ cd terraform                                          │  │
│  │ terraform plan                                        │  │
│  │ terraform apply                                       │  │
│  │ - Create/update S3 buckets                            │  │
│  │ - Create/update Lambda functions                      │  │
│  │ - Create/update API Gateway                           │  │
│  │ - Create/update CloudFront                            │  │
│  │ - Create/update Route53                               │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  6. Deploy Lambda Code                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ./buildAndDeploy.sh                                   │  │
│  │ OR                                                     │  │
│  │ terraform apply -target=module.lambda_api2            │  │
│  │ - Upload lambda.zip to Lambda                         │  │
│  │ - Update function code                                │  │
│  │ - Publish new version                                 │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  7. Smoke Tests                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ curl https://vkp-consulting.fr/apiv2/files            │  │
│  │ ./test-game-api.sh                                    │  │
│  │ - Verify endpoints respond                            │  │
│  │ - Check error handling                                │  │
│  │ - Validate response format                            │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  8. Monitor                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ aws logs tail /aws/lambda/vkp-api2-service --follow   │  │
│  │ - Watch for errors                                    │  │
│  │ - Monitor performance                                 │  │
│  │ - Track cold starts                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Rollback Strategy

```bash
# 1. Rollback Lambda code
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --s3-bucket backups \
  --s3-key lambda-backup-v2.0.0.zip

# 2. Rollback infrastructure (if needed)
cd terraform
git checkout previous-version
terraform apply

# 3. Verify rollback
curl https://vkp-consulting.fr/apiv2/files
./test-game-api.sh
```

### Blue-Green Deployment (Future)

```
┌─────────────────────────────────────────────────────────────┐
│  Blue Environment (Current Production)                       │
│  - Lambda: vkp-api2-service (version N)                     │
│  - API Gateway: Route to Blue Lambda                         │
│  - Serving 100% of traffic                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Green Environment (New Version)                             │
│  - Lambda: vkp-api2-service-green (version N+1)             │
│  - API Gateway: Route to Green Lambda (0% traffic)           │
│  - Run smoke tests                                           │
└─────────────────────────────────────────────────────────────┘

                    ↓ Gradual traffic shift

┌─────────────────────────────────────────────────────────────┐
│  Traffic Split                                               │
│  - Blue: 90% traffic                                         │
│  - Green: 10% traffic (canary)                               │
│  - Monitor metrics for 15 minutes                            │
└─────────────────────────────────────────────────────────────┘

                    ↓ If successful

┌─────────────────────────────────────────────────────────────┐
│  Full Cutover                                                │
│  - Blue: 0% traffic                                          │
│  - Green: 100% traffic                                       │
│  - Keep Blue for quick rollback                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Test Pyramid

```
                    ┌──────────────┐
                    │   Manual     │  < 5%
                    │   Testing    │
                    └──────────────┘
                ┌──────────────────────┐
                │   Integration Tests  │  ~15%
                │   - API Routes       │
                │   - End-to-End       │
                └──────────────────────┘
        ┌────────────────────────────────────┐
        │         Unit Tests                  │  ~80%
        │  - Domain Entities                  │
        │  - Services                         │
        │  - Controllers                      │
        │  - Repositories                     │
        └────────────────────────────────────┘
```

### Test Coverage

| Layer | Coverage | Test Types |
|-------|----------|-----------|
| **Domain** | 98% | Unit tests, property-based tests |
| **Application** | 95% | Unit tests, service tests |
| **Infrastructure** | 90% | Unit tests with mocks, integration tests |
| **Presentation** | 95% | Unit tests, controller tests |
| **Overall** | 95%+ | All types |

### Test Structure

```
src/
├── domain/
│   ├── entity/
│   │   ├── User.ts                   # UserEntity (persistence)
│   │   ├── User.test.ts              # Unit tests
│   │   ├── UserProfile.ts            # UserProfile (domain logic)
│   │   ├── UserProfile.test.ts       # Unit tests
│   │   ├── GameEntity.ts
│   │   └── GameEntity.test.ts        # Unit tests
│   └── value-object/
│       ├── Round.ts
│       └── Round.test.ts             # Unit tests
│
├── application/
│   └── services/
│       ├── GameService.ts
│       └── GameService.test.ts       # Service tests
│
├── infrastructure/
│   └── persistence/
│       ├── S3UserRepository.ts
│       └── S3UserRepository.test.ts  # Repository tests with mocks
│
├── presentation/
│   └── controllers/
│       ├── GameController.ts
│       └── GameController.test.ts    # Controller tests
│
└── integration/
    ├── entity-integration.test.ts    # End-to-end entity tests
    ├── user-integration.test.ts      # End-to-end user tests
    └── game-routes.test.ts           # End-to-end game tests
```

### Example Test Cases

```typescript
// Unit Test: Domain Entity
describe('GameEntity', () => {
  it('should create a valid game', () => {
    const game = GameEntity.create(
      'game-1',
      'poker',
      ['user-1', 'user-2'],
      [],
      false
    );
    
    expect(game.id).toBe('game-1');
    expect(game.type).toBe('poker');
    expect(game.usersIds).toEqual(['user-1', 'user-2']);
    expect(game.isFinished).toBe(false);
  });

  it('should reject game with duplicate user IDs', () => {
    expect(() => {
      GameEntity.create(
        'game-1',
        'poker',
        ['user-1', 'user-1'],  // Duplicate!
        [],
        false
      );
    }).toThrow('Game cannot have duplicate user IDs');
  });

  it('should add round immutably', () => {
    const game1 = GameEntity.create('game-1', 'poker', ['user-1'], [], false);
    const round = new Round('round-1', [], false, Date.now());
    
    const game2 = game1.addRound(round);
    
    expect(game1.rounds).toHaveLength(0);  // Original unchanged
    expect(game2.rounds).toHaveLength(1);  // New instance has round
    expect(game2.rounds[0].id).toBe('round-1');
  });
});

// Integration Test: API Routes
describe('Game API Routes', () => {
  it('should create and retrieve game', async () => {
    // Create game
    const createResponse = await request(handler)
      .post('/apiv2/games')
      .send({
        id: 'test-game',
        type: 'poker',
        usersIds: ['user-1', 'user-2'],
        rounds: [],
        isFinished: false
      })
      .expect(201);

    expect(createResponse.body.id).toBe('test-game');
    const etag = createResponse.headers['etag'];

    // Retrieve game
    const getResponse = await request(handler)
      .get('/apiv2/games/test-game')
      .expect(200);

    expect(getResponse.body.id).toBe('test-game');
    expect(getResponse.body.type).toBe('poker');
    expect(getResponse.headers['etag']).toBe(etag);
  });

  it('should handle concurrent updates with ETags', async () => {
    // Create game
    const createResponse = await request(handler)
      .post('/apiv2/games')
      .send({ id: 'concurrent-test', type: 'poker', usersIds: ['user-1'], rounds: [], isFinished: false })
      .expect(201);

    const etag1 = createResponse.headers['etag'];

    // First update succeeds
    const update1 = await request(handler)
      .put('/apiv2/games/concurrent-test')
      .set('If-Match', etag1)
      .send({ type: 'poker-updated', usersIds: ['user-1'], rounds: [], isFinished: false })
      .expect(200);

    const etag2 = update1.headers['etag'];

    // Second update with stale ETag fails
    await request(handler)
      .put('/apiv2/games/concurrent-test')
      .set('If-Match', etag1)  // Stale ETag!
      .send({ type: 'poker-modified', usersIds: ['user-1'], rounds: [], isFinished: false })
      .expect(412);  // Precondition Failed
  });
});
```

---

## Design Decisions

### 1. Why Clean Architecture?

**Decision**: Adopt Clean Architecture with layered separation

**Rationale**:
- **Testability**: Easy to test business logic without AWS dependencies
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Can swap infrastructure (S3 → DynamoDB) without changing domain
- **Scalability**: Easy to add new features without affecting existing code

**Trade-offs**:
- More boilerplate code
- Steeper learning curve
- More files and abstractions

### 2. Why S3 for Data Storage?

**Decision**: Use S3 as primary data store instead of DynamoDB

**Rationale**:
- **Cost**: S3 is significantly cheaper for low-traffic applications
- **Simplicity**: No schema management, just JSON files
- **Flexibility**: Easy to inspect and modify data manually
- **Backup**: Built-in versioning and lifecycle policies
- **Performance**: Sufficient for current scale (< 1000 RPS)

**Trade-offs**:
- No native querying (must list and filter)
- No transactions
- Higher latency than DynamoDB (50-200ms vs 10-20ms)
- Limited to key-value access patterns

**When to migrate to DynamoDB**:
- Traffic > 5,000 RPS
- Need complex queries
- Need transactions
- Need sub-20ms latency

### 3. Why Immutable Entities?

**Decision**: Make all domain entities immutable

**Rationale**:
- **Thread Safety**: No concurrent modification issues
- **Predictability**: Operations always return new instances
- **Debugging**: Easier to track state changes
- **Testing**: Easier to test pure functions
- **Functional Programming**: Aligns with functional principles

**Trade-offs**:
- More memory allocations
- Slightly more verbose code
- Learning curve for developers used to mutable objects

### 4. Why ETag Concurrency Control?

**Decision**: Use ETags for optimistic locking instead of pessimistic locks

**Rationale**:
- **Scalability**: No lock contention
- **Performance**: No lock wait time
- **HTTP Standard**: Native HTTP caching support
- **Simplicity**: No lock management infrastructure
- **Stateless**: No lock state to manage

**Trade-offs**:
- Clients must handle 412 Precondition Failed
- Potential for retry storms under high contention
- No automatic conflict resolution

### 5. Why Backing Store Pattern for GameEntity?

**Decision**: Use JsonEntity as backing store for GameEntity

**Rationale**:
- **Separation of Concerns**: Domain logic separate from persistence
- **Flexibility**: Can change persistence format without changing domain
- **Reusability**: Leverage existing JsonEntity infrastructure
- **Type Safety**: Strong typing in domain, flexible storage

**Trade-offs**:
- Additional layer of abstraction
- Conversion overhead between Game and GameEntity
- More complex code structure

### 6. Why TypeScript?

**Decision**: Use TypeScript instead of JavaScript

**Rationale**:
- **Type Safety**: Catch errors at compile time
- **IDE Support**: Better autocomplete and refactoring
- **Documentation**: Types serve as inline documentation
- **Maintainability**: Easier to refactor large codebases
- **Modern Features**: Latest ECMAScript features

**Trade-offs**:
- Build step required
- Slightly larger bundle size
- Learning curve for pure JavaScript developers

### 7. Why Vitest over Jest?

**Decision**: Use Vitest for testing instead of Jest

**Rationale**:
- **Speed**: Faster test execution (Vite-powered)
- **ES Modules**: Native ESM support
- **Modern**: Better TypeScript support
- **Compatible**: Jest-compatible API
- **Active Development**: Modern, well-maintained

**Trade-offs**:
- Smaller ecosystem than Jest
- Less mature
- Fewer resources/tutorials

### 8. Why Serverless (Lambda)?

**Decision**: Deploy on AWS Lambda instead of containers/VMs

**Rationale**:
- **Cost**: Pay only for execution time
- **Scalability**: Automatic scaling to zero and to thousands
- **Maintenance**: No server management
- **Integration**: Native AWS service integration
- **Cold Start**: Acceptable for current use case (< 1s)

**Trade-offs**:
- Cold start latency (~800ms)
- 15-minute execution limit
- Vendor lock-in (AWS)
- Limited control over runtime environment

**When to migrate to containers**:
- Need sub-100ms cold start
- Need > 15-minute execution time
- Need custom runtime environment
- Want multi-cloud portability

---

## Future Enhancements

### Short Term (1-3 months)

1. **Authentication & Authorization**
   - Implement JWT-based authentication
   - Add role-based access control (RBAC)
   - User-specific data isolation

2. **API Rate Limiting**
   - Implement token bucket algorithm
   - Per-user rate limits
   - DDoS protection

3. **Enhanced Monitoring**
   - CloudWatch dashboards
   - Custom metrics
   - Alerting on errors/latency

4. **Caching Layer**
   - Redis/ElastiCache for hot data
   - Reduce S3 read operations
   - Improve response times

### Medium Term (3-6 months)

1. **Event-Driven Architecture**
   - Domain events (GameCreated, RoundFinished, etc.)
   - EventBridge integration
   - Asynchronous processing

2. **Search Functionality**
   - OpenSearch integration
   - Full-text search on games/users
   - Advanced filtering

3. **Batch Operations**
   - Bulk create/update/delete
   - Background job processing
   - SQS integration

4. **Multi-Region Deployment**
   - Active-active setup
   - S3 cross-region replication
   - Route53 latency-based routing

### Long Term (6-12 months)

1. **Microservices Split**
   - Separate Lambda functions per domain (Files, Users, Games)
   - Independent scaling
   - Separate deployment pipelines

2. **GraphQL API**
   - AppSync integration
   - Real-time subscriptions
   - Flexible querying

3. **Machine Learning Integration**
   - Game analytics
   - User behavior prediction
   - Anomaly detection

4. **Mobile SDK**
   - iOS/Android native SDKs
   - Offline support
   - Push notifications

---

## Conclusion

The VKP REST API represents a well-architected, production-ready serverless application built on AWS. The clean architecture approach ensures maintainability and testability, while the serverless deployment model provides cost-effective scalability. The system successfully balances simplicity with sophistication, providing a solid foundation for future enhancements.

### Key Strengths

1. ✅ **Clean Architecture**: Clear separation of concerns
2. ✅ **Domain-Driven Design**: Rich domain model with business logic
3. ✅ **Serverless**: Cost-effective, auto-scaling infrastructure
4. ✅ **Type Safety**: TypeScript throughout the stack
5. ✅ **Testing**: 95%+ code coverage
6. ✅ **Infrastructure as Code**: Fully automated with Terraform
7. ✅ **Security**: Defense in depth, least privilege
8. ✅ **Monitoring**: Comprehensive logging and metrics

### Key Metrics

- **Lines of Code**: ~5,000 (excluding tests)
- **Test Coverage**: 95%+
- **API Endpoints**: 25 operations
- **AWS Resources**: 38 managed resources
- **Response Time**: < 500ms (warm)
- **Availability**: 99.9% (AWS SLA)
- **Cost**: ~$3-20/month (depending on traffic)

---

**Document Version**: 2.3  
**Last Updated**: November 1, 2025  
**Author**: VKP Consulting Team  
**Status**: Production

---

## Changelog

### Version 2.3 (November 1, 2025)
- **Major Refactoring**: Refactored `User` entity to use Delegating Backing Store Pattern
- **New Class**: Added `UserProfile` class for pure domain logic (separate from persistence)
- **Renamed**: `User` internally renamed to `UserEntity` (exported as `User` for backward compatibility)
- **Architectural Consistency**: User now follows the same pattern as GameEntity + Game
- **Enhanced Features**: Added new domain methods: `hasName()`, `hasExternalId()`, `getDisplayName()`
- **Test Coverage**: Added 19 new tests for UserProfile domain logic
- **Documentation**: Updated all architecture diagrams and documentation

### Version 2.2 (November 1, 2025)
- **Refactoring**: Moved value objects (`Round` and `Move`) from `domain/entity/` to `domain/value-object/`
- **Improved Organization**: Better separation between entities and value objects following DDD principles
- **Updated Imports**: All import statements updated across the codebase to reflect new structure
- **Documentation**: Updated architecture diagrams and file structure documentation

### Version 2.1 (November 1, 2025)
- Initial comprehensive architecture documentation
- Documented all layers, patterns, and design decisions
- Added deployment, testing, and security architecture

---

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Design Patterns](https://www.manning.com/books/api-design-patterns)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

