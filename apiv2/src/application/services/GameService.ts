import { GameEntity } from '../../domain/entity/GameEntity.js';
import { Round } from '../../domain/value-object/Round.js';
import { Move } from '../../domain/value-object/Move.js';
import { CreateGameDto } from '../dto/CreateGameDto.js';
import { UpdateGameDto } from '../dto/UpdateGameDto.js';
import { GameResponseDto } from '../dto/GameResponseDto.js';
import { ListResponseDto } from '../dto/ListResponseDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError } from '../../shared/errors/NotFoundError.js';
import { ConflictError } from '../../shared/errors/ConflictError.js';
import { ValidationError } from '../../shared/errors/ValidationError.js';
import type { EntityMetadata } from '../../shared/types/common.js';

// Game-specific repository interface
export interface IGameRepository {
  findById(id: string, ifNoneMatch?: string): Promise<GameEntity | null>;
  save(game: GameEntity, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<GameEntity>;
  delete(id: string, opts?: { ifMatch?: string }): Promise<void>;
  findAll(prefix?: string, limit?: number, cursor?: string): Promise<{ items: GameEntity[]; nextCursor?: string }>;
  getMetadata(id: string): Promise<EntityMetadata>;
}

export class GameService {
  private readonly logger: Logger;

  constructor(private readonly repository: IGameRepository) {
    this.logger = new Logger();
  }

  async getGame(id: string, ifNoneMatch?: string): Promise<GameResponseDto> {
    this.logger.info('Getting game', { id, ifNoneMatch });

    try {
      const gameEntity = await this.repository.findById(id, ifNoneMatch);
      if (!gameEntity) {
        throw new NotFoundError(`Game with id ${id} not found`);
      }
      this.logger.info('Got game', { id, etag: gameEntity.internalGetBackingStore().etag });
      return GameResponseDto.fromGameEntity(gameEntity);
    } catch (error: any) {
      this.logger.error('Failed to get game', { id, error: error.message });
      throw error;
    }
  }

  async createGame(dto: CreateGameDto, ifNoneMatch?: string): Promise<GameResponseDto> {
    this.logger.info('Creating game', { 
      id: dto.id, 
      type: dto.type, 
      usersCount: dto.usersIds.length,
      roundsCount: dto.rounds.length,
      ifNoneMatch 
    });

    // Convert DTO rounds to Round objects
    const rounds = dto.rounds.map(roundDto => {
      const moves = roundDto.moves.map(moveDto => 
        new Move(moveDto.id, moveDto.userId, moveDto.value, moveDto.valueDecorated, moveDto.time || Date.now())
      );
      return new Round(roundDto.id, moves, roundDto.isFinished, roundDto.time);
    });

    // Create domain entity (will validate)
    const gameEntity = new GameEntity(
      dto.id, 
      dto.type, 
      dto.usersIds, 
      rounds, 
      dto.isFinished
    );

    // Save with If-None-Match: * (create only)
    const saved = await this.repository.save(gameEntity, { ifNoneMatch: ifNoneMatch || '*' });

    this.logger.info('Created game', { id: saved.id, etag: saved.internalGetBackingStore().etag });

    return GameResponseDto.fromGameEntity(saved);
  }

  async updateGame(
    id: string, 
    dto: UpdateGameDto, 
    merge: boolean = false,
    ifMatch?: string
  ): Promise<GameResponseDto> {
    this.logger.info('Updating game', { id, merge, ifMatch });

    try {
      // Get existing game
      const existingGame = await this.repository.findById(id);
      if (!existingGame) {
        throw new NotFoundError(`Game with id ${id} not found`);
      }
      
      if (merge) {
        // Merge strategy: update only provided fields
        const updatedGame = this.mergeGameData(existingGame, dto);
        const saved = await this.repository.save(updatedGame, { ifMatch });
        this.logger.info('Updated game (merge)', { id, etag: saved.internalGetBackingStore().etag });
        return GameResponseDto.fromGameEntity(saved);
      } else {
        // Replace strategy: replace with new data
        const replacedGame = this.replaceGameData(existingGame, dto);
        const saved = await this.repository.save(replacedGame, { ifMatch });
        this.logger.info('Updated game (replace)', { id, etag: saved.internalGetBackingStore().etag });
        return GameResponseDto.fromGameEntity(saved);
      }
    } catch (error: any) {
      this.logger.error('Failed to update game', { id, error: error.message });
      throw error;
    }
  }

  async deleteGame(id: string, ifMatch?: string): Promise<void> {
    this.logger.info('Deleting game', { id, ifMatch });

    try {
      await this.repository.delete(id, { ifMatch });
      this.logger.info('Deleted game', { id });
    } catch (error: any) {
      this.logger.error('Failed to delete game', { id, error: error.message });
      throw error;
    }
  }

  async getGameMetadata(id: string): Promise<EntityMetadata> {
    this.logger.info('Getting game metadata', { id });

    try {
      const metadata = await this.repository.getMetadata(id);
      this.logger.info('Got game metadata', { id, etag: metadata.etag });
      return metadata;
    } catch (error: any) {
      this.logger.error('Failed to get game metadata', { id, error: error.message });
      throw error;
    }
  }

  async listGames(prefix?: string, limit?: number, cursor?: string): Promise<ListResponseDto> {
    this.logger.info('Listing games', { prefix, limit, cursor });

    try {
      const result = await this.repository.findAll(prefix, limit, cursor);
      
      const gameNames = result.items.map(gameEntity => gameEntity.id);
      
      this.logger.info('Listed games', { count: gameNames.length, hasMore: !!result.nextCursor });

      return new ListResponseDto(gameNames, result.nextCursor);
    } catch (error: any) {
      this.logger.error('Failed to list games', { error: error.message });
      throw error;
    }
  }

