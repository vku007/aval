import { BaseEntity } from './BaseEntity.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';

/**
 * Concrete entity implementation for JSON documents
 * Extends BaseEntity with no additional behavior (for now)
 */
export class JsonEntity extends BaseEntity {
  constructor(
    id: string,
    data: JsonValue,
    etag?: string,
    metadata?: EntityMetadata
  ) {
    super(id, data, etag, metadata);
  }
}

