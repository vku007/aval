import type { BaseEntity } from '../../domain/entity/BaseEntity.js';
import type { IEntityRepository } from '../../domain/repository/IEntityRepository.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { CreateEntityDto } from '../dto/CreateEntityDto.js';
import { UpdateEntityDto } from '../dto/UpdateEntityDto.js';
import { EntityResponseDto } from '../dto/EntityResponseDto.js';
import { ListResponseDto } from '../dto/ListResponseDto.js';
import { NotFoundError, NotModifiedError } from '../../shared/errors/index.js';

/**
 * Application service for entity operations
 * Orchestrates business logic and repository calls
 */
export class EntityService<T extends BaseEntity> {
  constructor(
    private readonly repository: IEntityRepository<T>,
    private readonly logger: Logger
  ) {}

  /**
   * List entities with optional prefix filtering and pagination
   */
  async listEntities(prefix?: string, limit?: number, cursor?: string): Promise<ListResponseDto> {
    this.logger.info('Listing entities', { prefix, limit, cursor });

    const result = await this.repository.findAll(prefix, limit, cursor);
    const names = result.items.map(e => e.name);

    this.logger.info('Listed entities', { count: names.length, hasMore: !!result.nextCursor });

    return new ListResponseDto(names, result.nextCursor);
  }

  /**
   * Get entity by name
   * Returns entity data or throws NotModifiedError if ETag matches
   */
  async getEntity(name: string, ifNoneMatch?: string): Promise<EntityResponseDto> {
    this.logger.info('Getting entity', { name, ifNoneMatch });

    const entity = await this.repository.findByName(name, { ifNoneMatch });

    if (!entity) {
      throw new NotFoundError(`Entity '${name}' not found`);
    }

    this.logger.info('Got entity', { name, etag: entity.etag });

    return EntityResponseDto.fromEntity(entity);
  }

  /**
   * Get entity metadata only
   */
  async getEntityMetadata(name: string): Promise<{ etag?: string; size?: number; lastModified?: string }> {
    this.logger.info('Getting entity metadata', { name });

    const metadata = await this.repository.getMetadata(name);

    this.logger.info('Got entity metadata', { name, etag: metadata.etag });

    return metadata;
  }

  /**
   * Create new entity
   * Throws ConflictError if entity already exists
   */
  async createEntity(dto: CreateEntityDto): Promise<EntityResponseDto> {
    this.logger.info('Creating entity', { name: dto.name });

    // Create domain entity (will validate)
    const entity = this.repository['entityFactory'](dto.name, dto.data) as T;

    // Save with If-None-Match: * (create only)
    const saved = await this.repository.save(entity, { ifNoneMatch: '*' });

    this.logger.info('Created entity', { name: saved.name, etag: saved.etag });

    return EntityResponseDto.fromEntity(saved);
  }

  /**
   * Update entity (PUT or PATCH)
   * PUT: Replace entire data
   * PATCH: Merge partial data
   */
  async updateEntity(name: string, dto: UpdateEntityDto, ifMatch?: string): Promise<EntityResponseDto> {
    this.logger.info('Updating entity', { name, merge: dto.merge, ifMatch });

    // Load existing entity
    const existing = await this.repository.findByName(name);

    if (!existing) {
      // For PUT, we can create if it doesn't exist (unless If-Match is specified)
      if (ifMatch) {
        throw new NotFoundError(`Entity '${name}' not found`);
      }

      if (!dto.merge) {
        // PUT without If-Match: create new entity
        this.logger.info('Entity not found, creating new', { name });
        const entity = this.repository['entityFactory'](name, dto.data) as T;
        const saved = await this.repository.save(entity);
        return EntityResponseDto.fromEntity(saved);
      } else {
        // PATCH requires existing entity
        throw new NotFoundError(`Entity '${name}' not found`);
      }
    }

    // Update existing entity
    const updated = dto.merge
      ? existing.merge(dto.data)
      : this.repository['entityFactory'](name, dto.data, existing.etag, existing.metadata) as T;

    const saved = await this.repository.save(updated, { ifMatch });

    this.logger.info('Updated entity', { name, etag: saved.etag });

    return EntityResponseDto.fromEntity(saved);
  }

  /**
   * Delete entity
   */
  async deleteEntity(name: string, ifMatch?: string): Promise<void> {
    this.logger.info('Deleting entity', { name, ifMatch });

    await this.repository.delete(name, { ifMatch });

    this.logger.info('Deleted entity', { name });
  }
}

