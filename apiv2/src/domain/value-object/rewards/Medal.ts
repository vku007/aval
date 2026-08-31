import { ValidationError } from "../../../shared/errors/index.js";
import { GameTypeLength } from "../../entity/Game.js";

export enum Material {
    Gold = 'Gold',
    Silver = 'Silver',
    Copper = 'Copper'
}

export class Medal {
    constructor(
        public readonly issuerId: number,
        public readonly enemyId: number,
        public readonly createdTime: number,
        public readonly madeOf: Material,
        public readonly gameLength: GameTypeLength
    ) {
        this.validateIssuerId(issuerId);
        this.validateEnemyId(enemyId);
        this.validateCreatedTime(createdTime);
        this.validateMadeOf(madeOf);
        this.validateGameLength(gameLength);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            issuerId: this.issuerId,
            enemyId: this.enemyId,
            createdTime: this.createdTime,
            madeOf: this.madeOf,
            gameLength: this.gameLength
        };
    }

    /**
     * Create a new Medal from JSON data
     */
    static fromJSON(data: any): Medal {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid medal data: must be an object');
        }

        if (typeof data.issuerId !== 'number') {
            throw new ValidationError('Medal issuerId is required and must be a number');
        }

        if (typeof data.enemyId !== 'number') {
            throw new ValidationError('Medal enemyId is required and must be a number');
        }

        if (typeof data.createdTime !== 'number') {
            throw new ValidationError('Medal createdTime is required and must be a number');
        }

        if (!data.madeOf || typeof data.madeOf !== 'string') {
            throw new ValidationError('Medal madeOf is required and must be a string');
        }

        if (!Object.values(Material).includes(data.madeOf as Material)) {
            throw new ValidationError(`Invalid madeOf: ${data.madeOf}. Must be one of: ${Object.values(Material).join(', ')}`);
        }

        if (!data.gameLength || typeof data.gameLength !== 'string') {
            throw new ValidationError('Medal gameLength is required and must be a string');
        }

        if (!Object.values(GameTypeLength).includes(data.gameLength as GameTypeLength)) {
            throw new ValidationError(`Invalid gameLength: ${data.gameLength}. Must be one of: ${Object.values(GameTypeLength).join(', ')}`);
        }

        return new Medal(
            data.issuerId, 
            data.enemyId, 
            data.createdTime, 
            data.madeOf as Material, 
            data.gameLength as GameTypeLength
        );
    }

    private validateIssuerId(issuerId: number): void {
        if (typeof issuerId !== 'number') {
            throw new ValidationError('Medal issuerId must be a number');
        }

        if (!Number.isFinite(issuerId)) {
            throw new ValidationError('Medal issuerId must be a finite number');
        }

        if (!Number.isInteger(issuerId)) {
            throw new ValidationError('Medal issuerId must be an integer');
        }

        if (issuerId < 0) {
            throw new ValidationError('Medal issuerId must be a non-negative integer');
        }
    }

    private validateEnemyId(enemyId: number): void {
        if (typeof enemyId !== 'number') {
            throw new ValidationError('Medal enemyId must be a number');
        }

        if (!Number.isFinite(enemyId)) {
            throw new ValidationError('Medal enemyId must be a finite number');
        }

        if (!Number.isInteger(enemyId)) {
            throw new ValidationError('Medal enemyId must be an integer');
        }

        if (enemyId < 0) {
            throw new ValidationError('Medal enemyId must be a non-negative integer');
        }
    }

    private validateCreatedTime(createdTime: number): void {
        if (typeof createdTime !== 'number') {
            throw new ValidationError('Medal createdTime must be a number');
        }

        if (!Number.isFinite(createdTime)) {
            throw new ValidationError('Medal createdTime must be a finite number');
        }

        if (!Number.isInteger(createdTime)) {
            throw new ValidationError('Medal createdTime must be an integer (Unix timestamp in milliseconds)');
        }

        if (createdTime < 0) {
            throw new ValidationError('Medal createdTime must be a positive number');
        }

        // Validate that it's a reasonable Unix timestamp (after 1970-01-01 and before year 2100)
        const minTimestamp = 0; // 1970-01-01 00:00:00 UTC
        const maxTimestamp = 4102444800000; // 2100-01-01 00:00:00 UTC
        
        if (createdTime < minTimestamp || createdTime > maxTimestamp) {
            throw new ValidationError(
                `Medal createdTime must be a valid Unix timestamp in milliseconds between ${minTimestamp} and ${maxTimestamp}`
            );
        }
    }

    private validateMadeOf(madeOf: Material): void {
        if (!madeOf) {
            throw new ValidationError('Medal madeOf is required');
        }

        if (!Object.values(Material).includes(madeOf)) {
            throw new ValidationError(`Invalid madeOf: ${madeOf}. Must be one of: ${Object.values(Material).join(', ')}`);
        }
    }

    private validateGameLength(gameLength: GameTypeLength): void {
        if (!gameLength) {
            throw new ValidationError('Medal gameLength is required');
        }

        if (!Object.values(GameTypeLength).includes(gameLength)) {
            throw new ValidationError(`Invalid gameLength: ${gameLength}. Must be one of: ${Object.values(GameTypeLength).join(', ')}`);
        }
    }
}
