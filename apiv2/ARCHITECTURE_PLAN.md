# Domain Architecture Refactoring Plan

## Overview
Refactor the current monolithic `app.ts` into a clean, layered architecture following separation of concerns.

## Current State
```
apiv2/src/
├── app.ts          # Handler + routing + business logic + S3 (everything mixed)
├── errors.ts       # Error handling
├── logging.ts      # Logging utilities
├── s3.ts          # S3 operations
├── types.ts       # Type definitions
└── validation.ts  # Input validation schemas
```

## Target Architecture

```
apiv2/src/
├── index.ts                    # Lambda entry point (handler export)
├── config/
│   └── environment.ts          # Environment variables & app config
├── domain/
│   ├── entity/
│   │   ├── Entity.ts           # Domain entity (File/Document model)
│   │   └── EntityMetadata.ts  # Metadata value object
│   └── repository/
│       └── IEntityRepository.ts # Repository interface (port)
├── application/
│   ├── services/
│   │   └── EntityService.ts    # Business logic & orchestration
│   └── dto/
│       ├── CreateEntityDto.ts  # Data transfer objects
│       ├── UpdateEntityDto.ts
│       └── EntityResponseDto.ts
├── infrastructure/
│   ├── persistence/
│   │   └── S3EntityRepository.ts # S3 implementation of repository
│   └── http/
│       └── ApiGatewayAdapter.ts  # API Gateway event/response adapter
├── presentation/
│   ├── controllers/
│   │   └── EntityController.ts   # HTTP request handlers
│   └── middleware/
│       ├── cors.ts               # CORS middleware
│       ├── contentType.ts        # Content-Type validation
│       └── errorHandler.ts       # Global error handler
├── shared/
│   ├── errors/
│   │   ├── ApplicationError.ts   # Base error classes
│   │   ├── NotFoundError.ts
│   │   ├── ConflictError.ts
│   │   └── ValidationError.ts
│   ├── logging/
│   │   └── Logger.ts             # Structured logger
│   └── types/
│       └── common.ts             # Shared types
└── app.test.ts                   # Integration tests
```

---

## Layer Responsibilities

### 1. **Domain Layer** (Core Business)
**Location:** `src/domain/`

**Responsibilities:**
- Define core business entities and value objects
- Define repository interfaces (ports)
- Pure business logic (no frameworks, no I/O)
- Domain invariants and validation rules

**Files to create:**
```typescript
// domain/entity/Entity.ts
export class Entity {
  constructor(
    public readonly name: string,
    public readonly data: JsonValue,
    public readonly etag?: string,
    public readonly metadata?: EntityMetadata
  ) {}
  
  static create(name: string, data: JsonValue): Entity {
    // Validate domain rules
    if (!Entity.isValidName(name)) {
      throw new DomainError('Invalid entity name');
    }
    return new Entity(name, data);
  }
  
  merge(partial: JsonValue): Entity {
    // Deep merge logic
    return new Entity(this.name, deepMerge(this.data, partial), this.etag);
  }
  
  private static isValidName(name: string): boolean {
    return /^[a-zA-Z0-9._-]{1,128}$/.test(name);
  }
}

// domain/repository/IEntityRepository.ts
export interface IEntityRepository {
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<ListResult<Entity>>;
  findByName(name: string, opts?: { ifNoneMatch?: string }): Promise<Entity | null>;
  save(entity: Entity, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<Entity>;
  delete(name: string, opts?: { ifMatch?: string }): Promise<void>;
  getMetadata(name: string): Promise<EntityMetadata>;
}
```

---

### 2. **Application Layer** (Use Cases)
**Location:** `src/application/`

**Responsibilities:**
- Orchestrate business workflows
- Transaction management
- Application-specific business rules
- DTO mapping (domain ↔ presentation)

