import type { JsonValue } from '../../shared/types/common.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * DTO for updating entities (PUT/PATCH)
 */
export class UpdateEntityDto {
  constructor(
    public readonly data: JsonValue,
    public readonly merge: boolean = false // true for PATCH, false for PUT
  ) {
    this.validate();
  }

  static fromRequest(body: unknown, isPatch: boolean = false): UpdateEntityDto {
    if (body === undefined || body === null) {
      throw new ValidationError('Request body is required');
    }

    // For PUT/PATCH, the body IS the data
    return new UpdateEntityDto(body as JsonValue, isPatch);
  }

  private validate(): void {
    if (this.data === undefined) {
      throw new ValidationError('Data is required');
    }
  }
}

