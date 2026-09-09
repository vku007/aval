import { ValidationError } from '../../shared/errors/index.js';
import { JsonEntity } from './JsonEntity.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import { Game } from './Game.js';
import { Round } from '../value-object/Round.js';
import { RoundStatus } from '../value-object/RoundStatus.js';
import { SubRound } from '../value-object/SubRound.js';
import { SubRoundStatus } from '../value-object/SubRoundStatus.js';
import { Move, MoveContext, MoveType } from '../value-object/Move.js';
import { GameStatus } from '../value-object/GameStatus.js';
import { GameCreateContext } from '../../application/dto/processor/GameCreateContext.js';
import { GameOutcome } from '../value-object/GameOutcome.js';

// Define the data structure for better type safety
interface GameData {
  usersIds: string[];
  rounds: RoundData[];
  status: GameStatus;
  isFinished?: boolean; // Backward compatibility
  createContext?: any; // Store as JSON object
  endTime?: number;
  outcome?: any; // Serialized GameOutcome (rewards) for persistence
}

interface RoundData {
  id: string;
  subRounds: SubRoundData[];
  status: string;
  startTime: number;
  winnerId?: string;
  endTime?: number;
}

interface SubRoundData {
  idNum: number;
  moves: MoveData[];
  startAt: number;
  finishedAt: number | null;
  updatedAt: number;
  status?: string;
  winnerId?: string;
}

interface MoveData {
  userId: string;
  context: {
    moveType: string;
    size: number;
    decorId: number;
  };
  time?: number;
}

export class GameEntity {
  private readonly _backed: JsonEntity;

  constructor(
    id: string,
    usersIds: string[],
    rounds: Round[],
    status: GameStatus,
    etag?: string,
    metadata?: EntityMetadata,
    createContext?: GameCreateContext,
    endTime?: number,
    outcome?: any // Serialized GameOutcome (game.outcome.toJSON()) for persistence
  ) {
    this.validateId(id);
    this.validateGameData(usersIds, rounds, status);
    
    // Convert Game objects to data structure
    const gameData: GameData = {
      usersIds: [...usersIds], // Create copy to avoid mutation
      rounds: rounds.map(round => this.roundToData(round)),
      status,
      isFinished: status === GameStatus.Finished, // Backward compatibility
      createContext: createContext ? createContext.toJSON() : undefined,
      endTime,
      outcome
    };
    
    this._backed = new JsonEntity(id, gameData as unknown as JsonValue, etag, metadata);
  }

  // Read-only properties that read from backed field
  get id(): string {
    return this._backed.id;
  }

  get usersIds(): string[] {
    return [...this.getGameData().usersIds]; // Return copy to prevent mutation
  }

  get rounds(): Round[] {
    return this.getGameData().rounds.map(roundData => this.dataToRound(roundData));
  }

  get status(): GameStatus {
    const gameData = this.getGameData();
    // Support both status (new) and isFinished (old) for backward compatibility
    if (gameData.status) {
      return gameData.status;
    }
    // Fallback to isFinished for backward compatibility
    return gameData.isFinished ? GameStatus.Finished : GameStatus.Created;
  }

  get isFinished(): boolean {
    // Backward compatibility getter
    return this.status === GameStatus.Finished;
  }

  get createContext(): GameCreateContext | undefined {
    const gameData = this.getGameData();
    if (!gameData.createContext) {
      return undefined;
    }
    return GameCreateContext.fromJSON(gameData.createContext);
  }

  get endTime(): number | undefined {
    return this.getGameData().endTime;
  }

  /** Serialized outcome (rewards) for persistence; undefined if not set. */
  get outcome(): any {
    return this.getGameData().outcome;
  }

  // Read-only access to entity metadata (etag, size, lastModified)
  get metadata(): EntityMetadata | undefined {
    return this._backed.metadata;
  }

  // Helper method for type-safe access to game data
  private getGameData(): GameData {
    return this._backed.data as unknown as GameData;
  }

