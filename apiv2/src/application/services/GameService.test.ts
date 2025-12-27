import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameService } from './GameService.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { GameTypeLength } from '../../domain/entity/Game.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { CreateGameDto } from '../dto/CreateGameDto.js';
import { UpdateGameDto } from '../dto/UpdateGameDto.js';
import { NotFoundError } from '../../shared/errors/NotFoundError.js';
import { ConflictError } from '../../shared/errors/ConflictError.js';
import { ValidationError } from '../../shared/errors/ValidationError.js';

// Mock repository
const mockRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findAll: vi.fn(),
  getMetadata: vi.fn()
};

describe('GameService', () => {
  let gameService: GameService;

  beforeEach(() => {
    vi.clearAllMocks();
    gameService = new GameService(mockRepository as any);
  });

  describe('getGame', () => {
    it('should return game when found', async () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      mockRepository.findById.mockResolvedValueOnce(gameEntity);

      const result = await gameService.getGame('game-1');

      expect(result.id).toBe('game-1');
      expect(result.type).toBe(GameTypeLength.BO3);
      expect(mockRepository.findById).toHaveBeenCalledWith('game-1', undefined);
    });

    it('should pass ifNoneMatch header', async () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      mockRepository.findById.mockResolvedValueOnce(gameEntity);

      await gameService.getGame('game-1', 'etag-123');

      expect(mockRepository.findById).toHaveBeenCalledWith('game-1', 'etag-123');
    });

    it('should throw NotFoundError when game not found', async () => {
      mockRepository.findById.mockRejectedValueOnce(new NotFoundError('Game not found'));

      await expect(gameService.getGame('game-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createGame', () => {
    it('should create game successfully', async () => {
      const dto: CreateGameDto = {
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false
      };

      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      mockRepository.save.mockResolvedValueOnce(gameEntity);

      const result = await gameService.createGame(dto);

      expect(result.id).toBe('game-1');
      expect(result.type).toBe(GameTypeLength.BO3);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifNoneMatch: '*' }
      );
    });

    it('should pass ifNoneMatch header for creation', async () => {
      const dto: CreateGameDto = {
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false
      };

      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      mockRepository.save.mockResolvedValueOnce(gameEntity);

      await gameService.createGame(dto, 'etag-123');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifNoneMatch: 'etag-123' }
      );
    });

    it('should create game with rounds and moves', async () => {
      const dto: CreateGameDto = {
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1'],
        rounds: [{
          id: 'round-1',
          moves: [{
            userId: 'user-1',
            context: {
              moveType: MoveType.Stone,
              size: 10,
              decorId: 1
            }
          }],
          isFinished: false,
          startTime: Date.now()
        }],
        isFinished: false
      };

      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], false);
      mockRepository.save.mockResolvedValueOnce(gameEntity);

      const result = await gameService.createGame(dto);

      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].id).toBe('round-1');
    });
  });

  describe('updateGame', () => {
    it('should update game with replace strategy', async () => {
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const dto: UpdateGameDto = {
        type: GameTypeLength.BO5,
        usersIds: ['user-1', 'user-2'],
        rounds: [],
        isFinished: true
      };

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      const result = await gameService.updateGame('game-1', dto, false);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: undefined }
      );
    });

    it('should update game with merge strategy', async () => {
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const dto: UpdateGameDto = {
        type: GameTypeLength.BO5
      };

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      const result = await gameService.updateGame('game-1', dto, true);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: undefined }
      );
    });

    it('should throw NotFoundError when game not found', async () => {
      mockRepository.findById.mockRejectedValueOnce(new NotFoundError('Game not found'));

      await expect(gameService.updateGame('game-1', {}, false)).rejects.toThrow(NotFoundError);
    });

    it('should pass ifMatch header for updates', async () => {
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const dto: UpdateGameDto = { 
        type: GameTypeLength.BO5,
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false
      };

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      await gameService.updateGame('game-1', dto, false, 'old-etag');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: 'old-etag' }
      );
    });
  });

  describe('deleteGame', () => {
    it('should delete game successfully', async () => {
      mockRepository.delete.mockResolvedValueOnce(undefined);

      await gameService.deleteGame('game-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('game-1', { ifMatch: undefined });
    });

    it('should pass ifMatch header for deletion', async () => {
      mockRepository.delete.mockResolvedValueOnce(undefined);

      await gameService.deleteGame('game-1', 'etag-123');

      expect(mockRepository.delete).toHaveBeenCalledWith('game-1', { ifMatch: 'etag-123' });
    });
  });

  describe('getGameMetadata', () => {
    it('should return game metadata', async () => {
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };
      mockRepository.getMetadata.mockResolvedValueOnce(metadata);

      const result = await gameService.getGameMetadata('game-1');

      expect(result.etag).toBe('etag-123');
      expect(mockRepository.getMetadata).toHaveBeenCalledWith('game-1');
    });
  });

  describe('listGames', () => {
    it('should return list of games', async () => {
      const game1 = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const game2 = new GameEntity('game-2', GameTypeLength.BO5, ['user-2'], [], false);
      
      mockRepository.findAll.mockResolvedValueOnce({
        items: [game1, game2],
        nextCursor: undefined
      });

      const result = await gameService.listGames();

      expect(result.names).toHaveLength(2);
      expect(result.names[0]).toBe('game-1');
      expect(result.names[1]).toBe('game-2');
    });

    it('should pass pagination parameters', async () => {
      mockRepository.findAll.mockResolvedValueOnce({
        items: [],
        nextCursor: undefined
      });

      await gameService.listGames('game-', 10, 'cursor-123');

      expect(mockRepository.findAll).toHaveBeenCalledWith('game-', 10, 'cursor-123');
    });
  });

  describe('game-specific operations', () => {
    it('should add round to game', async () => {
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      const result = await gameService.addRoundToGame('game-1', round);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: undefined }
      );
    });

    it('should throw error as addMoveToGameRound is no longer supported', async () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], false);
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());

      mockRepository.findById.mockResolvedValueOnce(existingGame);

      const error = await gameService.addMoveToGameRound('game-1', 'round-1', move).catch(e => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('addMoveToRound is no longer supported');
    });

    it('should finish game round', async () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Current, startTime);
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], false);

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      const result = await gameService.finishGameRound('game-1', 'round-1');

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: undefined }
      );
    });

    it('should finish game', async () => {
      const existingGame = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false);

      mockRepository.findById.mockResolvedValueOnce(existingGame);
      mockRepository.save.mockResolvedValueOnce(existingGame);

      const result = await gameService.finishGame('game-1');

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifMatch: undefined }
      );
    });
  });
});
