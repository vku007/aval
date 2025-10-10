import { User } from '../../domain/entity/User.js';
import { CreateUserDto } from '../dto/CreateUserDto.js';
import { UpdateUserDto } from '../dto/UpdateUserDto.js';
import { UserResponseDto } from '../dto/UserResponseDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError } from '../../shared/errors/index.js';

// User-specific repository interface
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<{ items: User[]; nextCursor?: string }>;
}

export class UserService {
  constructor(
    private readonly repository: IUserRepository,
    private readonly logger: Logger
  ) {}

  async getUser(id: string): Promise<UserResponseDto> {
    this.logger.info('Getting user', { id });
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    return UserResponseDto.fromUser(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.info('Creating user', { id: dto.id, name: dto.name, externalId: dto.externalId });
    const user = dto.toUser();
    const saved = await this.repository.save(user);
    this.logger.info('Created user', { id: saved.id });
    return UserResponseDto.fromUser(saved);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    this.logger.info('Updating user', { id, merge: dto.merge });
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    
    const updated = dto.merge
      ? existing.merge(dto.data)
      : new User(id, dto.data.name ?? existing.name, dto.data.externalId ?? existing.externalId);
    
    const saved = await this.repository.save(updated);
    this.logger.info('Updated user', { id });
    return UserResponseDto.fromUser(saved);
  }

  async deleteUser(id: string): Promise<void> {
    this.logger.info('Deleting user', { id });
    await this.repository.delete(id);
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
