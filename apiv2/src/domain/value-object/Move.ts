import { ValidationError } from "../../shared/errors/index.js";

export enum MoveType {
    Stone = 'Stone',
    Paper = 'Paper',
    Scissors = 'Scissors'
}

export class  MoveContext {
    constructor(
        public readonly moveType: MoveType,
        public readonly size: number,
        public readonly decorId: number
    ) {
        this.validateMoveType(moveType);
        this.validateSize(size);
        this.validateDecorId(decorId);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            moveType: this.moveType,
            size: this.size,
            decorId: this.decorId
        };
    }

    /**
     * Create a new MoveContext from JSON data
     */
    static fromJSON(data: any): MoveContext {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid move context data: must be an object');
        }

        if (!data.moveType || typeof data.moveType !== 'string') {
            throw new ValidationError('MoveContext moveType is required and must be a string');
        }

        if (!Object.values(MoveType).includes(data.moveType as MoveType)) {
            throw new ValidationError(`Invalid moveType: ${data.moveType}. Must be one of: ${Object.values(MoveType).join(', ')}`);
        }

        if (typeof data.size !== 'number') {
            throw new ValidationError('MoveContext size must be a number');
        }

        if (typeof data.decorId !== 'number') {
            throw new ValidationError('MoveContext decorId must be a number');
        }

        return new MoveContext(data.moveType as MoveType, data.size, data.decorId);
    }

    private validateMoveType(moveType: MoveType): void {
        if (!moveType) {
            throw new ValidationError('MoveContext moveType is required');
        }

        if (!Object.values(MoveType).includes(moveType)) {
            throw new ValidationError(`Invalid moveType: ${moveType}. Must be one of: ${Object.values(MoveType).join(', ')}`);
        }
    }

    private validateSize(size: number): void {
        if (typeof size !== 'number') {
            throw new ValidationError('MoveContext size must be a number');
        }

        if (!Number.isFinite(size)) {
            throw new ValidationError('MoveContext size must be a finite number');
        }

        if (!Number.isInteger(size)) {
            throw new ValidationError('MoveContext size must be an integer');
        }

        if (size < 0) {
            throw new ValidationError('MoveContext size must be a non-negative integer');
        }
    }

    private validateDecorId(decorId: number): void {
        if (typeof decorId !== 'number') {
            throw new ValidationError('MoveContext decorId must be a number');
        }

        if (!Number.isFinite(decorId)) {
            throw new ValidationError('MoveContext decorId must be a finite number');
        }

        if (!Number.isInteger(decorId)) {
            throw new ValidationError('MoveContext decorId must be an integer');
        }

        if (decorId < 0) {
            throw new ValidationError('MoveContext decorId must be a non-negative integer');
        }
    }
}

export class Move {
    constructor(
        public readonly userId: string,
        public readonly context: MoveContext,
        public readonly time: number
    ) {
        this.validateUserId(userId);
        this.validateContext(context);
        this.validateTime(time);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            userId: this.userId,
            context: this.context.toJSON(),
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

        if (!data.userId || typeof data.userId !== 'string') {
            throw new ValidationError('Move userId is required and must be a string');
        }

        if (!data.context) {
            throw new ValidationError('Move context is required');
        }

        if (typeof data.time !== 'number') {
            throw new ValidationError('Move time must be a number');
        }

        const context = MoveContext.fromJSON(data.context);
        return new Move(data.userId, context, data.time);
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

    private validateContext(context: MoveContext): void {
        if (!context || !(context instanceof MoveContext)) {
            throw new ValidationError('Move context is required and must be a MoveContext instance');
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