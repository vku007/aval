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
import { ADVANCED_INVENTORY_ITEMS, GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { MoveEffect, MoveEffectKind } from '../../domain/value-object/MoveEffect.js';
import { ValidationError } from '../../shared/errors/index.js';

const mockRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findAll: vi.fn(),
  listIds: vi.fn(),
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

    it('should start both players on the advanced stacks when an extended game omits inventories', async () => {
      const before = Date.now();
      mockRepository.save.mockResolvedValueOnce(undefined);
      await gameProcessorService.createGame(
        new CreateGameRequest('user-123', sampleCreateContext(GameType.PVE, RoundsLength.BO5, KindOfGame.Extended))
      );

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(saved.inventories.map(inventory => inventory.userId)).toEqual(['user-123', 'NPC_1']);
      expect(saved.inventories[0].items).toEqual(ADVANCED_INVENTORY_ITEMS);
      expect(saved.inventories[1].items).toEqual(ADVANCED_INVENTORY_ITEMS);
      expect(saved.inventories[0].currencies.gold).toBe(1000);
      expect(saved.inventories[1].currencies.copper).toBe(1000);
      expect(saved.inventories[0].time).toBeGreaterThanOrEqual(before);
      expect(saved.inventories[1].time).toBeGreaterThanOrEqual(before);
    });

    it('should fill a missing extended player with the advanced stacks', async () => {
      const provided = new GamePlayerInventory(
        'user-123',
        { ...ADVANCED_INVENTORY_ITEMS, stones: 4 },
        GamePlayerInventory.defaultFor('user-123', 4).currencies,
        4
      );
      mockRepository.save.mockResolvedValueOnce(undefined);

      await gameProcessorService.createGame(
        new CreateGameRequest(
          'user-123',
          sampleCreateContext(GameType.PVE, RoundsLength.BO5, KindOfGame.Extended),
          [provided]
        )
      );

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(saved.inventories[0].items.stones).toBe(4);
      expect(saved.inventories[1].userId).toBe('NPC_1');
      expect(saved.inventories[1].items).toEqual(ADVANCED_INVENTORY_ITEMS);
    });

    it('should default both players when inventories are omitted', async () => {
      const before = Date.now();
      mockRepository.save.mockResolvedValueOnce(undefined);
      await gameProcessorService.createGame(new CreateGameRequest('user-123', sampleCreateContext()));

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(saved.inventories.map(inventory => inventory.userId)).toEqual(['user-123', 'NPC_1']);
      expect(saved.inventories[0].items.scissors).toBe(1000);
      expect(saved.inventories[1].currencies.silver).toBe(1000);
      expect(saved.inventories[0].time).toBeGreaterThanOrEqual(before);
      expect(saved.inventories[1].time).toBeGreaterThanOrEqual(before);
    });

    it('should keep a provided inventory and default the other player', async () => {
      const provided = new GamePlayerInventory(
        'user-123',
        { ...GamePlayerInventory.defaultFor('user-123', 4).items, papers: 6 },
        GamePlayerInventory.defaultFor('user-123', 4).currencies,
        4
      );
      mockRepository.save.mockResolvedValueOnce(undefined);

      await gameProcessorService.createGame(
        new CreateGameRequest('user-123', sampleCreateContext(), [provided])
      );

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(saved.inventories[0].items.papers).toBe(6);
      expect(saved.inventories[0].time).toBe(4);
      expect(saved.inventories[1].userId).toBe('NPC_1');
      expect(saved.inventories[1].items.stones).toBe(1000);
    });

    it('should reject an inventory for a user who is not in the game', async () => {
      const stranger = GamePlayerInventory.defaultFor('someone-else', 1);
      await expect(
        gameProcessorService.createGame(
          new CreateGameRequest('user-123', sampleCreateContext(), [stranger])
        )
      ).rejects.toThrow(ValidationError);
      expect(mockRepository.save).not.toHaveBeenCalled();
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

    it('should return only the caller inventory', async () => {
      const caller = new GamePlayerInventory(
        'user-1',
        { ...GamePlayerInventory.defaultFor('user-1', 11).items, stones: 2 },
        GamePlayerInventory.defaultFor('user-1', 11).currencies,
        11
      );
      const npc = GamePlayerInventory.defaultFor('NPC_1', 12);
      const entity = new GameEntity(
        'game-9',
        ['user-1', 'NPC_1'],
        [],
        GameStatus.Created,
        undefined,
        undefined,
        sampleCreateContext(),
        undefined,
        undefined,
        [caller, npc]
      );
      mockRepository.findById.mockResolvedValueOnce(entity);

      const response = await gameProcessorService.getGame('user-1', 'game-9');

      expect(response.payload.playerContext.inventory.toJSON()).toEqual(caller.toJSON());
    });

    it('should leave both inventories unchanged when an action is saved', async () => {
      const caller = new GamePlayerInventory(
        'user-1',
        { ...GamePlayerInventory.defaultFor('user-1', 11).items, stones: 2 },
        GamePlayerInventory.defaultFor('user-1', 11).currencies,
        11
      );
      const npc = new GamePlayerInventory(
        'NPC_1',
        { ...GamePlayerInventory.defaultFor('NPC_1', 12).items, papers: 3 },
        GamePlayerInventory.defaultFor('NPC_1', 12).currencies,
        12
      );
      const entity = new GameEntity(
        'game-1',
        ['user-1', 'NPC_1'],
        [],
        GameStatus.Started,
        'etag-1',
        undefined,
        sampleCreateContext(),
        undefined,
        undefined,
        [caller, npc]
      );
      mockRepository.findById.mockResolvedValueOnce(entity);
      mockRepository.save.mockImplementation(async (game: GameEntity) => game);

      const response = await gameProcessorService.updateGame(
        'user-1',
        'game-1',
        new Action(ActionType.Surrender, new ActionContext())
      );

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      expect(saved.inventories.map(inventory => inventory.toJSON())).toEqual([
        caller.toJSON(),
        npc.toJSON()
      ]);
      expect(response.payload.playerContext.inventory.toJSON()).toEqual(caller.toJSON());
    });

    it('should spend an extended move and return the caller inventory', async () => {
      const caller = new GamePlayerInventory(
        'user-1',
        {
          ...GamePlayerInventory.defaultFor('user-1', 11).items,
          stones: 5,
          NA_effect_stone: 2,
          NA_effect_scissors: 2,
          NA_effect_papers: 2,
          NT_effect: 3
        },
        GamePlayerInventory.defaultFor('user-1', 11).currencies,
        11
      );
      const npc = GamePlayerInventory.defaultFor('NPC_1', 12);
      const entity = new GameEntity(
        'game-1',
        ['user-1', 'NPC_1'],
        [],
        GameStatus.Started,
        'etag-1',
        undefined,
        sampleCreateContext(GameType.PVE, RoundsLength.BO3, KindOfGame.Extended),
        undefined,
        undefined,
        [caller, npc]
      );
      mockRepository.findById.mockResolvedValueOnce(entity);
      mockRepository.save.mockImplementation(async (game: GameEntity) => game);
      const move = new Move(
        'user-1',
        new MoveContext(MoveType.Stone, 2, 0, [
          new MoveEffect(MoveEffectKind.Overpower),
          new MoveEffect(MoveEffectKind.Protection)
        ]),
        Date.now()
      );

      const response = await gameProcessorService.updateGame(
        'user-1',
        'game-1',
        new Action(ActionType.Move, new ActionContext(move))
      );

      const saved = mockRepository.save.mock.calls[0][0] as GameEntity;
      const savedCaller = saved.inventories.find(item => item.userId === 'user-1')!;
      const savedNpc = saved.inventories.find(item => item.userId === 'NPC_1')!;
      const npcMove = saved.rounds[0].subRounds[0].moves.find(item => item.userId === 'NPC_1')!;
      expect(savedCaller.items.stones).toBe(3);
      expect(savedCaller.items.NA_effect_stone).toBe(1);
      expect(savedCaller.items.NA_effect_scissors).toBe(2);
      expect(savedCaller.items.NA_effect_papers).toBe(2);
      expect(savedCaller.items.NT_effect).toBe(2);
      expect(response.payload.gameContext.maxStonePerTurn).toBe(9);
      expect(response.payload.gameContext.maxScissorsPerTurn).toBe(4);
      expect(response.payload.gameContext.maxPaperPerTurn).toBe(7);
      expect(response.payload.gameContext.toJSON()).toMatchObject({
        max_stone_per_turn: 9,
        max_scissors_per_turn: 4,
        max_paper_per_turn: 7
      });
      expect(savedNpc.items[npcMove.context.moveType === MoveType.Stone
        ? 'stones'
        : npcMove.context.moveType === MoveType.Paper
          ? 'papers'
          : 'scissors']).toBe(1000 - npcMove.context.size);
      expect(savedNpc.items.NT_effect).toBe(1000);
      expect(response.payload.playerContext.inventory.items.stones).toBe(3);
      expect(response.payload.playerContext.inventory.items.NT_effect).toBe(2);
    });

    it('should reject an extended move the inventory cannot pay for', async () => {
      const caller = new GamePlayerInventory(
        'user-1',
        { ...GamePlayerInventory.defaultFor('user-1', 11).items, papers: 0 },
        GamePlayerInventory.defaultFor('user-1', 11).currencies,
        11
      );
      const entity = new GameEntity(
        'game-1',
        ['user-1', 'NPC_1'],
        [],
        GameStatus.Started,
        'etag-1',
        undefined,
        sampleCreateContext(GameType.PVE, RoundsLength.BO3, KindOfGame.Extended),
        undefined,
        undefined,
        [caller, GamePlayerInventory.defaultFor('NPC_1', 12)]
      );
      mockRepository.findById.mockResolvedValueOnce(entity);
      const move = new Move('user-1', new MoveContext(MoveType.Paper, 1, 0), Date.now());

      await expect(gameProcessorService.updateGame(
        'user-1',
        'game-1',
        new Action(ActionType.Move, new ActionContext(move))
      )).rejects.toThrow(ValidationError);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});