  // Game-specific operations
  async addRoundToGame(gameId: string, round: Round, ifMatch?: string): Promise<GameResponseDto> {
    this.logger.info('Adding round to game', { gameId, roundId: round.id, ifMatch });

    try {
      const gameEntity = await this.repository.findById(gameId);
      if (!gameEntity) {
        throw new NotFoundError(`Game with id ${gameId} not found`);
      }
      const updatedGame = gameEntity.addRound(round);
      const saved = await this.repository.save(updatedGame, { ifMatch });
      
      this.logger.info('Added round to game', { gameId, roundId: round.id, etag: saved.internalGetBackingStore().etag });
      return GameResponseDto.fromGameEntity(saved);
    } catch (error: any) {
      this.logger.error('Failed to add round to game', { gameId, roundId: round.id, error: error.message });
      throw error;
    }
  }

  async addMoveToGameRound(
    gameId: string, 
    roundId: string, 
    move: Move, 
    ifMatch?: string
  ): Promise<GameResponseDto> {
    this.logger.info('Adding move to game round', { gameId, roundId, moveId: move.id, ifMatch });

    try {
      const gameEntity = await this.repository.findById(gameId);
      if (!gameEntity) {
        throw new NotFoundError(`Game with id ${gameId} not found`);
      }
      const updatedGame = gameEntity.addMoveToRound(roundId, move);
      const saved = await this.repository.save(updatedGame, { ifMatch });
      
      this.logger.info('Added move to game round', { 
        gameId, 
        roundId, 
        moveId: move.id, 
        etag: saved.internalGetBackingStore().etag 
      });
      return GameResponseDto.fromGameEntity(saved);
    } catch (error: any) {
      this.logger.error('Failed to add move to game round', { 
        gameId, 
        roundId, 
        moveId: move.id, 
        error: error.message 
      });
      throw error;
    }
  }

  async finishGameRound(gameId: string, roundId: string, ifMatch?: string): Promise<GameResponseDto> {
    this.logger.info('Finishing game round', { gameId, roundId, ifMatch });

    try {
      const gameEntity = await this.repository.findById(gameId);
      if (!gameEntity) {
        throw new NotFoundError(`Game with id ${gameId} not found`);
      }
      const updatedGame = gameEntity.finishRound(roundId);
      const saved = await this.repository.save(updatedGame, { ifMatch });
      
      this.logger.info('Finished game round', { gameId, roundId, etag: saved.internalGetBackingStore().etag });
      return GameResponseDto.fromGameEntity(saved);
    } catch (error: any) {
      this.logger.error('Failed to finish game round', { gameId, roundId, error: error.message });
      throw error;
    }
  }

  async finishGame(gameId: string, ifMatch?: string): Promise<GameResponseDto> {
    this.logger.info('Finishing game', { gameId, ifMatch });

    try {
      const gameEntity = await this.repository.findById(gameId);
      if (!gameEntity) {
        throw new NotFoundError(`Game with id ${gameId} not found`);
      }
      const updatedGame = gameEntity.finish();
      const saved = await this.repository.save(updatedGame, { ifMatch });
      
      this.logger.info('Finished game', { gameId, etag: saved.internalGetBackingStore().etag });
      return GameResponseDto.fromGameEntity(saved);
    } catch (error: any) {
      this.logger.error('Failed to finish game', { gameId, error: error.message });
      throw error;
    }
  }

  // Helper methods
  private mergeGameData(existingGame: GameEntity, dto: UpdateGameDto): GameEntity {
    // Convert DTO rounds to Round objects if provided
    const rounds = dto.rounds ? dto.rounds.map(roundDto => {
      const moves = roundDto.moves.map(moveDto => 
        new Move(moveDto.id, moveDto.userId, moveDto.value, moveDto.valueDecorated, moveDto.time || Date.now())
      );
      return new Round(roundDto.id, moves, roundDto.isFinished, roundDto.time);
    }) : existingGame.rounds;

    // Create new game entity with merged data
    return new GameEntity(
      existingGame.id,
      dto.type ?? existingGame.type,
      dto.usersIds ?? existingGame.usersIds,
      rounds,
      dto.isFinished ?? existingGame.isFinished,
      existingGame.internalGetBackingStore().etag,
      existingGame.metadata
    );
  }

  private replaceGameData(existingGame: GameEntity, dto: UpdateGameDto): GameEntity {
    // For replace strategy, all fields are required
    if (!dto.type || !dto.usersIds || !dto.rounds || dto.isFinished === undefined) {
      throw new ValidationError('Replace strategy requires all fields: type, usersIds, rounds, isFinished');
    }

    // Convert DTO rounds to Round objects
    const rounds = dto.rounds.map(roundDto => {
      const moves = roundDto.moves.map(moveDto => 
        new Move(moveDto.id, moveDto.userId, moveDto.value, moveDto.valueDecorated, moveDto.time || Date.now())
      );
      return new Round(roundDto.id, moves, roundDto.isFinished, roundDto.time);
    });

    // Create new game entity with replaced data
    return new GameEntity(
      existingGame.id,
      dto.type,
      dto.usersIds,
      rounds,
      dto.isFinished,
      existingGame.internalGetBackingStore().etag,
      existingGame.metadata
    );
  }
}
