import { ValidationError } from '../../shared/errors/index.js';
import { JsonEntity } from './JsonEntity.js';
import { UserProfile } from './UserProfile.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';

// Define the data structure for better type safety
interface UserData {
  name: string;
  externalId: number;
}

/**
 * UserEntity - Persistence and conversion layer
 * 
 * This class handles persistence concerns and delegates domain logic to UserProfile.
 * 
 * Following the Delegating Backing Store Pattern:
 * - UserEntity = Persistence + Conversion (this class)
 * - UserProfile = Pure domain logic (separate class)
 * 
 * Architecture:
 * UserEntity (persistence) → UserProfile (domain logic) → operations → back to UserEntity
 */
export class UserEntity {
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

  // Helper method for type-safe access to user data
  private getUserData(): UserData {
    return this._backed.data as unknown as UserData;
  }

  // Internal methods for persistence layer (not part of public API)
  internalGetBackingStore(): JsonEntity {
    return this._backed;
  }

  internalCreateFromBackingStore(backed: JsonEntity): UserEntity {
    const userData = backed.data as unknown as UserData;
    return new UserEntity(backed.id, userData.name, userData.externalId, backed.etag, backed.metadata);
  }

  // Factory method
  static create(id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata): UserEntity {
    return new UserEntity(id, name, externalId, etag, metadata);
  }

  // Immutable operations that delegate to UserProfile class
  updateName(name: string): UserEntity {
    const profile = this.toUserProfile();
    const updatedProfile = profile.updateName(name);
    return this.fromUserProfile(updatedProfile);
  }

  updateExternalId(externalId: number): UserEntity {
    const profile = this.toUserProfile();
    const updatedProfile = profile.updateExternalId(externalId);
    return this.fromUserProfile(updatedProfile);
  }

  merge(partial: Partial<UserData>): UserEntity {
    const profile = this.toUserProfile();
    const updatedProfile = profile.merge(partial);
    return this.fromUserProfile(updatedProfile);
  }

  // Utility methods that delegate to UserProfile class
  hasName(name: string): boolean {
    return this.toUserProfile().hasName(name);
  }

  hasExternalId(externalId: number): boolean {
    return this.toUserProfile().hasExternalId(externalId);
  }

  getDisplayName(): string {
    return this.toUserProfile().getDisplayName();
  }

  // Conversion methods between UserEntity and UserProfile
  private toUserProfile(): UserProfile {
    const userData = this.getUserData();
    return new UserProfile(this.id, userData.name, userData.externalId);
  }

  private fromUserProfile(profile: UserProfile): UserEntity {
    return new UserEntity(
      profile.id,
      profile.name,
      profile.externalId,
      this._backed.etag,
      this._backed.metadata
    );
  }

  // JSON serialization
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      externalId: this.externalId
    };
  }

  static fromJSON(data: any): UserEntity {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid user entity data: must be an object');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new ValidationError('User entity ID is required and must be a string');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('User entity name is required and must be a string');
    }

    if (typeof data.externalId !== 'number') {
      throw new ValidationError('User entity externalId must be a number');
    }

    return new UserEntity(data.id, data.name, data.externalId);
  }

  // Validation methods
  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    if (id.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty');
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

// Export UserEntity as User for backward compatibility
export { UserEntity as User };
