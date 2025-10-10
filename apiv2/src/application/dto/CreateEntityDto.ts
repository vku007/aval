import type { JsonValue } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * DTO for creating new entities
 */
export class CreateEntityDto {
  constructor(
    public readonly id: string,
    public readonly data: JsonValue
  ) {
    this.validate();
  }

  static fromRequest(body: unknown): CreateEntityDto {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be a JSON object');
    }

    const obj = body as Record<string, unknown>;

    if (typeof obj.id !== 'string') {
      throw new ValidationError('Field "id" is required and must be a string', 'id');
    }

    if (obj.data === undefined) {
      throw new ValidationError('Field "data" is required', 'data');
    }

    return new CreateEntityDto(obj.id, obj.data as JsonValue);
  }

  private validate(): void {
    if (!this.id || typeof this.id !== 'string') {
      throw new ValidationError('ID is required and must be a string', 'id');
    }

    if (this.id.length === 0 || this.id.length > 128) {
      throw new ValidationError('ID must be between 1 and 128 characters', 'id');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(this.id)) {
      throw new ValidationError('ID must contain only alphanumeric characters, dots, hyphens, and underscores', 'id');
    }
  }
}

