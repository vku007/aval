import { Round } from "../value-object/Round.js";
import { RoundStatus } from "../value-object/RoundStatus.js";
import { Move } from "../value-object/Move.js";
import { ValidationError } from "../../shared/errors/index.js";
import { GameCreateContext } from "../../application/dto/processor/GameCreateContext.js";
import { GameStatus } from "../value-object/GameStatus.js";
import { GameOutcome } from "../value-object/GameOutcome.js";

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
    public rounds: Round[];
    public endTime?: number;
    /** Outcome (rewards, etc.) created when the game is created; not passed to constructor. */
    public outcome: GameOutcome;

    constructor(
        public readonly id: string,
        public readonly type: GameTypeLength,
        public readonly usersIds: string[],
        public status: GameStatus,
        // TODO: This could be changed to a specific domain value object class in the future
        // Currently using GameCreateContext from application layer for convenience
        public readonly createContext?: GameCreateContext
    ) {
        // Initialize rounds to empty array
        this.rounds = [];
        // Create outcome instance when game is created (not passed in)
        this.outcome = new GameOutcome();

        this.validateId(id);
        this.validateType(type);
        this.validateUsersIds(usersIds);
        this.validateStatus(status);
        if (createContext !== undefined) {
            this.validateCreateContext(createContext);
        }
    }

    /**
     * Add a round to this game
     * Modifies the rounds array in place (mutable)
     */
    addRound(round: Round): void {
        this.validateRound(round);
        this.rounds.push(round);
    }

    /**
     * Set the status of this game
     * Modifies the status field in place (mutable)
     */
    setStatus(status: GameStatus): void {
        this.validateStatus(status);
        this.status = status;
    }

    /**
     * Finish this game
     * Sets status to Finished
     */
    finish(): void {
        this.status = GameStatus.Finished;
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
            roundToModify.status,
            roundToModify.startTime,
            roundToModify.winnerId,
            roundToModify.endTime
        );
        newRound.subRounds = [...roundToModify.subRounds];
        newRound.finish();
        updatedRounds[roundIndex] = newRound;

        const updatedGame = new Game(this.id, this.type, this.usersIds, this.status, this.createContext);
        updatedGame.rounds = updatedRounds;
        updatedGame.outcome = GameOutcome.fromJSON(this.outcome.toJSON());
        return updatedGame;
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
            status: this.status,
            isFinished: this.status === GameStatus.Finished, // Backward compatibility
            endTime: this.endTime,
            outcome: this.outcome.toJSON(),
            createContext: this.createContext?.toJSON()
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

        // Support both status (new) and isFinished (old) for backward compatibility
        let status: GameStatus;
        if (data.status && typeof data.status === 'string') {
            if (!Object.values(GameStatus).includes(data.status as GameStatus)) {
                throw new ValidationError(`Invalid game status: ${data.status}. Must be one of: ${Object.values(GameStatus).join(', ')}`);
            }
            status = data.status as GameStatus;
        } else if (typeof data.isFinished === 'boolean') {
            // Backward compatibility: convert isFinished to status
            status = data.isFinished ? GameStatus.Finished : GameStatus.Created;
        } else {
            throw new ValidationError('Game status is required (or isFinished for backward compatibility)');
        }

        const rounds = data.rounds.map((roundData: any) => Round.fromJSON(roundData));
        const createContext = data.createContext ? GameCreateContext.fromJSON(data.createContext) : undefined;
        const game = new Game(data.id, data.type as GameTypeLength, data.usersIds, status, createContext);
        game.rounds = rounds;
        if (data.outcome) {
            game.outcome = GameOutcome.fromJSON(data.outcome);
        }
        if (data.endTime !== undefined && data.endTime !== null) {
            if (typeof data.endTime !== 'number') {
                throw new ValidationError('Game endTime must be a number');
            }
            game.endTime = data.endTime;
        }
        return game;
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

    private validateStatus(status: GameStatus): void {
        if (!status || !Object.values(GameStatus).includes(status)) {
            throw new ValidationError(`status must be one of: ${Object.values(GameStatus).join(', ')}`);
        }
    }

    private validateRound(round: Round): void {
        if (!(round instanceof Round)) {
            throw new ValidationError('Round must be a Round instance');
        }
    }

    private validateCreateContext(createContext: GameCreateContext): void {
        if (!createContext || !(createContext instanceof GameCreateContext)) {
            throw new ValidationError('createContext must be an instance of GameCreateContext');
        }
    }
}