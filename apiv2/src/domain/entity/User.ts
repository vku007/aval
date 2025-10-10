import { ValidationError } from '../../shared/errors/index.js';

export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number
  ) {
    this.validateId();
    this.validateUserData();
  }

  static create(id: string, name: string, externalId: number): User {
    return new User(id, name, externalId);
  }

  updateName(name: string): User {
    return new User(this.id, name, this.externalId);
  }

  updateExternalId(externalId: number): User {
    return new User(this.id, this.name, externalId);
  }

  merge(partial: Partial<{ name: string; externalId: number }>): User {
    return new User(
      this.id,
      partial.name ?? this.name,
      partial.externalId ?? this.externalId
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      externalId: this.externalId
    };
  }

  private validateId(): void {
    if (!this.id || typeof this.id !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(this.id)) {
      throw new ValidationError(
        `Invalid user id: ${this.id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
      );
    }
  }

  private validateUserData(): void {
    if (!this.name || typeof this.name !== 'string') {
      throw new ValidationError('User name is required and must be a string');
    }
    
    if (this.name.length < 2 || this.name.length > 100) {
      throw new ValidationError('User name must be between 2 and 100 characters');
    }
    
    if (typeof this.externalId !== 'number' || !Number.isInteger(this.externalId)) {
      throw new ValidationError('External ID must be an integer');
    }
    
    if (this.externalId < 1) {
      throw new ValidationError('External ID must be a positive integer');
    }
  }
}
