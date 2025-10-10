import type { BaseEntity } from '../entity/BaseEntity.js';
import type { ListResult, EntityMetadata } from '../../shared/types/common.js';

/**
 * Options for conditional operations
 */
export interface SaveOptions {
  ifMatch?: string;      // Require specific ETag (update only if matches)
  ifNoneMatch?: string;  // "*" means create only if doesn't exist
}

export interface FindOptions {
  ifNoneMatch?: string;  // Return 304 if ETag matches
}

/**
 * Repository interface for entity persistence (Port)
 * Implementations handle the actual storage (Adapters)
 */
export interface IEntityRepository<T extends BaseEntity = BaseEntity> {
  /**
   * Find all entities with optional filtering and pagination
   */
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<ListResult<T>>;

  /**
   * Find entity by name
   * Returns null if not found
   * Throws NotModifiedError if ifNoneMatch matches current ETag
   */
  findByName(name: string, opts?: FindOptions): Promise<T | null>;

  /**
   * Save (create or update) entity
   * Returns entity with new ETag
   * Throws ConflictError if ifNoneMatch="*" and entity exists
   * Throws PreconditionFailedError if ifMatch doesn't match current ETag
   */
  save(entity: T, opts?: SaveOptions): Promise<T>;

  /**
   * Delete entity by name
   * Throws NotFoundError if entity doesn't exist
   * Throws PreconditionFailedError if ifMatch doesn't match current ETag
   */
  delete(name: string, opts?: SaveOptions): Promise<void>;

  /**
   * Get entity metadata without loading full data
   * Throws NotFoundError if entity doesn't exist
   */
  getMetadata(name: string): Promise<EntityMetadata>;

  /**
   * Check if entity exists
   */
  exists(name: string): Promise<boolean>;
}

