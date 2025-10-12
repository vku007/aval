import { ValidationError } from '../../shared/errors/index.js';
import { JsonEntity } from './JsonEntity.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';

// Define the data structure for better type safety
interface UserData {
  name: string;
  externalId: number;
}

export class User {
  private readonly _backed: JsonEntity;

  constructor(
    id: string,
    name: string,
    externalId: number,
    etag?: string,
    metadata?: EntityMetadata
  ) {
    this.validateId(id);
    this.validateUserData(name, externalId);
    
    // Store all values in the backed JsonEntity with proper typing
    const userData: UserData = { name, externalId };
    this._backed = new JsonEntity(id, userData as unknown as JsonValue, etag, metadata);
  }

  // Read-only properties that read from backed field
  get id(): string {
    return this._backed.id;
  }

  get name(): string {
    return this.getUserData().name;
  }

  get externalId(): number {
    return this.getUserData().externalId;
  }

  // Read-only access to entity metadata (etag, size, lastModified)
  get metadata(): EntityMetadata | undefined {
    return this._backed.metadata;
  }

  // Removed backed getter - implementation detail is now hidden
  // If needed for persistence layer, use internal methods instead

  // Helper method for type-safe access to user data
  private getUserData(): UserData {
    return this._backed.data as unknown as UserData;
  }

  // Internal methods for persistence layer (not part of public API)
  internalGetBackingStore(): JsonEntity {
    return this._backed;
  }

  internalCreateFromBackingStore(backed: JsonEntity): User {
    const userData = backed.data as unknown as UserData;
    return new User(backed.id, userData.name, userData.externalId, backed.etag, backed.metadata);
  }

  static create(id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata): User {
    return new User(id, name, externalId, etag, metadata);
  }

  updateName(name: string): User {
    return new User(this.id, name, this.externalId, this._backed.etag, this._backed.metadata);
  }

  updateExternalId(externalId: number): User {
    return new User(this.id, this.name, externalId, this._backed.etag, this._backed.metadata);
  }

  // Removed updateBacked - use internalCreateFromBackingStore for persistence operations

  merge(partial: Partial<UserData>): User {
    const currentData = this.getUserData();
    return new User(
      this.id,
      partial.name ?? currentData.name,
      partial.externalId ?? currentData.externalId,
      this._backed.etag,
      this._backed.metadata
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      externalId: this.externalId
    };
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
      throw new ValidationError(
        `Invalid user id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
      );
    }
  }

  private validateUserData(name: string, externalId: number): void {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('User name is required and must be a string');
    }
    
    if (name.length < 2 || name.length > 100) {
      throw new ValidationError('User name must be between 2 and 100 characters');
    }
    
    if (typeof externalId !== 'number' || !Number.isInteger(externalId)) {
      throw new ValidationError('External ID must be an integer');
    }
    
    if (externalId < 1) {
      throw new ValidationError('External ID must be a positive integer');
    }
  }
}
