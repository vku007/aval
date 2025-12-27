import { Move } from './Move.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * SubRound represents a sub-round with moves and timestamps.
 */
export class SubRound {
    constructor(
        public readonly idNum: number,
        public readonly moves: Move[],
        public readonly startAt: number,
        public readonly finishedAt: number,
        public readonly updatedAt: number
    ) {
        this.validateIdNum(idNum);
        this.validateMoves(moves);
        this.validateStartAt(startAt);
        this.validateFinishedAt(finishedAt);
        this.validateUpdatedAt(updatedAt);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            idNum: this.idNum,
            moves: this.moves.map(move => move.toJSON()),
            startAt: this.startAt,
            finishedAt: this.finishedAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Create a new SubRound from JSON data
     */
    static fromJSON(data: any): SubRound {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid sub-round data: must be an object');
        }

        if (typeof data.idNum !== 'number') {
            throw new ValidationError('SubRound idNum is required and must be a number');
        }

        if (!Array.isArray(data.moves)) {
            throw new ValidationError('SubRound moves must be an array');
        }

        if (typeof data.startAt !== 'number') {
            throw new ValidationError('SubRound startAt is required and must be a number');
        }

        if (typeof data.finishedAt !== 'number') {
            throw new ValidationError('SubRound finishedAt is required and must be a number');
        }

        if (typeof data.updatedAt !== 'number') {
            throw new ValidationError('SubRound updatedAt is required and must be a number');
        }

        const moves = data.moves.map((moveData: any) => Move.fromJSON(moveData));
        return new SubRound(
            data.idNum,
            moves,
            data.startAt,
            data.finishedAt,
            data.updatedAt
        );
    }

    private validateIdNum(idNum: number): void {
        if (typeof idNum !== 'number') {
            throw new ValidationError('SubRound idNum must be a number');
        }

        if (!Number.isInteger(idNum)) {
            throw new ValidationError('SubRound idNum must be an integer');
        }

        if (idNum < 0) {
            throw new ValidationError('SubRound idNum must be a non-negative integer');
        }
    }

    private validateMoves(moves: Move[]): void {
        if (!Array.isArray(moves)) {
            throw new ValidationError('SubRound moves must be an array');
        }

        // Validate each move
        moves.forEach((move, index) => {
            if (!(move instanceof Move)) {
                throw new ValidationError(`Move at index ${index} must be a Move instance`);
            }
        });
    }

    private validateStartAt(startAt: number): void {
        if (typeof startAt !== 'number') {
            throw new ValidationError('SubRound startAt must be a number');
        }

        if (!Number.isInteger(startAt)) {
            throw new ValidationError('SubRound startAt must be an integer');
        }

        if (startAt < 0) {
            throw new ValidationError('SubRound startAt must be a positive number');
        }

        // Check if it's a reasonable Unix timestamp (after 1970, before year 3000)
        const minTimestamp = 0; // January 1, 1970
        const maxTimestamp = 32503680000000; // January 1, 3000
        
        if (startAt < minTimestamp || startAt > maxTimestamp) {
            throw new ValidationError('SubRound startAt must be a valid Unix timestamp in milliseconds');
        }
    }

    private validateFinishedAt(finishedAt: number): void {
        if (typeof finishedAt !== 'number') {
            throw new ValidationError('SubRound finishedAt must be a number');
        }

        if (!Number.isInteger(finishedAt)) {
            throw new ValidationError('SubRound finishedAt must be an integer');
        }

        if (finishedAt < 0) {
            throw new ValidationError('SubRound finishedAt must be a positive number');
        }

        // Check if it's a reasonable Unix timestamp (after 1970, before year 3000)
        const minTimestamp = 0; // January 1, 1970
        const maxTimestamp = 32503680000000; // January 1, 3000
        
        if (finishedAt < minTimestamp || finishedAt > maxTimestamp) {
            throw new ValidationError('SubRound finishedAt must be a valid Unix timestamp in milliseconds');
        }
    }

    private validateUpdatedAt(updatedAt: number): void {
        if (typeof updatedAt !== 'number') {
            throw new ValidationError('SubRound updatedAt must be a number');
        }

        if (!Number.isInteger(updatedAt)) {
            throw new ValidationError('SubRound updatedAt must be an integer');
        }

        if (updatedAt < 0) {
            throw new ValidationError('SubRound updatedAt must be a positive number');
        }

        // Check if it's a reasonable Unix timestamp (after 1970, before year 3000)
        const minTimestamp = 0; // January 1, 1970
        const maxTimestamp = 32503680000000; // January 1, 3000
        
        if (updatedAt < minTimestamp || updatedAt > maxTimestamp) {
            throw new ValidationError('SubRound updatedAt must be a valid Unix timestamp in milliseconds');
        }
    }
}

