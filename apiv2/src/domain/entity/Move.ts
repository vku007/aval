import { ValidationError } from "../../shared/errors/index.js";

export class Move {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly value: number,
        public readonly valueDecorated: string,
        public readonly time: number
    ) {
        this.validateId(id);
        this.validateUserId(userId);
        this.validateValue(value);
        this.validateValueDecorated(valueDecorated);
        this.validateTime(time);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            userId: this.userId,
            value: this.value,
            valueDecorated: this.valueDecorated,
            time: this.time
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

        if (typeof data.time !== 'number') {
            throw new ValidationError('Move time must be a number');
        }

        return new Move(data.id, data.userId, data.value, data.valueDecorated, data.time);
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

    private validateTime(time: number): void {
        if (typeof time !== 'number') {
            throw new ValidationError('Move time must be a number');
        }

        if (!Number.isFinite(time)) {
            throw new ValidationError('Move time must be a finite number');
        }

        if (!Number.isInteger(time)) {
            throw new ValidationError('Move time must be an integer (Unix timestamp in milliseconds)');
        }

        // Validate that it's a reasonable Unix timestamp (after 1970-01-01 and before year 2100)
        const minTimestamp = 0; // 1970-01-01 00:00:00 UTC
        const maxTimestamp = 4102444800000; // 2100-01-01 00:00:00 UTC
        
        if (time < minTimestamp || time > maxTimestamp) {
            throw new ValidationError(
                `Move time must be a valid Unix timestamp in milliseconds between ${minTimestamp} and ${maxTimestamp}`
            );
        }
    }
}