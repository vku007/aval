import type { JsonValue } from '../../shared/types/common.js';
import type { BaseEntity } from '../../domain/entity/BaseEntity.js';

/**
 * DTO for entity responses
 */
export class EntityResponseDto {
  constructor(
    public readonly name: string,
    public readonly data: JsonValue,
    public readonly etag?: string,
    public readonly size?: number,
    public readonly lastModified?: string
  ) {}

  static fromEntity(entity: BaseEntity): EntityResponseDto {
    return new EntityResponseDto(
      entity.name,
      entity.data,
      entity.etag,
      entity.metadata?.size,
      entity.metadata?.lastModified
    );
  }

  /**
   * Return just the data (for GET response body)
   */
  toDataResponse(): JsonValue {
    return this.data;
  }

  /**
   * Return metadata only (for /meta endpoint)
   */
  toMetadataResponse(): { etag?: string; size?: number; lastModified?: string } {
    return {
      etag: this.etag,
      size: this.size,
      lastModified: this.lastModified
    };
  }
}

