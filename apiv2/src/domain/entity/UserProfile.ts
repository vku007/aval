import { ValidationError } from "../../shared/errors/index.js";

/**
 * UserProfile - Pure domain logic class (no backing store)
 * 
 * This class represents the core business logic for a user profile.
 * It is separate from UserEntity which handles persistence concerns.
 * 
 * Following the Delegating Backing Store Pattern:
 * - UserEntity = Persistence + Conversion
 * - UserProfile = Pure domain logic
 */
export class UserProfile {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly externalId: number
    ) {
        this.validateId(id);
        this.validateName(name);
        this.validateExternalId(externalId);
    }

    /**
     * Update the user's name
     * Returns a new UserProfile instance (immutable)
     */
    updateName(name: string): UserProfile {
        this.validateName(name);
        return new UserProfile(this.id, name, this.externalId);
    }

    /**
     * Update the user's external ID
     * Returns a new UserProfile instance (immutable)
     */
    updateExternalId(externalId: number): UserProfile {
        this.validateExternalId(externalId);
        return new UserProfile(this.id, this.name, externalId);
    }

    /**
     * Merge partial updates
     * Returns a new UserProfile instance (immutable)
     */
    merge(partial: Partial<{ name: string; externalId: number }>): UserProfile {
        const newName = partial.name !== undefined ? partial.name : this.name;
        const newExternalId = partial.externalId !== undefined ? partial.externalId : this.externalId;
        
        // Validate if changed
        if (partial.name !== undefined) {
            this.validateName(newName);
        }
        if (partial.externalId !== undefined) {
            this.validateExternalId(newExternalId);
        }
        
        return new UserProfile(this.id, newName, newExternalId);
    }

    /**
     * Check if user has a specific name
     */
    hasName(name: string): boolean {
        return this.name.toLowerCase() === name.toLowerCase();
    }

    /**
     * Check if external ID matches
     */
    hasExternalId(externalId: number): boolean {
        return this.externalId === externalId;
    }

    /**
     * Get display name (could be enhanced with formatting logic)
     */
    getDisplayName(): string {
        return this.name;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            name: this.name,
            externalId: this.externalId
        };
    }

    /**
     * Create a new UserProfile from JSON data
     */
    static fromJSON(data: any): UserProfile {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid user profile data: must be an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new ValidationError('User profile ID is required and must be a string');
        }

        if (!data.name || typeof data.name !== 'string') {
            throw new ValidationError('User profile name is required and must be a string');
        }

        if (typeof data.externalId !== 'number') {
            throw new ValidationError('User profile externalId must be a number');
        }

        return new UserProfile(data.id, data.name, data.externalId);
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

    private validateName(name: string): void {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('User name is required and must be a string');
        }

        if (name.trim().length === 0) {
            throw new ValidationError('User name cannot be empty');
        }

        if (name.length < 2 || name.length > 100) {
            throw new ValidationError('User name must be between 2 and 100 characters');
        }
    }

    private validateExternalId(externalId: number): void {
        if (typeof externalId !== 'number') {
            throw new ValidationError('External ID must be a number');
        }

        if (!Number.isInteger(externalId)) {
            throw new ValidationError('External ID must be an integer');
        }

        if (externalId < 1) {
            throw new ValidationError('External ID must be a positive integer');
        }
    }
}

