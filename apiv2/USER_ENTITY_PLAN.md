# User Entity Implementation Plan

## 📋 Overview

Implement a new `User` entity that extends the existing `BaseEntity` architecture with specific fields:
- `name`: string
- `externalId`: number

## 🏗️ Architecture Integration

The User entity will integrate with the existing domain architecture:

```
Domain Layer (Business Logic)
├── BaseEntity (abstract base)
├── JsonEntity (current implementation)
└── User (new implementation) ← NEW

Application Layer (Use Cases)
├── EntityService<T> (generic service)
└── UserService (specialized service) ← NEW

Infrastructure Layer (Data Access)
├── S3EntityRepository<T> (generic repository)
└── UserRepository (specialized repository) ← NEW

Presentation Layer (HTTP Interface)
├── EntityController (generic controller)
└── UserController (specialized controller) ← NEW
```

## 📁 File Structure

```
apiv2/src/
├── domain/
│   └── entity/
│       ├── BaseEntity.ts (existing)
│       ├── JsonEntity.ts (existing)
│       └── User.ts (new)
├── application/
│   ├── dto/
│   │   ├── CreateUserDto.ts (new)
│   │   ├── UpdateUserDto.ts (new)
│   │   └── UserResponseDto.ts (new)
│   └── services/
│       └── UserService.ts (new)
├── infrastructure/
│   └── persistence/
│       └── UserRepository.ts (new)
└── presentation/
    └── controllers/
        └── UserController.ts (new)
```

## 🔧 Implementation Phases

### Phase 1: Domain Layer (User Entity)

**File: `src/domain/entity/User.ts`**

```typescript
import { BaseEntity } from './BaseEntity.js';
import type { EntityMetadata } from '../../shared/types/common.js';

export interface UserData {
  name: string;
  externalId: number;
}

export class User extends BaseEntity {
  constructor(
    id: string,
    data: UserData,
    etag?: string,
    metadata?: EntityMetadata
  ) {
    super(id, data, etag, metadata);
    this.validateUserData();
  }

  static create(id: string, name: string, externalId: number): User {
    return new User(id, { name, externalId });
  }

  get name(): string {
    return this.data.name;
  }

  get externalId(): number {
    return this.data.externalId;
  }

  updateName(name: string): User {
    return this.merge({ name });
  }

  updateExternalId(externalId: number): User {
    return this.merge({ externalId });
  }

  private validateUserData(): void {
    const data = this.data as UserData;
    
    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('User name is required and must be a string');
    }
    
    if (data.name.length < 2 || data.name.length > 100) {
      throw new ValidationError('User name must be between 2 and 100 characters');
    }
    
    if (typeof data.externalId !== 'number' || !Number.isInteger(data.externalId)) {
      throw new ValidationError('External ID must be an integer');
    }
    
    if (data.externalId < 1) {
      throw new ValidationError('External ID must be a positive integer');
    }
  }
}
```

### Phase 2: Application Layer (DTOs & Services)

**File: `src/application/dto/CreateUserDto.ts`**

```typescript
import type { JsonValue } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

export interface CreateUserData {
  name: string;
  externalId: number;
}

export class CreateUserDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number
  ) {
    this.validate();
  }

  static fromRequest(body: unknown): CreateUserDto {
    if (typeof body !== 'object' || body === null) {
      throw new ValidationError('Request body must be an object');
    }

    const obj = body as Record<string, unknown>;

    if (typeof obj.id !== 'string') {
      throw new ValidationError('Field "id" is required and must be a string');
    }

    if (typeof obj.name !== 'string') {
      throw new ValidationError('Field "name" is required and must be a string');
    }

    if (typeof obj.externalId !== 'number' || !Number.isInteger(obj.externalId)) {
      throw new ValidationError('Field "externalId" is required and must be an integer');
    }

    return new CreateUserDto(obj.id, obj.name, obj.externalId);
  }

  private validate(): void {
    if (!this.id || typeof this.id !== 'string') {
      throw new ValidationError('ID is required and must be a string');
    }

    if (!this.name || typeof this.name !== 'string') {
      throw new ValidationError('Name is required and must be a string');
    }

    if (this.name.length < 2 || this.name.length > 100) {
      throw new ValidationError('Name must be between 2 and 100 characters');
    }

    if (typeof this.externalId !== 'number' || !Number.isInteger(this.externalId)) {
      throw new ValidationError('External ID must be an integer');
    }

    if (this.externalId < 1) {
      throw new ValidationError('External ID must be a positive integer');
    }
  }

  toUserData(): CreateUserData {
    return {
      name: this.name,
      externalId: this.externalId
    };
  }
}
```

**File: `src/application/dto/UserResponseDto.ts`**

```typescript
import type { User, UserData } from '../../domain/entity/User.js';

export class UserResponseDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number,
    public readonly etag?: string,
    public readonly size?: number,
    public readonly lastModified?: string
  ) {}

  static fromUser(user: User): UserResponseDto {
    const data = user.data as UserData;
    return new UserResponseDto(
      user.id,
      data.name,
      data.externalId,
      user.etag,
      user.metadata?.size,
      user.metadata?.lastModified
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      externalId: this.externalId
    };
  }
}
```

