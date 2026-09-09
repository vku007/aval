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
import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';

const mockRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findAll: vi.fn(),
  getMetadata: vi.fn()
};

function sampleCreateContext(
  gameType: GameType = GameType.PVE,
  rounds: RoundsLength = RoundsLength.BO3,
  kind: KindOfGame = KindOfGame.Classic
): GameCreateContext {
  return new GameCreateContext(
    gameType,
    rounds,
    kind,
    new GameLevel('Level1'),
    new EpisodeContext('Episode1')
  );
}

describe('GameProcessorService', () => {
  let gameProcessorService: GameProcessorService;

  beforeEach(() => {
    vi.clearAllMocks();
    gameProcessorService = new GameProcessorService(mockRepository as any);
  });

  describe('createGame', () => {
    it('should create a game with NPC opponent and persist createContext', async () => {
      const createContext = sampleCreateContext(GameType.PVE, RoundsLength.BO1, KindOfGame.Extended);
      const request = new CreateGameRequest('user-123', createContext);
      mockRepository.save.mockResolvedValueOnce(undefined);

      const response = await gameProcessorService.createGame(request);

      expect(response).toBeInstanceOf(CreateGameResponse);
      expect(response.status).toBe('created');
      expect(response.gameId).toMatch(/^game-\d+-[a-z0-9]+$/);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(GameEntity),
        { ifNoneMatch: '*' }
      );
      const savedEntity = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(savedEntity.id).toBe(response.gameId);
      expect(savedEntity.usersIds).toEqual(['user-123', 'NPC_1']);
      expect(savedEntity.status).toBe(GameStatus.Created);
      expect(savedEntity.createContext?.gameType).toBe(GameType.PVE);
      expect(savedEntity.createContext?.rounds).toBe(RoundsLength.BO1);
      expect(savedEntity.createContext?.kind).toBe(KindOfGame.Extended);
    });

    it('should generate unique game IDs for multiple calls', async () => {
      const createContext = sampleCreateContext();
      mockRepository.save.mockResolvedValue(undefined);

      const response1 = await gameProcessorService.createGame(new CreateGameRequest('user-1', createContext));
      const response2 = await gameProcessorService.createGame(new CreateGameRequest('user-2', createContext));

      expect(response1.gameId).not.toBe(response2.gameId);
      expect(response1.status).toBe('created');
      expect(response2.status).toBe('created');
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should still return created status when repository save fails', async () => {
      const request = new CreateGameRequest('user-123', sampleCreateContext());
      mockRepository.save.mockRejectedValueOnce(new Error('Repository save failed'));

      const response = await gameProcessorService.createGame(request);

      expect(response.status).toBe('created');
      expect(response.gameId).toBeTruthy();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateGame', () => {
    it('should return failed status when game is finished', async () => {
      const finishedGame = new Game(
        'game-1',
        ['user-123', 'NPC_1'],
        GameStatus.Finished,
        sampleCreateContext()
      );
      const action = new Action(ActionType.Move, new ActionContext());

      const response = await gameProcessorService.updateGame('user-123', 'game-1', action, finishedGame);

      expect(response.status).toBe('failed');
      expect(response.message).toBe('Error: game is finished');
      expect(response.gameId).toBe('game-1');
      expect(response.payload.gameContext.status).toBe(GameStatus.Finished);
    });

    it('should return failed status when game is broken', async () => {
      const brokenGame = new Game(
        'game-2',
        ['user-456', 'NPC_1'],
        GameStatus.Broken,
        sampleCreateContext()
      );
      const action = new Action(ActionType.Move, new ActionContext());

      const response = await gameProcessorService.updateGame('user-456', 'game-2', action, brokenGame);

      expect(response.status).toBe('failed');
      expect(response.message).toBe('Error: game is broken');
      expect(response.gameId).toBe('game-2');
      expect(response.payload.gameContext.status).toBe(GameStatus.Broken);
    });

    it('should return updated status when game can be updated (Created status)', async () => {
      const createdGame = new Game(
        'game-3',
        ['user-789', 'NPC_1'],
        GameStatus.Created,
        sampleCreateContext()
      );
      const action = new Action(ActionType.Move, new ActionContext());

      const response = await gameProcessorService.updateGame('user-789', 'game-3', action, createdGame);

      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(response.gameId).toBe('game-3');
      expect(response.payload.gameContext.status).toBe(GameStatus.Created);
    });

    it('should return updated status when game can be updated (Started status)', async () => {
      const startedGame = new Game(
        'game-4',
        ['user-abc', 'NPC_1'],
        GameStatus.Started,
        sampleCreateContext()
      );
      const action = new Action(ActionType.Move, new ActionContext());

      const response = await gameProcessorService.updateGame('user-abc', 'game-4', action, startedGame);

      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(response.gameId).toBe('game-4');
      expect(response.payload.gameContext.status).toBe(GameStatus.Started);
    });

    it('should change game status to finished when action type is Surrender', async () => {
      const activeGame = new Game(
        'game-6',
        ['user-surrender', 'NPC_1'],
        GameStatus.Started,
        sampleCreateContext()
      );
      const surrenderAction = new Action(ActionType.Surrender, new ActionContext());

      const response = await gameProcessorService.updateGame('user-surrender', 'game-6', surrenderAction, activeGame);

      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(activeGame.status).toBe(GameStatus.Finished);
      expect(response.payload.gameContext.status).toBe(GameStatus.Finished);
    });

    it('should not change game status when action type is Move', async () => {
      const activeGame = new Game(
        'game-7',
        ['user-move', 'NPC_1'],
        GameStatus.Started,
        sampleCreateContext()
      );
      const moveAction = new Action(ActionType.Move, new ActionContext());

      const response = await gameProcessorService.updateGame('user-move', 'game-7', moveAction, activeGame);

      expect(response.status).toBe('updated');
      expect(response.message).toBe('Game updated successfully');
      expect(activeGame.status).toBe(GameStatus.Started);
      expect(response.payload.gameContext.status).toBe(GameStatus.Started);
    });
  });
});

