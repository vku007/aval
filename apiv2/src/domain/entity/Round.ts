import { Move } from "./Move.js";
import { ValidationError } from "../../shared/errors/index.js";

export class Round {
    constructor(
        public readonly id: string,
        public readonly moves: Move[],
        public readonly isFinished: boolean
    ) {
        this.validateId(id);
        this.validateMoves(moves);
        this.validateIsFinished(isFinished);
    }

    /**
     * Add a move to this round
     * Returns a new Round instance (immutable)
     */
    addMove(move: Move): Round {
        this.validateMove(move);
        return new Round(this.id, [...this.moves, move], this.isFinished);
    }

    /**
     * Set the finished status of this round
     * Returns a new Round instance (immutable)
     */
    setFinished(finished: boolean): Round {
        this.validateIsFinished(finished);
        return new Round(this.id, this.moves, finished);
    }

    /**
     * Finish this round
     * Returns a new Round instance with isFinished = true
     */
    finish(): Round {
        return new Round(this.id, this.moves, true);
    }

    /**
     * Check if round has any moves
     */
    hasMoves(): boolean {
        return this.moves.length > 0;
    }

    /**
     * Get the number of moves in this round
     */
    getMoveCount(): number {
        return this.moves.length;
    }

    /**
     * Get the last move in this round (if any)
     */
    getLastMove(): Move | undefined {
        return this.moves.length > 0 ? this.moves[this.moves.length - 1] : undefined;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            moves: this.moves.map(move => move.toJSON()),
            isFinished: this.isFinished
        };
    }

    /**
     * Create a new Round from JSON data
     */
    static fromJSON(data: any): Round {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid round data: must be an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new ValidationError('Round ID is required and must be a string');
        }

        if (!Array.isArray(data.moves)) {
            throw new ValidationError('Round moves must be an array');
        }

        if (typeof data.isFinished !== 'boolean') {
            throw new ValidationError('Round isFinished must be a boolean');
        }

        const moves = data.moves.map((moveData: any) => Move.fromJSON(moveData));
        return new Round(data.id, moves, data.isFinished);
    }

    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Round ID is required and must be a string');
        }

        if (id.trim().length === 0) {
            throw new ValidationError('Round ID cannot be empty');
        }

        // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
            throw new ValidationError(
                `Invalid round id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateMoves(moves: Move[]): void {
        if (!Array.isArray(moves)) {
            throw new ValidationError('Round moves must be an array');
        }

        // Validate each move
        moves.forEach((move, index) => {
            if (!(move instanceof Move)) {
                throw new ValidationError(`Move at index ${index} must be a Move instance`);
            }
        });
    }

    private validateIsFinished(isFinished: boolean): void {
        if (typeof isFinished !== 'boolean') {
            throw new ValidationError('Round isFinished must be a boolean');
        }
    }

    private validateMove(move: Move): void {
        if (!(move instanceof Move)) {
            throw new ValidationError('Move must be a Move instance');
        }
    }
}