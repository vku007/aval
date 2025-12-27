import { Round } from "../value-object/Round.js";
import { RoundStatus } from "../value-object/RoundStatus.js";
import { Move } from "../value-object/Move.js";
import { ValidationError } from "../../shared/errors/index.js";

export enum GameTypeLength {
    BO1 = 'BO1',
    BO3 = 'BO3',
    BO5 = 'BO5',
    BO7 = 'BO7',
    BO9 = 'BO9',
    BO11 = 'BO11',
    BO19 = 'BO19'
}

export class Game {
    constructor(
        public readonly id: string,
        public readonly type: GameTypeLength,
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
     * Note: This method is deprecated. Moves should be added to SubRounds within a Round.
     * This method is kept for backwards compatibility but will throw an error.
     */
    addMoveToRound(roundId: string, move: Move): Game {
        throw new ValidationError('addMoveToRound is no longer supported. Moves must be added to SubRounds within a Round.');
    }

    /**
     * Finish a specific round
     * Returns a new Game instance (immutable) with the round modified in place
     */
    finishRound(roundId: string): Game {
        const roundIndex = this.rounds.findIndex(round => round.id === roundId);
        if (roundIndex === -1) {
            throw new ValidationError(`Round with ID '${roundId}' not found in game`);
        }

        // Create a copy of the rounds array and the round to modify
        const updatedRounds = [...this.rounds];
        const roundToModify = updatedRounds[roundIndex];
        // Create a new Round instance with the same data to avoid mutating the original
        const newRound = new Round(
            roundToModify.id,
            [...roundToModify.subRounds],
            roundToModify.status,
            roundToModify.startTime,
            roundToModify.winnerId,
            roundToModify.endTime
        );
        newRound.finish();
        updatedRounds[roundIndex] = newRound;

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
     * Get all moves from all subRounds in all rounds for a specific user
     */
    getMovesForUser(userId: string): Move[] {
        const moves: Move[] = [];
        for (const round of this.rounds) {
            for (const subRound of round.subRounds) {
                moves.push(...subRound.moves.filter(move => move.userId === userId));
            }
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

        if (!Object.values(GameTypeLength).includes(data.type as GameTypeLength)) {
            throw new ValidationError(`Invalid game type: ${data.type}. Must be one of: ${Object.values(GameTypeLength).join(', ')}`);
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
        return new Game(data.id, data.type as GameTypeLength, data.usersIds, rounds, data.isFinished);
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

    private validateType(type: GameTypeLength): void {
        if (!type) {
            throw new ValidationError('Game type is required');
        }

        if (!Object.values(GameTypeLength).includes(type)) {
            throw new ValidationError(`Invalid game type: ${type}. Must be one of: ${Object.values(GameTypeLength).join(', ')}`);
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