**Files to create:**
```typescript
// application/services/EntityService.ts
export class EntityService {
  constructor(
    private readonly repository: IEntityRepository,
    private readonly logger: Logger
  ) {}
  
  async listEntities(prefix?: string, limit?: number, cursor?: string): Promise<EntityResponseDto[]> {
    this.logger.info('Listing entities', { prefix, limit });
    const result = await this.repository.findAll(prefix, limit, cursor);
    return result.items.map(e => this.toDto(e));
  }
  
  async getEntity(name: string, ifNoneMatch?: string): Promise<EntityResponseDto | { notModified: true }> {
    const entity = await this.repository.findByName(name, { ifNoneMatch });
    if (!entity) throw new NotFoundError(`Entity '${name}' not found`);
    return this.toDto(entity);
  }
  
  async createEntity(dto: CreateEntityDto): Promise<EntityResponseDto> {
    const entity = Entity.create(dto.name, dto.data);
    const saved = await this.repository.save(entity, { ifNoneMatch: '*' });
    return this.toDto(saved);
  }
  
  async updateEntity(name: string, dto: UpdateEntityDto, ifMatch?: string): Promise<EntityResponseDto> {
    const existing = await this.repository.findByName(name);
    if (!existing) throw new NotFoundError(`Entity '${name}' not found`);
    
    const updated = dto.merge 
      ? existing.merge(dto.data)
      : new Entity(name, dto.data, existing.etag);
    
    const saved = await this.repository.save(updated, { ifMatch });
    return this.toDto(saved);
  }
  
  async deleteEntity(name: string, ifMatch?: string): Promise<void> {
    await this.repository.delete(name, { ifMatch });
  }
  
  private toDto(entity: Entity): EntityResponseDto {
    return {
      name: entity.name,
      data: entity.data,
      etag: entity.etag,
      size: entity.metadata?.size,
      lastModified: entity.metadata?.lastModified
    };
  }
}
```

---

### 3. **Infrastructure Layer** (External Systems)
**Location:** `src/infrastructure/`

**Responsibilities:**
- Implement repository interfaces
- Handle external service communication (S3, DynamoDB, etc.)
- Framework-specific adapters
- Persistence mapping

**Files to create:**
```typescript
// infrastructure/persistence/S3EntityRepository.ts
export class S3EntityRepository implements IEntityRepository {
  constructor(
    private readonly s3Client: S3Client,
    private readonly config: S3Config
  ) {}
  
  async findByName(name: string, opts?: { ifNoneMatch?: string }): Promise<Entity | null> {
    const key = this.keyFor(name);
    try {
      const resp = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        IfNoneMatch: opts?.ifNoneMatch
      }));
      
      const data = await this.streamToJson(resp.Body);
      return new Entity(
        name,
        data,
        resp.ETag?.replace(/"/g, ''),
        { size: resp.ContentLength, lastModified: resp.LastModified?.toISOString() }
      );
    } catch (err: any) {
      if (err.$metadata?.httpStatusCode === 304) {
        throw new NotModifiedError();
      }
      if (err instanceof NotFound) {
        return null;
      }
      throw err;
    }
  }
  
  async save(entity: Entity, opts?: SaveOptions): Promise<Entity> {
    // Concurrency check (HEAD + compare ETag)
    if (opts?.ifMatch || opts?.ifNoneMatch) {
      await this.checkPreconditions(entity.name, opts);
    }
    
    const key = this.keyFor(entity.name);
    const body = JSON.stringify(entity.data);
    
    if (Buffer.byteLength(body) > this.config.maxBodyBytes) {
      throw new PayloadTooLargeError();
    }
    
    const resp = await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256'
    }));
    
    return new Entity(entity.name, entity.data, resp.ETag?.replace(/"/g, ''));
  }
  
  private keyFor(name: string): string {
    return `${this.config.prefix}${encodeURIComponent(name)}.json`;
  }
}
```

---

### 4. **Presentation Layer** (HTTP/Controllers)
**Location:** `src/presentation/`

**Responsibilities:**
- Handle HTTP requests/responses
- Input validation
- Route requests to application services
- Format responses
- Apply middleware

