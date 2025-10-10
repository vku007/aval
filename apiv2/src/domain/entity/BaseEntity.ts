import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * Base entity class that all domain entities extend
 * Represents a stored JSON document with metadata
 */
export abstract class BaseEntity {
  constructor(
    public readonly id: string,
    public readonly data: JsonValue,
    public readonly etag?: string,
    public readonly metadata?: EntityMetadata
  ) {
    this.validate();
  }

  /**
   * Create a new entity with validation
   */
  static create<T extends BaseEntity>(
    this: new (id: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) => T,
    id: string,
    data: JsonValue
  ): T {
    return new this(id, data);
  }

  /**
   * Merge partial data with existing data (deep merge)
   */
  merge(partial: JsonValue): this {
    const merged = this.deepMerge(this.data, partial);
    return new (this.constructor as any)(this.id, merged, this.etag, this.metadata);
  }

  /**
   * Validate entity invariants
   * Override in subclasses for entity-specific validation
   */
  protected validate(): void {
    if (!this.isValidId(this.id)) {
      throw new ValidationError(
        `Invalid entity id: ${this.id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`,
        'id'
      );
    }
  }

  /**
   * Check if id follows naming rules
   */
  protected isValidId(id: string): boolean {
    return /^[a-zA-Z0-9._-]{1,128}$/.test(id);
  }

  /**
   * Deep merge two JSON values
   * Arrays are replaced, objects are recursively merged
   */
  protected deepMerge(target: JsonValue, source: JsonValue): JsonValue {
    if (Array.isArray(target) && Array.isArray(source)) {
      return source; // Replace arrays
    }

    if (this.isObject(target) && this.isObject(source)) {
      const result: Record<string, JsonValue> = { ...target };
      for (const key of Object.keys(source)) {
        result[key] = this.deepMerge(
          target[key] as JsonValue,
          source[key] as JsonValue
        );
      }
      return result;
    }

    return source; // Primitive values: replace
  }

  private isObject(value: unknown): value is Record<string, JsonValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Get entity type (useful for polymorphism)
   */
  getType(): string {
    return this.constructor.name;
  }

  /**
   * Clone entity with new ETag
   */
  withETag(etag: string): this {
    return new (this.constructor as any)(this.id, this.data, etag, this.metadata);
  }

  /**
   * Clone entity with new metadata
   */
  withMetadata(metadata: EntityMetadata): this {
    return new (this.constructor as any)(this.id, this.data, this.etag, metadata);
  }
}