  // Internal methods for persistence layer (not part of public API)
  internalGetBackingStore(): JsonEntity {
    return this._backed;
  }

  internalCreateFromBackingStore(backed: JsonEntity): GameEntity {
    const gameData = backed.data as unknown as GameData;
    const rounds = gameData.rounds.map(roundData => this.dataToRound(roundData));
    // Support both status (new) and isFinished (old) for backward compatibility
    const status = gameData.status || (gameData.isFinished ? GameStatus.Finished : GameStatus.Created);
    const createContext = gameData.createContext ? GameCreateContext.fromJSON(gameData.createContext) : undefined;
    return new GameEntity(
      backed.id, 
      gameData.usersIds, 
      rounds, 
      status, 
      backed.etag, 
      backed.metadata,
      createContext,
      gameData.endTime,
      gameData.outcome
    );
  }

  // Factory method
  static create(
    id: string, 
    usersIds: string[], 
    rounds: Round[], 
    status: GameStatus, 
    etag?: string, 
    metadata?: EntityMetadata
  ): GameEntity {
    return new GameEntity(id, usersIds, rounds, status, etag, metadata);
  }

  // Immutable operations that delegate to Game class
  addRound(round: Round): GameEntity {
    const game = this.toGame();
    game.addRound(round);
    return this.fromGame(game);
  }

  setStatus(status: GameStatus): GameEntity {
    const game = this.toGame();
    game.setStatus(status);
    return this.fromGame(game);
  }

  setFinished(finished: boolean): GameEntity {
    // Backward compatibility method
    const status = finished ? GameStatus.Finished : GameStatus.Created;
    return this.setStatus(status);
  }

  finish(): GameEntity {
    const game = this.toGame();
    game.finish();
    return this.fromGame(game);
  }

  addMoveToRound(roundId: string, move: Move): GameEntity {
    const game = this.toGame();
    const updatedGame = game.addMoveToRound(roundId, move);
    return this.fromGame(updatedGame);
  }

  finishRound(roundId: string): GameEntity {
    const game = this.toGame();
    const updatedGame = game.finishRound(roundId);
    return this.fromGame(updatedGame);
  }

  // Utility methods that delegate to Game class
  hasRounds(): boolean {
    return this.toGame().hasRounds();
  }

  getRoundCount(): number {
    return this.toGame().getRoundCount();
  }

  getLastRound(): Round | undefined {
    return this.toGame().getLastRound();
  }

  getRound(roundId: string): Round | undefined {
    return this.toGame().getRound(roundId);
  }

  hasUser(userId: string): boolean {
    return this.toGame().hasUser(userId);
  }

  getMovesForUser(userId: string): Move[] {
    return this.toGame().getMovesForUser(userId);
  }

  // Conversion methods between GameEntity and Game
  /**
   * Converts this GameEntity to a Game domain object.
   * @returns Game domain object with all properties
   */
  public toGame(): Game {
    const gameData = this.getGameData();
    const rounds = gameData.rounds.map(roundData => this.dataToRound(roundData));
    // Support both status (new) and isFinished (old) for backward compatibility
    const status = gameData.status || (gameData.isFinished ? GameStatus.Finished : GameStatus.Created);
    const createContext = gameData.createContext ? GameCreateContext.fromJSON(gameData.createContext) : undefined;
    const game = new Game(this.id, gameData.usersIds, status, createContext);
    game.rounds = rounds;
    if (gameData.endTime !== undefined) {
      game.endTime = gameData.endTime;
    }
    if (gameData.outcome) {
      game.outcome = GameOutcome.fromJSON(gameData.outcome);
    }
    return game;
  }

  private fromGame(game: Game): GameEntity {
    return new GameEntity(
      game.id,
      game.usersIds,
      game.rounds,
      game.status,
      this._backed.etag,
      this._backed.metadata,
      game.createContext,
      game.endTime,
      game.outcome.toJSON()
    );
  }