**File: `src/application/services/UserService.ts`**

```typescript
import { User } from '../../domain/entity/User.js';
import { CreateUserDto } from '../dto/CreateUserDto.js';
import { UpdateEntityDto } from '../dto/UpdateEntityDto.js';
import { UserResponseDto } from '../dto/UserResponseDto.js';
import { IEntityRepository } from '../../domain/repository/IEntityRepository.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError } from '../../shared/errors/index.js';

export class UserService {
  constructor(
    private readonly repository: IEntityRepository<User>,
    private readonly logger: Logger
  ) {}

  async getUser(id: string, ifNoneMatch?: string): Promise<UserResponseDto> {
    this.logger.info('Getting user', { id, ifNoneMatch });
    const user = await this.repository.findByName(id, { ifNoneMatch });
    if (!user) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    return UserResponseDto.fromUser(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.info('Creating user', { id: dto.id, name: dto.name, externalId: dto.externalId });
    const user = User.create(dto.id, dto.name, dto.externalId);
    const saved = await this.repository.save(user, { ifNoneMatch: '*' });
    this.logger.info('Created user', { id: saved.id, etag: saved.etag });
    return UserResponseDto.fromUser(saved);
  }

  async updateUser(id: string, dto: UpdateEntityDto, ifMatch?: string): Promise<UserResponseDto> {
    this.logger.info('Updating user', { id, merge: dto.merge, ifMatch });
    const existing = await this.repository.findByName(id);
    if (!existing) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    
    const updated = dto.merge
      ? existing.merge(dto.data)
      : new User(id, dto.data as any, existing.etag, existing.metadata);
    
    const saved = await this.repository.save(updated, { ifMatch });
    this.logger.info('Updated user', { id, etag: saved.etag });
    return UserResponseDto.fromUser(saved);
  }

  async deleteUser(id: string, ifMatch?: string): Promise<void> {
    this.logger.info('Deleting user', { id, ifMatch });
    await this.repository.delete(id, { ifMatch });
    this.logger.info('Deleted user', { id });
  }

  async listUsers(prefix?: string, limit?: number, cursor?: string): Promise<{ names: string[]; nextCursor?: string }> {
    this.logger.info('Listing users', { prefix, limit, cursor });
    const result = await this.repository.findAll(prefix, limit, cursor);
    const names = result.items.map(u => u.id);
    this.logger.info('Listed users', { count: names.length, hasMore: !!result.nextCursor });
    return { names, nextCursor: result.nextCursor };
  }
}
```

### Phase 3: Infrastructure Layer (Repository)

**File: `src/infrastructure/persistence/UserRepository.ts`**

```typescript
import { S3EntityRepository } from './S3EntityRepository.js';
import { User } from '../../domain/entity/User.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import type { AppConfig } from '../../config/environment.js';
import { S3Client } from '@aws-sdk/client-s3';

export class UserRepository extends S3EntityRepository<User> {
  constructor(s3Client: S3Client, config: AppConfig) {
    const entityFactory = (id: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) =>
      new User(id, data as any, etag, metadata);
    
    super(s3Client, config, entityFactory);
  }
}
```

### Phase 4: Presentation Layer (Controller)

**File: `src/presentation/controllers/UserController.ts`**

```typescript
import { UserService } from '../../application/services/UserService.js';
import { CreateUserDto } from '../../application/dto/CreateUserDto.js';
import { UpdateEntityDto } from '../../application/dto/UpdateEntityDto.js';
import { HttpResponse } from '../../infrastructure/http/HttpResponse.js';
import { Logger } from '../../shared/logging/Logger.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger
  ) {}

  async get(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifNoneMatch = request.headers['if-none-match'];
    const user = await this.userService.getUser(id, ifNoneMatch);
    return HttpResponse.ok(user.toJSON()).withETag(user.etag);
  }

  async getMeta(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const user = await this.userService.getUser(id);
    return HttpResponse.ok({
      etag: user.etag,
      size: user.size,
      lastModified: user.lastModified
    });
  }

  async create(request: HttpRequest): Promise<HttpResponse> {
    const dto = CreateUserDto.fromRequest(request.body);
    const user = await this.userService.createUser(dto);
    return HttpResponse.created(user.toJSON())
      .withETag(user.etag)
      .withLocation(`/apiv2/users/${user.id}`);
  }

  async update(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];
    const dto = UpdateEntityDto.fromRequest(request.body, false);
    const user = await this.userService.updateUser(id, dto, ifMatch);
    return HttpResponse.ok(user.toJSON()).withETag(user.etag);
  }

  async patch(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];
    const dto = UpdateEntityDto.fromRequest(request.body, true);
    const user = await this.userService.updateUser(id, dto, ifMatch);
    return HttpResponse.ok(user.toJSON()).withETag(user.etag);
  }

  async delete(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];
    await this.userService.deleteUser(id, ifMatch);
    return HttpResponse.noContent();
  }

  async list(request: HttpRequest): Promise<HttpResponse> {
    const prefix = request.query.prefix;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
    const cursor = request.query.cursor;
    const result = await this.userService.listUsers(prefix, limit, cursor);
    return HttpResponse.ok(result);
  }

  private extractId(request: HttpRequest): string {
    if (request.params.id) return request.params.id;
    if (request.params.name) return request.params.name; // Legacy support
    if (request.params.proxy) {
      const proxy = request.params.proxy;
      if (proxy.startsWith('users/')) {
        const id = proxy.slice(6); // Remove 'users/' prefix
        return id.endsWith('/meta') ? id.slice(0, -5) : id;
      }
    }
    throw new Error('Could not extract user ID from request');
  }
}
```

