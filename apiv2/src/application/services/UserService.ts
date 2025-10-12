import { User } from '../../domain/entity/User.js';
import { CreateUserDto } from '../dto/CreateUserDto.js';
import { UpdateUserDto } from '../dto/UpdateUserDto.js';
import { UserResponseDto } from '../dto/UserResponseDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError } from '../../shared/errors/index.js';

// User-specific repository interface
export interface IUserRepository {
  findById(id: string, ifNoneMatch?: string): Promise<User | null>;
  save(user: User, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<User>;
  delete(id: string, opts?: { ifMatch?: string }): Promise<void>;
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<{ items: User[]; nextCursor?: string }>;
  getMetadata(id: string): Promise<{ etag?: string; size?: number; lastModified?: string }>;
}

export class UserService {
  constructor(
    private readonly repository: IUserRepository,
    private readonly logger: Logger
  ) {}

  async getUser(id: string, ifNoneMatch?: string): Promise<UserResponseDto> {
    this.logger.info('Getting user', { id, ifNoneMatch });
    const user = await this.repository.findById(id, ifNoneMatch);
    if (!user) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    this.logger.info('Got user', { id, etag: user.metadata?.etag });
    return UserResponseDto.fromUser(user);
  }

  async createUser(dto: CreateUserDto, ifNoneMatch?: string): Promise<UserResponseDto> {
    this.logger.info('Creating user', { id: dto.id, name: dto.name, externalId: dto.externalId });
    const user = dto.toUser();
    const saved = await this.repository.save(user, { ifNoneMatch });
    this.logger.info('Created user', { id: saved.id, etag: saved.metadata?.etag });
    return UserResponseDto.fromUser(saved);
  }

  async updateUser(id: string, dto: UpdateUserDto, ifMatch?: string): Promise<UserResponseDto> {
    this.logger.info('Updating user', { id, merge: dto.merge, ifMatch });
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    
    const updated = dto.merge
      ? existing.merge(dto.data)
      : new User(id, dto.data.name ?? existing.name, dto.data.externalId ?? existing.externalId, existing.metadata?.etag, existing.metadata);
    
    const saved = await this.repository.save(updated, { ifMatch });
    this.logger.info('Updated user', { id, etag: saved.metadata?.etag });
    return UserResponseDto.fromUser(saved);
  }

  async deleteUser(id: string, ifMatch?: string): Promise<void> {
    this.logger.info('Deleting user', { id, ifMatch });
    await this.repository.delete(id, { ifMatch });
    this.logger.info('Deleted user', { id });
  }

  async getUserMetadata(id: string): Promise<{ etag?: string; size?: number; lastModified?: string }> {
    this.logger.info('Getting user metadata', { id });
    const metadata = await this.repository.getMetadata(id);
    this.logger.info('Got user metadata', { id, etag: metadata.etag });
    return metadata;
  }

  async listUsers(prefix?: string, limit?: number, cursor?: string): Promise<{ names: string[]; nextCursor?: string }> {
    this.logger.info('Listing users', { prefix, limit, cursor });
    const result = await this.repository.findAll(prefix, limit, cursor);
    const names = result.items.map(u => u.id);
    this.logger.info('Listed users', { count: names.length, hasMore: !!result.nextCursor });
    return { names, nextCursor: result.nextCursor };
  }
}