**Files to create:**
```typescript
// presentation/controllers/EntityController.ts
export class EntityController {
  constructor(
    private readonly entityService: EntityService,
    private readonly logger: Logger
  ) {}
  
  async list(request: ListEntitiesRequest): Promise<HttpResponse> {
    const { prefix, limit, cursor } = request.query;
    const result = await this.entityService.listEntities(prefix, limit, cursor);
    return HttpResponse.ok(result);
  }
  
  async get(request: GetEntityRequest): Promise<HttpResponse> {
    const { name } = request.params;
    const ifNoneMatch = request.headers['if-none-match'];
    
    const result = await this.entityService.getEntity(name, ifNoneMatch);
    
    if ('notModified' in result) {
      return HttpResponse.notModified().withETag(ifNoneMatch!);
    }
    
    return HttpResponse.ok(result.data).withETag(result.etag);
  }
  
  async create(request: CreateEntityRequest): Promise<HttpResponse> {
    const dto = CreateEntityDto.fromRequest(request.body);
    const entity = await this.entityService.createEntity(dto);
    
    return HttpResponse.created(entity)
      .withETag(entity.etag)
      .withLocation(`/apiv2/files/${entity.name}`);
  }
  
  async update(request: UpdateEntityRequest): Promise<HttpResponse> {
    const { name } = request.params;
    const ifMatch = request.headers['if-match'];
    const dto = UpdateEntityDto.fromRequest(request.body, request.method === 'PATCH');
    
    const entity = await this.entityService.updateEntity(name, dto, ifMatch);
    
    return HttpResponse.ok(entity).withETag(entity.etag);
  }
  
  async delete(request: DeleteEntityRequest): Promise<HttpResponse> {
    const { name } = request.params;
    const ifMatch = request.headers['if-match'];
    
    await this.entityService.deleteEntity(name, ifMatch);
    
    return HttpResponse.noContent();
  }
}

// presentation/middleware/errorHandler.ts
export const errorHandler = (error: Error, request: Request): HttpResponse => {
  if (error instanceof NotFoundError) {
    return HttpResponse.notFound({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: error.message,
      instance: request.path
    });
  }
  
  if (error instanceof ConflictError) {
    return HttpResponse.conflict({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: error.message,
      instance: request.path
    });
  }
  
  // ... other error types
  
  return HttpResponse.internalServerError({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: error.message,
    instance: request.path
  });
};
```

---

### 5. **Entry Point** (Composition Root)
**Location:** `src/index.ts`

**Responsibilities:**
- Dependency injection / composition
- Wire up all layers
- Export Lambda handler

**File to create:**
```typescript
// index.ts
import { S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Infrastructure
import { S3EntityRepository } from './infrastructure/persistence/S3EntityRepository';
import { ApiGatewayAdapter } from './infrastructure/http/ApiGatewayAdapter';

// Application
import { EntityService } from './application/services/EntityService';

// Presentation
import { EntityController } from './presentation/controllers/EntityController';
import { Router } from './presentation/routing/Router';
import { corsMiddleware } from './presentation/middleware/cors';
import { contentTypeMiddleware } from './presentation/middleware/contentType';
import { errorHandler } from './presentation/middleware/errorHandler';

// Shared
import { Logger } from './shared/logging/Logger';
import { loadConfig } from './config/environment';

// Composition Root (Dependency Injection)
const config = loadConfig();
const logger = new Logger();

// Infrastructure layer
const s3Client = new S3Client({ region: config.aws.region });
const entityRepository = new S3EntityRepository(s3Client, config.s3);

// Application layer
const entityService = new EntityService(entityRepository, logger);

// Presentation layer
const entityController = new EntityController(entityService, logger);

// Router with middleware
const router = new Router()
  .use(corsMiddleware(config.cors))
  .use(contentTypeMiddleware())
  .get('/files', (req) => entityController.list(req))
  .get('/files/:name', (req) => entityController.get(req))
  .get('/files/:name/meta', (req) => entityController.getMeta(req))
  .post('/files', (req) => entityController.create(req))
  .put('/files/:name', (req) => entityController.update(req))
  .patch('/files/:name', (req) => entityController.update(req))
  .delete('/files/:name', (req) => entityController.delete(req));

// Lambda handler
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  logger.setContext({ requestId });
  
  try {
    const request = ApiGatewayAdapter.toRequest(event);
    const response = await router.handle(request);
    return ApiGatewayAdapter.toApiGatewayResponse(response);
  } catch (error) {
    logger.error('Unhandled error', { error });
    const errorResponse = errorHandler(error as Error, ApiGatewayAdapter.toRequest(event));
    return ApiGatewayAdapter.toApiGatewayResponse(errorResponse);
  }
};
```