### Phase 5: Integration & Routing

**Update `src/index.ts`:**

```typescript
// Add User-specific imports
import { User } from './domain/entity/User.js';
import { UserRepository } from './infrastructure/persistence/UserRepository.js';
import { UserService } from './application/services/UserService.js';
import { UserController } from './presentation/controllers/UserController.js';

// Add User repository and service
const userRepository = new UserRepository(s3Client, config);
const userService = new UserService(userRepository, logger);
const userController = new UserController(userService, logger);

// Add User routes
const router = new Router()
  .use(corsMiddleware(config))
  .use(contentTypeMiddleware())
  
  // Existing JsonEntity routes
  .get('/apiv2/files', (req) => entityController.list(req))
  .get('/apiv2/files/:id/meta', (req) => entityController.getMeta(req))
  .get('/apiv2/files/:id', (req) => entityController.get(req))
  .post('/apiv2/files', (req) => entityController.create(req))
  .put('/apiv2/files/:id', (req) => entityController.update(req))
  .patch('/apiv2/files/:id', (req) => entityController.patch(req))
  .delete('/apiv2/files/:id', (req) => entityController.delete(req))
  
  // New User routes
  .get('/apiv2/users', (req) => userController.list(req))
  .get('/apiv2/users/:id/meta', (req) => userController.getMeta(req))
  .get('/apiv2/users/:id', (req) => userController.get(req))
  .post('/apiv2/users', (req) => userController.create(req))
  .put('/apiv2/users/:id', (req) => userController.update(req))
  .patch('/apiv2/users/:id', (req) => userController.patch(req))
  .delete('/apiv2/users/:id', (req) => userController.delete(req));
```

## 🧪 Testing Strategy

### Unit Tests

1. **User Entity Tests**
   - Validation of name and externalId
   - Entity creation and updates
   - Business logic methods

2. **UserService Tests**
   - CRUD operations
   - Error handling
   - Business rule enforcement

3. **UserController Tests**
   - HTTP request/response handling
   - Parameter extraction
   - Error responses

### Integration Tests

1. **End-to-End API Tests**
   - All CRUD operations via HTTP
   - Validation and error scenarios
   - ETag handling

2. **Repository Tests**
   - S3 integration
   - Data persistence and retrieval

## 📋 API Endpoints

### User Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/apiv2/users` | List all users |
| GET | `/apiv2/users/:id` | Get user by ID |
| GET | `/apiv2/users/:id/meta` | Get user metadata |
| POST | `/apiv2/users` | Create new user |
| PUT | `/apiv2/users/:id` | Update user (replace) |
| PATCH | `/apiv2/users/:id` | Update user (merge) |
| DELETE | `/apiv2/users/:id` | Delete user |

### Request/Response Examples

**Create User:**
```bash
curl -X POST "https://vkp-consulting.fr/apiv2/users" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "name": "John Doe",
    "externalId": 1001
  }'
```

**Response:**
```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

**List Users:**
```bash
curl -X GET "https://vkp-consulting.fr/apiv2/users"
```

**Response:**
```json
{
  "names": ["user-123", "user-456"],
  "nextCursor": "base64-encoded-cursor"
}
```

## 🚀 Implementation Order

1. **Phase 1**: Create User entity with validation
2. **Phase 2**: Implement DTOs and UserService
3. **Phase 3**: Create UserRepository
4. **Phase 4**: Build UserController
5. **Phase 5**: Integrate routing and test
6. **Phase 6**: Add comprehensive tests
7. **Phase 7**: Update documentation and deploy

## ✅ Benefits

1. **Domain Separation**: Users are separate from generic JSON entities
2. **Type Safety**: Strong typing for User-specific fields
3. **Validation**: Business rules enforced at entity level
4. **Extensibility**: Easy to add more user-specific functionality
5. **API Clarity**: Clear separation between `/files` and `/users` endpoints
6. **Reusability**: Leverages existing architecture patterns

This plan provides a clean, maintainable implementation that extends the existing domain architecture while maintaining separation of concerns and type safety.
