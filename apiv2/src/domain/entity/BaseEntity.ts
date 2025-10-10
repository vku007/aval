import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * Base entity class that all domain entities extend
 * Represents a stored JSON document with metadata
 */
export abstract class BaseEntity {
  constructor(
    public readonly name: string,
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
    this: new (name: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) => T,
    name: string,
    data: JsonValue
  ): T {
    return new this(name, data);
  }

  /**
   * Merge partial data with existing data (deep merge)
   */
  merge(partial: JsonValue): this {
    const merged = this.deepMerge(this.data, partial);
    return new (this.constructor as any)(this.name, merged, this.etag, this.metadata);
  }

  /**
   * Validate entity invariants
   * Override in subclasses for entity-specific validation
   */
  protected validate(): void {
    if (!this.isValidName(this.name)) {
      throw new ValidationError(
        `Invalid entity name: ${this.name}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`,
        'name'
      );
    }
  }

  /**
   * Check if name follows naming rules
   */
  protected isValidName(name: string): boolean {
    return /^[a-zA-Z0-9._-]{1,128}$/.test(name);
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
    return new (this.constructor as any)(this.name, this.data, etag, this.metadata);
  }

  /**
   * Clone entity with new metadata
   */
  withMetadata(metadata: EntityMetadata): this {
    return new (this.constructor as any)(this.name, this.data, this.etag, metadata);
  }
}

