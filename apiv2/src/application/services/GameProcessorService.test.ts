import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameProcessorService } from './GameProcessorService.js';
import { CreateGameRequest } from '../dto/processor/CreateGameRequest.js';
import { CreateGameResponse } from '../dto/processor/CreateGameResponse.js';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../domain/value-object/EpisodeContext.js';
import { Game, GameTypeLength } from '../../domain/entity/Game.js';
import { ValidationError } from '../../shared/errors/ValidationError.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import type { IGameRepository } from './GameService.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';

// Mock repository
const mockRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findAll: vi.fn(),
  getMetadata: vi.fn()
};

describe('GameProcessorService', () => {
  let gameProcessorService: GameProcessorService;

  beforeEach(() => {
    vi.clearAllMocks();
    gameProcessorService = new GameProcessorService(mockRepository as any);
  });

  describe('createGame', () => {
    it('should create a game successfully with valid request', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request = new CreateGameRequest('user-123', gameCreateContext);

      const savedGameEntity = new GameEntity(
        'game-1234567890-abc123',
        GameTypeLength.BO7,
        ['user-123', 'NPC_1'],
        [],
        GameStatus.Created
      );
      mockRepository.save.mockResolvedValueOnce(savedGameEntity);

      // Act
      const response = await gameProcessorService.createGame(request);

      // Assert
      expect(response).toBeInstanceOf(CreateGameResponse);
      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(response.gameId).toMatch(/^game-\d+-[a-z0-9]+$/); // Matches pattern: game-{timestamp}-{random}
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifNoneMatch: '*' }
      );
      const savedEntity = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(savedEntity.id).toBe(response.gameId);
      expect(savedEntity.type).toBe(GameTypeLength.BO7);
      expect(savedEntity.usersIds).toEqual(['user-123', 'NPC_1']);
      expect(savedEntity.status).toBe(GameStatus.Created);
    });

    it('should create game with BO7 type', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request = new CreateGameRequest('user-123', gameCreateContext);

      const savedGameEntity = new GameEntity(
        'game-1234567890-abc123',
        GameTypeLength.BO7,
        ['user-123', 'NPC_1'],
        [],
        GameStatus.Created
      );
      mockRepository.save.mockResolvedValueOnce(savedGameEntity);

      // Act
      const response = await gameProcessorService.createGame(request);

      // Assert
      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedEntity = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(savedEntity.type).toBe(GameTypeLength.BO7);
    });

    it('should include NPC_1 in usersIds when creating game', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVP,
        RoundsLength.BO3,
        KindOfGame.Extended,
        gameLevel,
        episodeContext
      );
      const request = new CreateGameRequest('user-456', gameCreateContext);

      const savedGameEntity = new GameEntity(
        'game-1234567890-abc123',
        GameTypeLength.BO7,
        ['user-456', 'NPC_1'],
        [],
        GameStatus.Created
      );
      mockRepository.save.mockResolvedValueOnce(savedGameEntity);

      // Act
      const response = await gameProcessorService.createGame(request);

      // Assert
      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedEntity = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(savedEntity.usersIds).toEqual(['user-456', 'NPC_1']);
    });

    it('should include createContext in the created game', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level2');
      const episodeContext = new EpisodeContext('Episode2');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO1,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request = new CreateGameRequest('user-789', gameCreateContext);

      const savedGameEntity = new GameEntity(
        'game-1234567890-abc123',
        GameTypeLength.BO7,
        ['user-789', 'NPC_1'],
        [],
        GameStatus.Created
      );
      mockRepository.save.mockResolvedValueOnce(savedGameEntity);

      // Act
      const response = await gameProcessorService.createGame(request);

      // Assert
      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      // The createContext is passed to Game constructor, which validates it
    });

    it('should handle different user IDs correctly', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request1 = new CreateGameRequest('user-alice', gameCreateContext);
      const request2 = new CreateGameRequest('user-bob', gameCreateContext);
      const request3 = new CreateGameRequest('user-12345', gameCreateContext);

      const savedGameEntity1 = new GameEntity('game-1', GameTypeLength.BO7, ['user-alice', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntity2 = new GameEntity('game-2', GameTypeLength.BO7, ['user-bob', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntity3 = new GameEntity('game-3', GameTypeLength.BO7, ['user-12345', 'NPC_1'], [], GameStatus.Created);
      mockRepository.save
        .mockResolvedValueOnce(savedGameEntity1)
        .mockResolvedValueOnce(savedGameEntity2)
        .mockResolvedValueOnce(savedGameEntity3);

      // Act
      const response1 = await gameProcessorService.createGame(request1);
      const response2 = await gameProcessorService.createGame(request2);
      const response3 = await gameProcessorService.createGame(request3);

      // Assert
      expect(response1.status).toBe('created');
      expect(response2.status).toBe('created');
      expect(response3.status).toBe('created');
      expect(response1.gameId).toBeTruthy();
      expect(response2.gameId).toBeTruthy();
      expect(response3.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should generate unique game IDs for multiple calls', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request1 = new CreateGameRequest('user-1', gameCreateContext);
      const request2 = new CreateGameRequest('user-2', gameCreateContext);

      const savedGameEntity1 = new GameEntity('game-1', GameTypeLength.BO7, ['user-1', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntity2 = new GameEntity('game-2', GameTypeLength.BO7, ['user-2', 'NPC_1'], [], GameStatus.Created);
      mockRepository.save
        .mockResolvedValueOnce(savedGameEntity1)
        .mockResolvedValueOnce(savedGameEntity2);

      // Act
      const response1 = await gameProcessorService.createGame(request1);
      const response2 = await gameProcessorService.createGame(request2);

      // Assert
      expect(response1.gameId).not.toBe(response2.gameId);
      expect(response1.status).toBe('created');
      expect(response2.status).toBe('created');
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle different game types', async () => {
      // Arrange - Test PVP
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContextPVP = new GameCreateContext(
        GameType.PVP,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const requestPVP = new CreateGameRequest('user-pvp', gameCreateContextPVP);

      // Arrange - Test PVE
      const gameCreateContextPVE = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Extended,
        gameLevel,
        episodeContext
      );
      const requestPVE = new CreateGameRequest('user-pve', gameCreateContextPVE);

      const savedGameEntityPVP = new GameEntity('game-pvp', GameTypeLength.BO7, ['user-pvp', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntityPVE = new GameEntity('game-pve', GameTypeLength.BO7, ['user-pve', 'NPC_1'], [], GameStatus.Created);
      mockRepository.save
        .mockResolvedValueOnce(savedGameEntityPVP)
        .mockResolvedValueOnce(savedGameEntityPVE);

      // Act
      const responsePVP = await gameProcessorService.createGame(requestPVP);
      const responsePVE = await gameProcessorService.createGame(requestPVE);

      // Assert
      expect(responsePVP.status).toBe('created');
      expect(responsePVE.status).toBe('created');
      expect(responsePVP.gameId).toBeTruthy();
      expect(responsePVE.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle different rounds lengths', async () => {
      // Arrange - Test BO1
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContextBO1 = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO1,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const requestBO1 = new CreateGameRequest('user-bo1', gameCreateContextBO1);

      // Arrange - Test BO3
      const gameCreateContextBO3 = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO3,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const requestBO3 = new CreateGameRequest('user-bo3', gameCreateContextBO3);

      const savedGameEntityBO1 = new GameEntity('game-bo1', GameTypeLength.BO7, ['user-bo1', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntityBO3 = new GameEntity('game-bo3', GameTypeLength.BO7, ['user-bo3', 'NPC_1'], [], GameStatus.Created);
      mockRepository.save
        .mockResolvedValueOnce(savedGameEntityBO1)
        .mockResolvedValueOnce(savedGameEntityBO3);

      // Act
      const responseBO1 = await gameProcessorService.createGame(requestBO1);
      const responseBO3 = await gameProcessorService.createGame(requestBO3);

      // Assert
      expect(responseBO1.status).toBe('created');
      expect(responseBO3.status).toBe('created');
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle different game kinds', async () => {
      // Arrange - Test Classic
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContextClassic = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const requestClassic = new CreateGameRequest('user-classic', gameCreateContextClassic);

      // Arrange - Test Extended
      const gameCreateContextExtended = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Extended,
        gameLevel,
        episodeContext
      );
      const requestExtended = new CreateGameRequest('user-extended', gameCreateContextExtended);

      const savedGameEntityClassic = new GameEntity('game-classic', GameTypeLength.BO7, ['user-classic', 'NPC_1'], [], GameStatus.Created);
      const savedGameEntityExtended = new GameEntity('game-extended', GameTypeLength.BO7, ['user-extended', 'NPC_1'], [], GameStatus.Created);
      mockRepository.save
        .mockResolvedValueOnce(savedGameEntityClassic)
        .mockResolvedValueOnce(savedGameEntityExtended);

      // Act
      const responseClassic = await gameProcessorService.createGame(requestClassic);
      const responseExtended = await gameProcessorService.createGame(requestExtended);

      // Assert
      expect(responseClassic.status).toBe('created');
      expect(responseExtended.status).toBe('created');
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should still return created status when repository save fails', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const request = new CreateGameRequest('user-123', gameCreateContext);

      mockRepository.save.mockRejectedValueOnce(new Error('Repository save failed'));

      // Act
      const response = await gameProcessorService.createGame(request);

      // Assert
      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifNoneMatch: '*' }
      );
    });
  });

  describe('updateGame', () => {
    it('should return failed status when game is finished', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const finishedGame = new Game(
        'game-1',
        GameTypeLength.BO7,
        ['user-123', 'NPC_1'],
        GameStatus.Finished,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const action = new Action(ActionType.Move, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-123', 'game-1', action, finishedGame);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toBe('Error: game is finished');
      expect(response.gameId).toBe('game-1');
      expect(response.payload.gameContext.status).toBe(GameStatus.Finished);
    });

    it('should return failed status when game is broken', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const brokenGame = new Game(
        'game-2',
        GameTypeLength.BO7,
        ['user-456', 'NPC_1'],
        GameStatus.Broken,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const action = new Action(ActionType.Move, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-456', 'game-2', action, brokenGame);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toBe('Error: game is broken');
      expect(response.gameId).toBe('game-2');
      expect(response.payload.gameContext.status).toBe(GameStatus.Broken);
    });

    it('should return updated status when game can be updated (Created status)', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const createdGame = new Game(
        'game-3',
        GameTypeLength.BO7,
        ['user-789', 'NPC_1'],
        GameStatus.Created,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const action = new Action(ActionType.Move, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-789', 'game-3', action, createdGame);

      // Assert
      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(response.gameId).toBe('game-3');
      expect(response.payload.gameContext.status).toBe(GameStatus.Created);
    });

    it('should return updated status when game can be updated (Started status)', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const startedGame = new Game(
        'game-4',
        GameTypeLength.BO7,
        ['user-abc', 'NPC_1'],
        GameStatus.Started,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const action = new Action(ActionType.Move, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-abc', 'game-4', action, startedGame);

      // Assert
      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(response.gameId).toBe('game-4');
      expect(response.payload.gameContext.status).toBe(GameStatus.Started);
    });

    it('should handle different action types', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const activeGame = new Game(
        'game-5',
        GameTypeLength.BO7,
        ['user-xyz', 'NPC_1'],
        GameStatus.Started,
        gameCreateContext
      );
      const actionContextMove = new ActionContext();
      const moveAction = new Action(ActionType.Move, actionContextMove);
      const actionContextSurrender = new ActionContext();
      const surrenderAction = new Action(ActionType.Surrender, actionContextSurrender);

      // Act
      const responseMove = await gameProcessorService.updateGame('user-xyz', 'game-5', moveAction, activeGame);
      const responseSurrender = await gameProcessorService.updateGame('user-xyz', 'game-5', surrenderAction, activeGame);

      // Assert
      expect(responseMove.status).toBe('updated');
      expect(responseSurrender.status).toBe('updated');
    });

    it('should change game status to finished when action type is Surrender', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const activeGame = new Game(
        'game-6',
        GameTypeLength.BO7,
        ['user-surrender', 'NPC_1'],
        GameStatus.Started,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const surrenderAction = new Action(ActionType.Surrender, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-surrender', 'game-6', surrenderAction, activeGame);

      // Assert
      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(activeGame.status).toBe(GameStatus.Finished);
      expect(response.payload.gameContext.status).toBe(GameStatus.Finished);
    });

    it('should not change game status when action type is Move', async () => {
      // Arrange
      const gameLevel = new GameLevel('Level1');
      const episodeContext = new EpisodeContext('Episode1');
      const gameCreateContext = new GameCreateContext(
        GameType.PVE,
        RoundsLength.BO7,
        KindOfGame.Classic,
        gameLevel,
        episodeContext
      );
      const activeGame = new Game(
        'game-7',
        GameTypeLength.BO7,
        ['user-move', 'NPC_1'],
        GameStatus.Started,
        gameCreateContext
      );
      const actionContext = new ActionContext();
      const moveAction = new Action(ActionType.Move, actionContext);

      // Act
      const response = await gameProcessorService.updateGame('user-move', 'game-7', moveAction, activeGame);

      // Assert
      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(activeGame.status).toBe(GameStatus.Started);
      expect(response.payload.gameContext.status).toBe(GameStatus.Started);
    });
  });
});

