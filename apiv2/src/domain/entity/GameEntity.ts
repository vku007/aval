import { ValidationError } from '../../shared/errors/index.js';
import { JsonEntity } from './JsonEntity.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import { Game } from './Game.js';
import { Round } from './Round.js';
import { Move } from './Move.js';

// Define the data structure for better type safety
interface GameData {
  type: string;
  usersIds: string[];
  rounds: RoundData[];
  isFinished: boolean;
}

interface RoundData {
  id: string;
  moves: MoveData[];
  isFinished: boolean;
  time: number;
}

interface MoveData {
  id: string;
  userId: string;
  value: number;
  valueDecorated: string;
  time?: number;
}

export class GameEntity {
  private readonly _backed: JsonEntity;

  constructor(
    id: string,
    type: string,
    usersIds: string[],
    rounds: Round[],
    isFinished: boolean,
    etag?: string,
    metadata?: EntityMetadata
  ) {
    this.validateId(id);
    this.validateGameData(type, usersIds, rounds, isFinished);
    
    // Convert Game objects to data structure
    const gameData: GameData = {
      type,
      usersIds: [...usersIds], // Create copy to avoid mutation
      rounds: rounds.map(round => this.roundToData(round)),
      isFinished
    };
    
    this._backed = new JsonEntity(id, gameData as unknown as JsonValue, etag, metadata);
  }

  // Read-only properties that read from backed field
  get id(): string {
    return this._backed.id;
  }

  get type(): string {
    return this.getGameData().type;
  }

  get usersIds(): string[] {
    return [...this.getGameData().usersIds]; // Return copy to prevent mutation
  }

  get rounds(): Round[] {
    return this.getGameData().rounds.map(roundData => this.dataToRound(roundData));
  }

  get isFinished(): boolean {
    return this.getGameData().isFinished;
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
    return new GameEntity(
      backed.id, 
      gameData.type, 
      gameData.usersIds, 
      rounds, 
      gameData.isFinished, 
      backed.etag, 
      backed.metadata
    );
  }

  // Factory method
  static create(
    id: string, 
    type: string, 
    usersIds: string[], 
    rounds: Round[], 
    isFinished: boolean, 
    etag?: string, 
    metadata?: EntityMetadata
  ): GameEntity {
    return new GameEntity(id, type, usersIds, rounds, isFinished, etag, metadata);
  }

  // Immutable operations that delegate to Game class
  addRound(round: Round): GameEntity {
    const game = this.toGame();
    const updatedGame = game.addRound(round);
    return this.fromGame(updatedGame);
  }

  setFinished(finished: boolean): GameEntity {
    const game = this.toGame();
    const updatedGame = game.setFinished(finished);
    return this.fromGame(updatedGame);
  }

  finish(): GameEntity {
    const game = this.toGame();
    const updatedGame = game.finish();
    return this.fromGame(updatedGame);
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
  private toGame(): Game {
    const gameData = this.getGameData();
    const rounds = gameData.rounds.map(roundData => this.dataToRound(roundData));
    return new Game(this.id, gameData.type, gameData.usersIds, rounds, gameData.isFinished);
  }

  private fromGame(game: Game): GameEntity {
    return new GameEntity(
      game.id,
      game.type,
      game.usersIds,
      game.rounds,
      game.isFinished,
      this._backed.etag,
      this._backed.metadata
    );
  }

  // Data conversion methods
  private roundToData(round: Round): RoundData {
    return {
      id: round.id,
      moves: round.moves.map(move => this.moveToData(move)),
      isFinished: round.isFinished,
      time: round.time
    };
  }

  private dataToRound(roundData: RoundData): Round {
    const moves = roundData.moves.map(moveData => this.dataToMove(moveData));
    return new Round(roundData.id, moves, roundData.isFinished, roundData.time);
  }

  private moveToData(move: Move): MoveData {
    return {
      id: move.id,
      userId: move.userId,
      value: move.value,
      valueDecorated: move.valueDecorated,
      time: move.time
    };
  }

  private dataToMove(moveData: MoveData): Move {
    return new Move(moveData.id, moveData.userId, moveData.value, moveData.valueDecorated, moveData.time || Date.now());
  }

  // JSON serialization
  toJSON(): object {
    return {
      id: this.id,
      type: this.type,
      usersIds: this.usersIds,
      rounds: this.rounds.map(round => round.toJSON()),
      isFinished: this.isFinished
    };
  }

  static fromJSON(data: any): GameEntity {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid game entity data: must be an object');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new ValidationError('Game entity ID is required and must be a string');
    }

    if (!data.type || typeof data.type !== 'string') {
      throw new ValidationError('Game entity type is required and must be a string');
    }

    if (!Array.isArray(data.usersIds)) {
      throw new ValidationError('Game entity usersIds must be an array');
    }

    if (!Array.isArray(data.rounds)) {
      throw new ValidationError('Game entity rounds must be an array');
    }

    if (typeof data.isFinished !== 'boolean') {
      throw new ValidationError('Game entity isFinished must be a boolean');
    }

    const rounds = data.rounds.map((roundData: any) => Round.fromJSON(roundData));
    return new GameEntity(data.id, data.type, data.usersIds, rounds, data.isFinished);
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

  private validateGameData(type: string, usersIds: string[], rounds: Round[], isFinished: boolean): void {
    this.validateType(type);
    this.validateUsersIds(usersIds);
    this.validateRounds(rounds);
    this.validateIsFinished(isFinished);
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
}
