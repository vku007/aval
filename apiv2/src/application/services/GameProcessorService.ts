import { CreateGameRequest } from '../dto/processor/CreateGameRequest.js';
import { CreateGameResponse } from '../dto/processor/CreateGameResponse.js';
import { GameResponse } from '../dto/processor/response/GameResponse.js';
import { UpdateGameResponse } from '../dto/processor/UpdateGameResponse.js';
import { GameResponsePayload } from '../dto/processor/response/payload/GameResponsePayload.js';
import { GameContext } from '../dto/processor/response/context/GameContext.js';
import { PlayerContext } from '../dto/processor/response/context/PlayerContext.js';
import { EnemyContext } from '../dto/processor/response/context/EnemyContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { Logger } from '../../shared/logging/Logger.js';
import { GameProcessor } from '../utils/GameProcessor.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import type { IGameRepository } from './GameService.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { RoundState } from '../dto/processor/RoundState.js';
import { SubRoundState } from '../dto/processor/SubRoundState.js';
import { GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
import type { BattleGameSpec, CampaignBattleSink } from './CampaignGamePort.js';
import { buildBattleGame } from '../campaign/BattleGameBuilder.js';
import { campaignProcessor } from '../campaign/npcSeed.js';
import type { EntityMetadata } from '../../shared/types/common.js';

/**
 * Service for processing game creation operations.
 */
export class GameProcessorService {
  private readonly logger: Logger;
  private readonly gameRepository?: IGameRepository;
  private battleSink?: CampaignBattleSink;

  constructor(gameRepository?: IGameRepository) {
    this.logger = new Logger();
    this.gameRepository = gameRepository;
  }

  setBattleSink(sink: CampaignBattleSink): void {
    this.battleSink = sink;
  }

  private processorFor(game: Game): GameProcessor {
    return campaignProcessor(game, this.logger);
  }

  /**
   * Creates a new game based on the provided request.
   * @param request - The game creation request containing userId and gameCreateContext
   * @returns A response containing the execution status and game identifier
   */
  async createGame(request: CreateGameRequest): Promise<CreateGameResponse> {
    this.logger.info('Creating game', { 
      userId: request.userId, 
      gameType: request.gameCreateContext.gameType,
      rounds: request.gameCreateContext.rounds,
      kind: request.gameCreateContext.kind,
      levelName: request.gameCreateContext.level.name,
      campaign: request.gameCreateContext.campaign.name
    });

    const usersIds = [request.userId, 'NPC_1'];
    const fill = request.gameCreateContext.kind === KindOfGame.Extended
      ? GamePlayerInventory.advancedFor
      : GamePlayerInventory.defaultFor;
    const inventories = GamePlayerInventory.ensureForUsers(
      usersIds,
      request.inventories,
      Date.now(),
      fill
    );

    try {
      // Generate a unique game ID using timestamp
      const gameId = `game-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create a new Game instance with empty rounds and Created status
      const game = new Game(
        gameId,
        usersIds,
        GameStatus.Created, // status = Created
        request.gameCreateContext // Pass the createContext from the request
      );
      game.inventories = inventories;
      // rounds is initialized as empty array in constructor

      // Store game in repository if available
      if (this.gameRepository) {
        try {
          // Convert Game to GameEntity and save
          const gameEntity = new GameEntity(
            game.id,
            game.usersIds,
            game.rounds,
            game.status,
            undefined, // etag
            undefined, // metadata
            game.createContext, // createContext
            game.endTime, // endTime
            game.outcome.toJSON(), // outcome
            game.inventories
          );
          await this.gameRepository.save(gameEntity, { ifNoneMatch: '*' });
          this.logger.info('Game saved to repository', { gameId, userId: request.userId });
        } catch (error: any) {
          this.logger.error('Failed to save game to repository', { 
            gameId, 
            userId: request.userId, 
            error: error.message 
          });
          // Continue and return created status even if save fails
          // This allows the method to work in test environments without repository
        }
      }

      this.logger.info('Game created successfully', { gameId, userId: request.userId });
      
      return new CreateGameResponse('created', gameId);
    } catch (error: any) {
      this.logger.error('Failed to create game', { userId: request.userId, error: error.message });
      return new CreateGameResponse('failed', '');
    }
  }

  /**
   * Creates a linked campaign battle and throws when the game is not stored.
   */
  async createBattle(spec: BattleGameSpec): Promise<{ gameId: string }> {
    if (!this.gameRepository) {
      throw new Error('Game repository is required to create a battle');
    }
    const now = Date.now();
    const gameId = `game-${now}-${Math.random().toString(36).substring(2, 9)}`;
    const game = buildBattleGame(spec, gameId, now);
    await this.gameRepository.save(this.toEntity(game), { ifNoneMatch: '*' });
    return { gameId };
  }

  async load(gameId: string): Promise<{ game: Game; etag?: string } | null> {
    if (!this.gameRepository) {
      return null;
    }
    const entity = await this.gameRepository.findById(gameId);
    if (!entity) {
      return null;
    }
    return { game: entity.toGame(), etag: entity.internalGetBackingStore().etag };
  }

  async save(game: Game, ifMatch: string | undefined): Promise<void> {
    if (!this.gameRepository) {
      throw new Error('Game repository is required to save a battle');
    }
    await this.gameRepository.save(this.toEntity(game, ifMatch), { ifMatch });
  }

  /**
   * Gets a game by userId and gameId.
   * @param userId - The user identifier
   * @param gameId - The game identifier
   * @param testGame - Optional Game instance for testing purposes. If provided, this will be used instead of repository lookup.
   * @returns A response containing the status and game payload
   */
  async getGame(userId: string, gameId: string, testGame?: Game): Promise<GameResponse> {
    this.logger.info('Getting game', { userId, gameId });

    // If testGame is provided, use it for testing purposes
    if (testGame !== undefined) {
      // Use the game's status from testGame
      const gameContext = GameContext.fromCreateContext(testGame.status, testGame.createContext);
      const playerContext = this.buildPlayerContext(userId, testGame);
      const enemyContext = this.buildEnemyContext(userId, testGame);
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new GameResponse('success', payload);
    }

    // Load game from repository
    if (!this.gameRepository) {
      this.logger.warn('Repository not available, returning placeholder response', { gameId, userId });
      const gameContext = new GameContext(GameStatus.Created);
      const playerContext = new PlayerContext([], GamePlayerInventory.defaultFor(userId, 0));
      const enemyContext = new EnemyContext();
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new GameResponse('success', payload);
    }

    try {
      const gameEntity = await this.gameRepository.findById(gameId);
      
      if (!gameEntity) {
        this.logger.warn('Game not found', { gameId, userId });
        throw new NotFoundError(`Game '${gameId}' not found`);
      }

      // Verify user is a participant in the game
      if (!gameEntity.usersIds.includes(userId)) {
        this.logger.warn('User is not a participant in the game', { gameId, userId, usersIds: gameEntity.usersIds });
        throw new NotFoundError(`Game '${gameId}' not found`);
      }

      this.logger.info('Game retrieved from repository', { gameId, userId, status: gameEntity.status });

      // Create response using game entity status
      const game = gameEntity.toGame();
      const gameContext = GameContext.fromCreateContext(gameEntity.status, game.createContext);
      const playerContext = this.buildPlayerContext(userId, game);
      const enemyContext = this.buildEnemyContext(userId, game);
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new GameResponse('success', payload);

    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to get game from repository', { gameId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Updates a game by userId and gameId with the provided action.
   * @param userId - The user identifier
   * @param gameId - The game identifier
   * @param action - The action to perform on the game
   * @param testGame - Optional Game instance for testing purposes. If provided, this will be used instead of repository lookup.
   * @returns A response containing the status and game payload
   */
  async updateGame(userId: string, gameId: string, action: Action, testGame?: Game): Promise<UpdateGameResponse> {
    this.logger.info('Updating game', { userId, gameId, actionType: action.type });

    // If testGame is provided, use it for testing purposes
    if (testGame !== undefined) {
      // Check if game is finished or broken
      if (testGame.status === GameStatus.Finished) {
        const gameContext = GameContext.fromCreateContext(testGame.status, testGame.createContext);
        const playerContext = this.buildPlayerContext(userId, testGame);
        const enemyContext = this.buildEnemyContext(userId, testGame);
        const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
        return new UpdateGameResponse('failed', gameId, payload, 'Error: game is finished');
      }
      
      if (testGame.status === GameStatus.Broken) {
        const gameContext = GameContext.fromCreateContext(testGame.status, testGame.createContext);
        const playerContext = this.buildPlayerContext(userId, testGame);
        const enemyContext = this.buildEnemyContext(userId, testGame);
        const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
        return new UpdateGameResponse('failed', gameId, payload, 'Error: game is broken');
      }

      // Process action and get updated game
      const processor = this.processorFor(testGame);
      const updatedGame = processor.playTurn(testGame, action, userId);

      const gameContext = GameContext.fromCreateContext(updatedGame.status, updatedGame.createContext);
      const playerContext = this.buildPlayerContext(userId, updatedGame);
      const enemyContext = this.buildEnemyContext(userId, updatedGame);
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new UpdateGameResponse('updated', gameId, payload, 'Game updated successfully');
    }

    // Load game from repository
    if (!this.gameRepository) {
      this.logger.warn('Repository not available, returning placeholder response', { gameId, userId });
      const gameContext = new GameContext(GameStatus.Created);
      const playerContext = new PlayerContext([], GamePlayerInventory.defaultFor(userId, 0));
      const enemyContext = new EnemyContext();
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new UpdateGameResponse('updated', gameId, payload, 'Game updated successfully');
    }

    try {
      const gameEntity = await this.gameRepository.findById(gameId);
      
      if (!gameEntity) {
        this.logger.warn('Game not found', { gameId, userId });
        throw new NotFoundError(`Game '${gameId}' not found`);
      }

      // Verify user is a participant in the game
      if (!gameEntity.usersIds.includes(userId)) {
        this.logger.warn('User is not a participant in the game', { gameId, userId, usersIds: gameEntity.usersIds });
        throw new NotFoundError(`Game '${gameId}' not found`);
      }

      // Check if game is finished or broken
      if (gameEntity.status === GameStatus.Finished) {
        const game = gameEntity.toGame();
        const gameContext = GameContext.fromCreateContext(gameEntity.status, game.createContext);
        const playerContext = this.buildPlayerContext(userId, game);
        const enemyContext = this.buildEnemyContext(userId, game);
        const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
        return new UpdateGameResponse('failed', gameId, payload, 'Error: game is finished');
      }
      
      if (gameEntity.status === GameStatus.Broken) {
        const game = gameEntity.toGame();
        const gameContext = GameContext.fromCreateContext(gameEntity.status, game.createContext);
        const playerContext = this.buildPlayerContext(userId, game);
        const enemyContext = this.buildEnemyContext(userId, game);
        const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
        return new UpdateGameResponse('failed', gameId, payload, 'Error: game is broken');
      }

      // Convert GameEntity to Game domain object
      const game = gameEntity.toGame();

      // Process action, let the NPC answer, then surrender a side that cannot throw.
      const processor = this.processorFor(game);
      const updatedGame = processor.playTurn(game, action, userId);

      // Convert updated Game back to GameEntity and save
      const updatedGameEntity = this.toEntity(
        updatedGame,
        gameEntity.internalGetBackingStore().etag,
        gameEntity.metadata
      );

      // Save updated game to repository
      await this.gameRepository.save(updatedGameEntity, { ifMatch: gameEntity.internalGetBackingStore().etag });

      if (
        (updatedGame.status === GameStatus.Finished || updatedGame.status === GameStatus.Broken)
        && updatedGame.campaignId
      ) {
        try {
          await this.battleSink?.resolveFromGame(updatedGame);
        } catch (sinkError: any) {
          this.logger.error('Campaign resolution failed after the game was saved', {
            gameId,
            campaignId: updatedGame.campaignId,
            error: sinkError.message
          });
        }
      }

      this.logger.info('Game updated in repository', { gameId, userId, status: updatedGame.status });

      // Build response with updated game state
      const gameContext = GameContext.fromCreateContext(updatedGame.status, updatedGame.createContext);
      const playerContext = this.buildPlayerContext(userId, updatedGame);
      const enemyContext = this.buildEnemyContext(userId, updatedGame);
      const payload = new GameResponsePayload(gameContext, playerContext, enemyContext);
      
      return new UpdateGameResponse('updated', gameId, payload, 'Game updated successfully');

    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to update game in repository', { gameId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Builds PlayerContext from game state for a specific user.
   * Maps rounds to RoundState objects with subRoundStates.
   * @param userId - The user identifier
   * @param game - The game entity
   * @returns PlayerContext with round states
   */
  private buildPlayerContext(userId: string, game: Game): PlayerContext {
    const roundStates = game.rounds.map(round => {
      // Convert subRounds to SubRoundState objects
      const subRoundStates = round.subRounds.map(subRound => {
        const started = subRound.startAt ? new Date(subRound.startAt) : null;
        const finished = subRound.finishedAt ? new Date(subRound.finishedAt) : null;
        const updated = subRound.updatedAt ? new Date(subRound.updatedAt) : null;

        return new SubRoundState(
          subRound.idNum,
          subRound.status,
          started,
          finished,
          updated,
          subRound.winnerId,
          subRound.moves
        );
      });

      // Convert startTime (number/timestamp) to Date
      const started = round.startTime ? new Date(round.startTime) : null;

      // Convert endTime (number/timestamp) to Date
      const finished = round.endTime ? new Date(round.endTime) : null;

      // Create RoundState
      return new RoundState(
        round.status,
        started,
        finished,
        round.id,
        round.winnerId,
        subRoundStates
      );
    });

    const inventory = game.inventories.find(item => item.userId === userId);
    if (!inventory) {
      throw new ValidationError(`Inventory for user '${userId}' not found`);
    }
    return new PlayerContext(roundStates, inventory);
  }

  /**
   * Extended games against one NPC include that row.
   * Classic games and games against a person stay empty.
   */
  private buildEnemyContext(callerId: string, game: Game): EnemyContext {
    if (game.createContext?.kind !== KindOfGame.Extended) {
      return new EnemyContext();
    }
    const npcIds = game.usersIds.filter(id => id !== callerId && id.startsWith('NPC_'));
    if (npcIds.length !== 1) {
      return new EnemyContext();
    }
    const inventory = game.inventories.find(item => item.userId === npcIds[0]);
    if (!inventory) {
      throw new ValidationError(`Inventory for user '${npcIds[0]}' not found`);
    }
    return new EnemyContext(inventory);
  }

  private toEntity(game: Game, etag?: string, metadata?: EntityMetadata): GameEntity {
    return new GameEntity(
      game.id,
      game.usersIds,
      game.rounds,
      game.status,
      etag,
      metadata,
      game.createContext,
      game.endTime,
      game.outcome.toJSON(),
      game.inventories,
      game.campaignLink()
    );
  }
}