  // Data conversion methods
  private roundToData(round: Round): RoundData {
    return {
      id: round.id,
      subRounds: round.subRounds.map(subRound => this.subRoundToData(subRound)),
      status: round.status,
      startTime: round.startTime,
      winnerId: round.winnerId,
      endTime: round.endTime
    };
  }

  private dataToRound(roundData: RoundData): Round {
    const subRounds = roundData.subRounds.map(subRoundData => this.dataToSubRound(subRoundData));
    const round = new Round(
      roundData.id, 
      roundData.status as RoundStatus, 
      roundData.startTime,
      roundData.winnerId,
      roundData.endTime
    );
    round.subRounds = subRounds;
    return round;
  }

  private subRoundToData(subRound: SubRound): SubRoundData {
    return {
      idNum: subRound.idNum,
      moves: subRound.moves.map(move => this.moveToData(move)),
      startAt: subRound.startAt,
      finishedAt: subRound.finishedAt,
      updatedAt: subRound.updatedAt,
      status: subRound.status,
      winnerId: subRound.winnerId
    };
  }

  private dataToSubRound(subRoundData: SubRoundData): SubRound {
    const moves = subRoundData.moves.map(moveData => this.dataToMove(moveData));
    const subRound = new SubRound(
      subRoundData.idNum,
      subRoundData.startAt,
      subRoundData.finishedAt,
      subRoundData.updatedAt
    );
    subRound.moves = moves;
    // Restore status if present in data
    if (subRoundData.status !== undefined) {
      subRound.status = subRoundData.status as SubRoundStatus;
    }
    // Restore winnerId if present in data
    if (subRoundData.winnerId !== undefined) {
      subRound.winnerId = subRoundData.winnerId;
    }
    return subRound;
  }

  private moveToData(move: Move): MoveData {
    return {
      userId: move.userId,
      context: move.context.toJSON() as { moveType: string; size: number; decorId: number },
      time: move.time
    };
  }

  private dataToMove(moveData: MoveData): Move {
    const context = new MoveContext(
      moveData.context.moveType as MoveType,
      moveData.context.size,
      moveData.context.decorId
    );
    return new Move(moveData.userId, context, moveData.time || Date.now());
  }

  // JSON serialization
  toJSON(): object {
    const gameData = this.getGameData();
    return {
      id: this.id,
      usersIds: this.usersIds,
      rounds: this.rounds.map(round => round.toJSON()),
      status: this.status,
      isFinished: this.isFinished, // Backward compatibility
      createContext: gameData.createContext,
      endTime: gameData.endTime,
      outcome: gameData.outcome
    };
  }

  static fromJSON(data: any): GameEntity {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid game entity data: must be an object');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new ValidationError('Game entity ID is required and must be a string');
    }

    if (!Array.isArray(data.usersIds)) {
      throw new ValidationError('Game entity usersIds must be an array');
    }

    if (!Array.isArray(data.rounds)) {
      throw new ValidationError('Game entity rounds must be an array');
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
      throw new ValidationError('Game entity status is required (or isFinished for backward compatibility)');
    }

    const rounds = data.rounds.map((roundData: any) => Round.fromJSON(roundData));
    const createContext = data.createContext ? GameCreateContext.fromJSON(data.createContext) : undefined;
    const endTime = data.endTime !== undefined && data.endTime !== null ? data.endTime : undefined;
    const outcome = data.outcome;
    return new GameEntity(data.id, data.usersIds, rounds, status, undefined, undefined, createContext, endTime, outcome);
  }

  // Validation methods
  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Game entity ID is required and must be a string');
    }

    if (id.trim().length === 0) {
      throw new ValidationError('Game entity ID cannot be empty');
    }

    // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
      throw new ValidationError(
        `Invalid game entity id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
      );
    }
  }

  private validateGameData(usersIds: string[], rounds: Round[], status: GameStatus): void {
    this.validateUsersIds(usersIds);
    this.validateRounds(rounds);
    this.validateStatus(status);
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
}
