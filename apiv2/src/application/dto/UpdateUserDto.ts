import { ValidationError } from '../../shared/errors/index.js';

export interface UpdateUserData {
  name?: string;
  externalId?: number;
}

export class UpdateUserDto {
  constructor(
    public readonly data: UpdateUserData,
    public readonly merge: boolean = false
  ) {
    this.validate();
  }

  static fromRequest(body: unknown, merge: boolean = false): UpdateUserDto {
    if (typeof body !== 'object' || body === null) {
      throw new ValidationError('Request body must be an object');
    }

    const obj = body as Record<string, unknown>;
    const updateData: UpdateUserData = {};

    // Validate name if provided
    if (obj.name !== undefined) {
      if (typeof obj.name !== 'string') {
        throw new ValidationError('Field "name" must be a string');
      }
      if (obj.name.length < 2 || obj.name.length > 100) {
        throw new ValidationError('Name must be between 2 and 100 characters');
      }
      updateData.name = obj.name;
    }

    // Validate externalId if provided
    if (obj.externalId !== undefined) {
      if (typeof obj.externalId !== 'number' || !Number.isInteger(obj.externalId)) {
        throw new ValidationError('Field "externalId" must be an integer');
      }
      if (obj.externalId < 1) {
        throw new ValidationError('External ID must be a positive integer');
      }
      updateData.externalId = obj.externalId;
    }

    // For replace mode, at least one field must be provided
    if (!merge && Object.keys(updateData).length === 0) {
      throw new ValidationError('At least one field (name or externalId) must be provided for update');
    }

    return new UpdateUserDto(updateData, merge);
  }

  private validate(): void {
    // Validate name if provided
    if (this.data.name !== undefined) {
      if (typeof this.data.name !== 'string') {
        throw new ValidationError('Name must be a string');
      }
      if (this.data.name.length < 2 || this.data.name.length > 100) {
        throw new ValidationError('Name must be between 2 and 100 characters');
      }
    }

    // Validate externalId if provided
    if (this.data.externalId !== undefined) {
      if (typeof this.data.externalId !== 'number' || !Number.isInteger(this.data.externalId)) {
        throw new ValidationError('External ID must be an integer');
      }
      if (this.data.externalId < 1) {
        throw new ValidationError('External ID must be a positive integer');
      }
    }

    // For replace mode, at least one field must be provided
    if (!this.merge && Object.keys(this.data).length === 0) {
      throw new ValidationError('At least one field (name or externalId) must be provided for update');
    }
  }
}
