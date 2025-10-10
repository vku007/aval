import { User } from '../../domain/entity/User.js';
import { ValidationError } from '../../shared/errors/index.js';

export class CreateUserDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number
  ) {
    this.validate();
  }

  static fromRequest(body: unknown): CreateUserDto {
    if (typeof body !== 'object' || body === null) {
      throw new ValidationError('Request body must be an object');
    }

    const obj = body as Record<string, unknown>;

    if (typeof obj.id !== 'string') {
      throw new ValidationError('Field "id" is required and must be a string');
    }

    if (typeof obj.name !== 'string') {
      throw new ValidationError('Field "name" is required and must be a string');
    }

    if (typeof obj.externalId !== 'number' || !Number.isInteger(obj.externalId)) {
      throw new ValidationError('Field "externalId" is required and must be an integer');
    }

    return new CreateUserDto(obj.id, obj.name, obj.externalId);
  }

  private validate(): void {
    if (!this.id || typeof this.id !== 'string') {
      throw new ValidationError('ID is required and must be a string');
    }

    if (!this.name || typeof this.name !== 'string') {
      throw new ValidationError('Name is required and must be a string');
    }

    if (this.name.length < 2 || this.name.length > 100) {
      throw new ValidationError('Name must be between 2 and 100 characters');
    }

    if (typeof this.externalId !== 'number' || !Number.isInteger(this.externalId)) {
      throw new ValidationError('External ID must be an integer');
    }

    if (this.externalId < 1) {
      throw new ValidationError('External ID must be a positive integer');
    }
  }

  toUser(): User {
    return User.create(this.id, this.name, this.externalId);
  }
}
