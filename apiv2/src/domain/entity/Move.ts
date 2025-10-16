import { ValidationError } from "../../shared/errors/index.js";

export class Move {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly value: number,
        public readonly valueDecorated: string
    ) {
        this.validateId(id);
        this.validateUserId(userId);
        this.validateValue(value);
        this.validateValueDecorated(valueDecorated);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            userId: this.userId,
            value: this.value,
            valueDecorated: this.valueDecorated
        };
    }

    /**
     * Create a new Move from JSON data
     */
    static fromJSON(data: any): Move {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid move data: must be an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new ValidationError('Move ID is required and must be a string');
        }

        if (!data.userId || typeof data.userId !== 'string') {
            throw new ValidationError('Move userId is required and must be a string');
        }

        if (typeof data.value !== 'number') {
            throw new ValidationError('Move value must be a number');
        }

        if (typeof data.valueDecorated !== 'string') {
            throw new ValidationError('Move valueDecorated must be a string');
        }

        return new Move(data.id, data.userId, data.value, data.valueDecorated);
    }

    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Move ID is required and must be a string');
        }

        if (id.trim().length === 0) {
            throw new ValidationError('Move ID cannot be empty');
        }

        // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
            throw new ValidationError(
                `Invalid move id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateUserId(userId: string): void {
        if (!userId || typeof userId !== 'string') {
            throw new ValidationError('Move userId is required and must be a string');
        }

        if (userId.trim().length === 0) {
            throw new ValidationError('Move userId cannot be empty');
        }

        // User ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(userId)) {
            throw new ValidationError(
                `Invalid move userId: ${userId}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateValue(value: number): void {
        if (typeof value !== 'number') {
            throw new ValidationError('Move value must be a number');
        }

        if (!Number.isFinite(value)) {
            throw new ValidationError('Move value must be a finite number');
        }
    }

    private validateValueDecorated(valueDecorated: string): void {
        if (!valueDecorated || typeof valueDecorated !== 'string') {
            throw new ValidationError('Move valueDecorated is required and must be a string');
        }
    }
}