---

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Each layer has a single, well-defined responsibility
- Changes in one layer don't affect others

### 2. **Testability**
```typescript
// Test domain logic without S3
describe('Entity', () => {
  it('should merge data correctly', () => {
    const entity = new Entity('test', { a: 1 });
    const merged = entity.merge({ b: 2 });
    expect(merged.data).toEqual({ a: 1, b: 2 });
  });
});

// Test service with mock repository
describe('EntityService', () => {
  it('should create entity', async () => {
    const mockRepo = { save: vi.fn() };
    const service = new EntityService(mockRepo, logger);
    await service.createEntity({ name: 'test', data: {} });
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

### 3. **Maintainability**
- Clear structure makes navigation easy
- New developers understand architecture quickly
- Easy to locate and fix bugs

### 4. **Flexibility**
- Swap S3 for DynamoDB without touching business logic
- Change from Lambda to Express.js by replacing adapter
- Add caching layer by decorating repository

### 5. **Scalability**
- Add new entities/features without modifying existing code
- Domain logic reusable across different interfaces (REST, GraphQL, CLI)

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up folder structure
- [ ] Create base error classes
- [ ] Create Logger class
- [ ] Create configuration management
- [ ] Write domain entities and interfaces

### Phase 2: Infrastructure (Week 1-2)
- [ ] Implement S3EntityRepository
- [ ] Create ApiGatewayAdapter
- [ ] Write infrastructure tests

### Phase 3: Application Layer (Week 2)
- [ ] Implement EntityService
- [ ] Create DTOs
- [ ] Write service tests

### Phase 4: Presentation Layer (Week 2-3)
- [ ] Implement EntityController
- [ ] Create middleware (CORS, validation, error handling)
- [ ] Implement Router
- [ ] Write controller tests

### Phase 5: Integration (Week 3)
- [ ] Wire everything in index.ts
- [ ] Write end-to-end tests
- [ ] Update existing unit tests
- [ ] Performance testing

### Phase 6: Migration & Deployment (Week 4)
- [ ] Gradual rollout (feature flags if needed)
- [ ] Monitor CloudWatch metrics
- [ ] Update documentation
- [ ] Remove old app.ts

---

## Migration Strategy

### Option A: Big Bang (Risky)
Replace entire `app.ts` in one deployment.

### Option B: Strangler Fig Pattern (Recommended)
1. Keep old `app.ts` as fallback
2. Implement new architecture in parallel
3. Route new endpoints to new code
4. Gradually migrate existing endpoints
5. Remove old code when 100% migrated

### Option C: Feature Flags
```typescript
const USE_NEW_ARCHITECTURE = process.env.NEW_ARCH === 'true';

export const handler = USE_NEW_ARCHITECTURE
  ? newArchitectureHandler
  : oldHandler;
```

---

## File Size Estimate

| Current | New Architecture |
|---------|------------------|
| app.ts: ~200 lines | 15-20 files, ~50-100 lines each |
| **Total:** ~500 lines | **Total:** ~1000-1200 lines |

**Trade-off:** 2x code but 10x maintainability

---

## Next Steps

1. **Review & Approve Plan** - Get team alignment
2. **Prototype** - Build one endpoint end-to-end with new architecture
3. **Validate** - Ensure pattern works for your use case
4. **Implement** - Follow phases above
5. **Test** - Comprehensive testing at each layer
6. **Deploy** - Gradual rollout with monitoring

---

## Alternative: Lightweight Refactoring

If full domain architecture is too heavy, consider **simplified layering**:

```
src/
├── handlers/          # Request handlers (thin controllers)
├── services/          # Business logic
├── repositories/      # Data access
└── shared/           # Common utilities
```

This gives 80% of benefits with 40% of complexity.

---

## Questions to Answer

1. **Scope:** Will you have multiple entity types in future (not just JSON files)?
2. **Team Size:** Solo developer or team?
3. **Timeline:** How urgent is this refactor?
4. **Testing:** What's your current test coverage?
5. **Performance:** Any current bottlenecks?

Let me know your preferences, and I can generate the actual implementation!
