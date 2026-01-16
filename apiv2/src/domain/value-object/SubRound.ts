import { Move } from './Move.js';
import { ValidationError } from '../../shared/errors/index.js';
import { SubRoundStatus } from './SubRoundStatus.js';

/**
 * SubRound represents a sub-round with moves and timestamps.
 * SubRound could be draw 
 */
export class SubRound {
    public moves: Move[];
    public status: SubRoundStatus;
    public winnerId?: string;

    constructor(
        public readonly idNum: number,
        public startAt: number,
        public finishedAt: number | null,
        public updatedAt: number
    ) {
        // Initialize moves to empty array
        this.moves = [];
        // Initialize status to Init
        this.status = SubRoundStatus.Init;
        
        this.validateIdNum(idNum);
        this.validateMoves(this.moves);
        this.validateStartAt(startAt);
        this.validateFinishedAt(finishedAt);
        this.validateUpdatedAt(updatedAt);
        this.validateStatus(this.status);
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
            updatedAt: this.updatedAt,
            status: this.status,
            winnerId: this.winnerId
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

        if (data.finishedAt !== null && data.finishedAt !== undefined && typeof data.finishedAt !== 'number') {
            throw new ValidationError('SubRound finishedAt must be a number or null');
        }

        if (typeof data.updatedAt !== 'number') {
            throw new ValidationError('SubRound updatedAt is required and must be a number');
        }

        if (data.status !== undefined && data.status !== null) {
            if (typeof data.status !== 'string' || !Object.values(SubRoundStatus).includes(data.status as SubRoundStatus)) {
                throw new ValidationError(`SubRound status must be a valid SubRoundStatus enum value`);
            }
        }

        const moves = data.moves.map((moveData: any) => Move.fromJSON(moveData));
        const subRound = new SubRound(
            data.idNum,
            data.startAt,
            data.finishedAt ?? null,
            data.updatedAt
        );
        subRound.moves = moves;
        subRound.status = data.status !== undefined ? (data.status as SubRoundStatus) : SubRoundStatus.Init;
        if (data.winnerId !== undefined && data.winnerId !== null) {
            subRound.winnerId = data.winnerId;
        }
        return subRound;
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

    private validateFinishedAt(finishedAt: number | null): void {
        if (finishedAt === null || finishedAt === undefined) {
            return; // null is allowed
        }

        if (typeof finishedAt !== 'number') {
            throw new ValidationError('SubRound finishedAt must be a number or null');
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

    private validateStatus(status: SubRoundStatus): void {
        if (!status || !Object.values(SubRoundStatus).includes(status)) {
            throw new ValidationError(`status must be one of: ${Object.values(SubRoundStatus).join(', ')}`);
        }
    }
}

