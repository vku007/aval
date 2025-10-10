import type { JsonValue } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * DTO for creating new entities
 */
export class CreateEntityDto {
  constructor(
    public readonly name: string,
    public readonly data: JsonValue
  ) {
    this.validate();
  }

  static fromRequest(body: unknown): CreateEntityDto {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be a JSON object');
    }

    const obj = body as Record<string, unknown>;

    if (typeof obj.name !== 'string') {
      throw new ValidationError('Field "name" is required and must be a string', 'name');
    }

    if (obj.data === undefined) {
      throw new ValidationError('Field "data" is required', 'data');
    }

    return new CreateEntityDto(obj.name, obj.data as JsonValue);
  }

  private validate(): void {
    if (!this.name || typeof this.name !== 'string') {
      throw new ValidationError('Name is required and must be a string', 'name');
    }

    if (this.name.length === 0 || this.name.length > 128) {
      throw new ValidationError('Name must be between 1 and 128 characters', 'name');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(this.name)) {
      throw new ValidationError('Name must contain only alphanumeric characters, dots, hyphens, and underscores', 'name');
    }
  }
}

