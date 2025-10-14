import type { BaseEntity } from '../../domain/entity/BaseEntity.js';
import type { IEntityRepository } from '../../domain/repository/IEntityRepository.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { CreateEntityDto } from '../dto/CreateEntityDto.js';
import { UpdateEntityDto } from '../dto/UpdateEntityDto.js';
import { EntityResponseDto } from '../dto/EntityResponseDto.js';
import { ListResponseDto } from '../dto/ListResponseDto.js';
import { NotFoundError, NotModifiedError } from '../../shared/errors/index.js';
import { JsonEntity } from '../../domain/entity/JsonEntity.js';

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
    const names = result.items.map(e => e.id);

    this.logger.info('Listed entities', { count: names.length, hasMore: !!result.nextCursor });

    return new ListResponseDto(names, result.nextCursor);
  }

  /**
   * Get entity by name
   * Returns entity data or throws NotModifiedError if ETag matches
   */
  async getEntity(id: string, ifNoneMatch?: string): Promise<EntityResponseDto> {
    this.logger.info('Getting entity', { id, ifNoneMatch });

    const entity = await this.repository.findByName(id, { ifNoneMatch });

    if (!entity) {
      throw new NotFoundError(`Entity '${id}' not found`);
    }

    this.logger.info('Got entity', { id, etag: entity.etag });

    return EntityResponseDto.fromEntity(entity);
  }

  /**
   * Get entity metadata only
   */
  async getEntityMetadata(id: string): Promise<{ etag?: string; size?: number; lastModified?: string }> {
    this.logger.info('Getting entity metadata', { id });

    const metadata = await this.repository.getMetadata(id);

    this.logger.info('Got entity metadata', { id, etag: metadata.etag });

    return metadata;
  }

  /**
   * Create new entity
   * Throws ConflictError if entity already exists
   */
  async createEntity(dto: CreateEntityDto): Promise<EntityResponseDto> {
    this.logger.info('Creating entity', { id: dto.id });

    // Create domain entity (will validate)
    const entity = new JsonEntity(dto.id, dto.data) as T;

    // Save with If-None-Match: * (create only)
    const saved = await this.repository.save(entity, { ifNoneMatch: '*' });

    this.logger.info('Created entity', { id: saved.id, etag: saved.etag });

    return EntityResponseDto.fromEntity(saved);
  }

  /**
   * Update entity (PUT or PATCH)
   * PUT: Replace entire data
   * PATCH: Merge partial data
   */
  async updateEntity(id: string, dto: UpdateEntityDto, ifMatch?: string): Promise<EntityResponseDto> {
    this.logger.info('Updating entity', { id, merge: dto.merge, ifMatch });

    // Load existing entity
    const existing = await this.repository.findByName(id);

    if (!existing) {
      // For PUT, we can create if it doesn't exist (unless If-Match is specified)
      if (ifMatch) {
        throw new NotFoundError(`Entity '${id}' not found`);
      }

      if (!dto.merge) {
        // PUT without If-Match: create new entity
        this.logger.info('Entity not found, creating new', { id });
        const entity = new JsonEntity(id, dto.data) as T;
        const saved = await this.repository.save(entity);
        return EntityResponseDto.fromEntity(saved);
      } else {
        // PATCH requires existing entity
        throw new NotFoundError(`Entity '${id}' not found`);
      }
    }

    // Update existing entity
    const updated = dto.merge
      ? existing.merge(dto.data)
      : new JsonEntity(id, dto.data, existing.etag, existing.metadata) as T;

    const saved = await this.repository.save(updated, { ifMatch });

    this.logger.info('Updated entity', { id, etag: saved.etag });

    return EntityResponseDto.fromEntity(saved);
  }

  /**
   * Delete entity
   */
  async deleteEntity(id: string, ifMatch?: string): Promise<void> {
    this.logger.info('Deleting entity', { id, ifMatch });

    await this.repository.delete(id, { ifMatch });

    this.logger.info('Deleted entity', { id });
  }
}

