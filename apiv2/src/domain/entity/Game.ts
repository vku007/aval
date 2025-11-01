import { Round } from "../value-object/Round.js";
import { Move } from "../value-object/Move.js";
import { ValidationError } from "../../shared/errors/index.js";

export class Game {
    constructor(
        public readonly id: string,
        public readonly type: string, // how many rounds, for example
        public readonly usersIds: string[],
        public readonly rounds: Round[],
        public readonly isFinished: boolean
    ) {
        this.validateId(id);
        this.validateType(type);
        this.validateUsersIds(usersIds);
        this.validateRounds(rounds);
        this.validateIsFinished(isFinished);
    }

    /**
     * Add a round to this game
     * Returns a new Game instance (immutable)
     */
    addRound(round: Round): Game {
        this.validateRound(round);
        return new Game(this.id, this.type, this.usersIds, [...this.rounds, round], this.isFinished);
    }

    /**
     * Set the finished status of this game
     * Returns a new Game instance (immutable)
     */
    setFinished(finished: boolean): Game {
        this.validateIsFinished(finished);
        return new Game(this.id, this.type, this.usersIds, this.rounds, finished);
    }

    /**
     * Finish this game
     * Returns a new Game instance with isFinished = true
     */
    finish(): Game {
        return new Game(this.id, this.type, this.usersIds, this.rounds, true);
    }

    /**
     * Add a move to a specific round
     * Returns a new Game instance (immutable)
     */
    addMoveToRound(roundId: string, move: Move): Game {
        const roundIndex = this.rounds.findIndex(round => round.id === roundId);
        if (roundIndex === -1) {
            throw new ValidationError(`Round with ID '${roundId}' not found in game`);
        }

        const updatedRound = this.rounds[roundIndex].addMove(move);
        const updatedRounds = [...this.rounds];
        updatedRounds[roundIndex] = updatedRound;

        return new Game(this.id, this.type, this.usersIds, updatedRounds, this.isFinished);
    }

    /**
     * Finish a specific round
     * Returns a new Game instance (immutable)
     */
    finishRound(roundId: string): Game {
        const roundIndex = this.rounds.findIndex(round => round.id === roundId);
        if (roundIndex === -1) {
            throw new ValidationError(`Round with ID '${roundId}' not found in game`);
        }

        const updatedRound = this.rounds[roundIndex].finish();
        const updatedRounds = [...this.rounds];
        updatedRounds[roundIndex] = updatedRound;

        return new Game(this.id, this.type, this.usersIds, updatedRounds, this.isFinished);
    }

    /**
     * Check if game has any rounds
     */
    hasRounds(): boolean {
        return this.rounds.length > 0;
    }

    /**
     * Get the number of rounds in this game
     */
    getRoundCount(): number {
        return this.rounds.length;
    }

    /**
     * Get the last round in this game (if any)
     */
    getLastRound(): Round | undefined {
        return this.rounds.length > 0 ? this.rounds[this.rounds.length - 1] : undefined;
    }

    /**
     * Get a specific round by ID
     */
    getRound(roundId: string): Round | undefined {
        return this.rounds.find(round => round.id === roundId);
    }

    /**
     * Check if a specific user is participating in this game
     */
    hasUser(userId: string): boolean {
        return this.usersIds.includes(userId);
    }

    /**
     * Get all moves from all rounds for a specific user
     */
    getMovesForUser(userId: string): Move[] {
        const moves: Move[] = [];
        for (const round of this.rounds) {
            moves.push(...round.moves.filter(move => move.userId === userId));
        }
        return moves;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            type: this.type,
            usersIds: [...this.usersIds],
            rounds: this.rounds.map(round => round.toJSON()),
            isFinished: this.isFinished
        };
    }

    /**
     * Create a new Game from JSON data
     */
    static fromJSON(data: any): Game {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid game data: must be an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new ValidationError('Game ID is required and must be a string');
        }

        if (!data.type || typeof data.type !== 'string') {
            throw new ValidationError('Game type is required and must be a string');
        }

        if (!Array.isArray(data.usersIds)) {
            throw new ValidationError('Game usersIds must be an array');
        }

        if (!Array.isArray(data.rounds)) {
            throw new ValidationError('Game rounds must be an array');
        }

        if (typeof data.isFinished !== 'boolean') {
            throw new ValidationError('Game isFinished must be a boolean');
        }

        const rounds = data.rounds.map((roundData: any) => Round.fromJSON(roundData));
        return new Game(data.id, data.type, data.usersIds, rounds, data.isFinished);
    }

    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Game ID is required and must be a string');
        }

        if (id.trim().length === 0) {
            throw new ValidationError('Game ID cannot be empty');
        }

        // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
            throw new ValidationError(
                `Invalid game id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateType(type: string): void {
        if (!type || typeof type !== 'string') {
            throw new ValidationError('Game type is required and must be a string');
        }

        if (type.trim().length === 0) {
            throw new ValidationError('Game type cannot be empty');
        }

        if (type.length > 100) {
            throw new ValidationError('Game type must be 100 characters or less');
        }
    }

    private validateUsersIds(usersIds: string[]): void {
        if (!Array.isArray(usersIds)) {
            throw new ValidationError('Game usersIds must be an array');
        }

        if (usersIds.length === 0) {
            throw new ValidationError('Game must have at least one user');
        }

        if (usersIds.length > 10) {
            throw new ValidationError('Game cannot have more than 10 users');
        }

        // Validate each user ID
        usersIds.forEach((userId, index) => {
            if (!userId || typeof userId !== 'string') {
                throw new ValidationError(`User ID at index ${index} must be a non-empty string`);
            }

            if (!/^[a-zA-Z0-9._-]{1,128}$/.test(userId)) {
                throw new ValidationError(
                    `Invalid user ID at index ${index}: ${userId}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
                );
            }
        });

        // Check for duplicate user IDs
        const uniqueIds = new Set(usersIds);
        if (uniqueIds.size !== usersIds.length) {
            throw new ValidationError('Game cannot have duplicate user IDs');
        }
    }

    private validateRounds(rounds: Round[]): void {
        if (!Array.isArray(rounds)) {
            throw new ValidationError('Game rounds must be an array');
        }

        // Validate each round
        rounds.forEach((round, index) => {
            if (!(round instanceof Round)) {
                throw new ValidationError(`Round at index ${index} must be a Round instance`);
            }
        });
    }

    private validateIsFinished(isFinished: boolean): void {
        if (typeof isFinished !== 'boolean') {
            throw new ValidationError('Game isFinished must be a boolean');
        }
    }

    private validateRound(round: Round): void {
        if (!(round instanceof Round)) {
            throw new ValidationError('Round must be a Round instance');
        }
    }
}