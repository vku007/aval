import { describe, it, expect } from 'vitest';
import { GameEntity } from './GameEntity.js';
import { GameTypeLength } from './Game.js';
import { Round } from '../value-object/Round.js';
import { RoundStatus } from '../value-object/RoundStatus.js';
import { SubRound } from '../value-object/SubRound.js';
import { Move, MoveContext, MoveType } from '../value-object/Move.js';
import { ValidationError } from '../../shared/errors/index.js';
import { GameStatus } from '../value-object/GameStatus.js';

describe('GameEntity', () => {
  describe('constructor', () => {
    it('should create a game entity with valid data', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [], GameStatus.Created);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe(GameTypeLength.BO3);
      expect(gameEntity.usersIds).toEqual(['user-1', 'user-2']);
      expect(gameEntity.rounds).toEqual([]);
      expect(gameEntity.isFinished).toBe(false);
    });

    it('should create a game entity with rounds', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime, startTime);
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      const round1 = new Round('round-1', RoundStatus.Pending, startTime);
      round1.subRounds = [subRound1];
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], GameStatus.Created);
      
      expect(gameEntity.rounds).toHaveLength(2);
      expect(gameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.rounds[1].id).toBe('round-2');
    });

    it('should create a game entity with etag and metadata', () => {
      const metadata = { size: 100, lastModified: new Date().toISOString() };
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created, 'etag-123', metadata);
      
      expect(gameEntity.metadata).toEqual(metadata);
    });

    it('should throw ValidationError for invalid ID', () => {
      expect(() => new GameEntity('', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created)).toThrow(ValidationError);
      expect(() => new GameEntity('invalid id!', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid type', () => {
      expect(() => new GameEntity('game-1', '', ['user-1'], [], GameStatus.Created)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', 'a'.repeat(101), ['user-1'], [], GameStatus.Created)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid usersIds', () => {
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, [], [], GameStatus.Created)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, 'not-array' as any, [], GameStatus.Created)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-1'], [], GameStatus.Created)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10', 'user-11'], [], GameStatus.Created)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rounds', () => {
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], 'not-array' as any, GameStatus.Created)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid status', () => {
      expect(() => new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], 'not-a-status' as any)).toThrow(ValidationError);
    });
  });

  describe('immutable operations', () => {
    it('should add a round and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      const round = new Round('round-1', RoundStatus.Pending, startTime);
      round.subRounds = [subRound];
      
      const updatedGameEntity = gameEntity.addRound(round);
      
      expect(updatedGameEntity).not.toBe(gameEntity); // Different instance
      expect(updatedGameEntity.id).toBe(gameEntity.id);
      expect(updatedGameEntity.rounds).toHaveLength(1);
      expect(updatedGameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.rounds).toHaveLength(0); // Original unchanged
    });

    it('should set status and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      
      const finishedGameEntity = gameEntity.setStatus(GameStatus.Finished);
      
      expect(finishedGameEntity).not.toBe(gameEntity); // Different instance
      expect(finishedGameEntity.id).toBe(gameEntity.id);
      expect(finishedGameEntity.status).toBe(GameStatus.Finished);
      expect(gameEntity.status).toBe(GameStatus.Created); // Original unchanged
    });

    it('should finish the game and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      
      const finishedGameEntity = gameEntity.finish();
      
      expect(finishedGameEntity).not.toBe(gameEntity); // Different instance
      expect(finishedGameEntity.id).toBe(gameEntity.id);
      expect(finishedGameEntity.status).toBe(GameStatus.Finished);
      expect(gameEntity.status).toBe(GameStatus.Created); // Original unchanged
    });

    it('should throw error as addMoveToRound is no longer supported', () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      const round = new Round('round-1', RoundStatus.Pending, startTime);
      round.subRounds = [subRound];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], GameStatus.Created);
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      
      expect(() => gameEntity.addMoveToRound('round-1', move)).toThrow(ValidationError);
      expect(() => gameEntity.addMoveToRound('round-1', move)).toThrow('addMoveToRound is no longer supported');
    });

    it('should finish a specific round', () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      const round = new Round('round-1', RoundStatus.Current, startTime);
      round.subRounds = [subRound];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], GameStatus.Created);
      
      const updatedGameEntity = gameEntity.finishRound('round-1');
      
      expect(updatedGameEntity).not.toBe(gameEntity); // Different instance
      expect(updatedGameEntity.rounds[0].status).toBe(RoundStatus.Finished);
      expect(gameEntity.rounds[0].status).toBe(RoundStatus.Current); // Original unchanged
    });

    it('should throw ValidationError for non-existent round', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      
      expect(() => gameEntity.addMoveToRound('non-existent', move)).toThrow(ValidationError);
      expect(() => gameEntity.finishRound('non-existent')).toThrow(ValidationError);
    });
  });

  describe('utility methods', () => {
    it('should check if game has rounds', () => {
      const emptyGameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      const round = new Round('round-1', RoundStatus.Pending, startTime);
      round.subRounds = [subRound];
      const gameEntityWithRounds = new GameEntity('game-2', GameTypeLength.BO3, ['user-1'], [round], GameStatus.Created);
      
      expect(emptyGameEntity.hasRounds()).toBe(false);
      expect(gameEntityWithRounds.hasRounds()).toBe(true);
    });

    it('should get round count', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime, startTime);
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      const round1 = new Round('round-1', RoundStatus.Pending, startTime);
      round1.subRounds = [subRound1];
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], GameStatus.Created);
      
      expect(gameEntity.getRoundCount()).toBe(2);
    });

    it('should get last round', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime, startTime);
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      const round1 = new Round('round-1', RoundStatus.Pending, startTime);
      round1.subRounds = [subRound1];
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], GameStatus.Created);
      
      expect(gameEntity.getLastRound()?.id).toBe('round-2');
      
      const emptyGameEntity = new GameEntity('game-2', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      expect(emptyGameEntity.getLastRound()).toBeUndefined();
    });

    it('should get specific round by ID', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime, startTime);
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      const round1 = new Round('round-1', RoundStatus.Pending, startTime);
      round1.subRounds = [subRound1];
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], GameStatus.Created);
      
      expect(gameEntity.getRound('round-1')?.id).toBe('round-1');
      expect(gameEntity.getRound('round-2')?.id).toBe('round-2');
      expect(gameEntity.getRound('non-existent')).toBeUndefined();
    });

    it('should check if user is participating', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [], GameStatus.Created);
      
      expect(gameEntity.hasUser('user-1')).toBe(true);
      expect(gameEntity.hasUser('user-2')).toBe(true);
      expect(gameEntity.hasUser('user-3')).toBe(false);
    });

    it('should get moves for a specific user', () => {
      const context1 = new MoveContext(MoveType.Stone, 10, 1);
      const context2 = new MoveContext(MoveType.Paper, 20, 2);
      const context3 = new MoveContext(MoveType.Scissors, 30, 3);
      const move1 = new Move('user-1', context1, Date.now());
      const move2 = new Move('user-2', context2, Date.now());
      const move3 = new Move('user-1', context3, Date.now());
      
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime, startTime);
      subRound1.moves = [move1, move2];
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      subRound2.moves = [move3];
      const round1 = new Round('round-1', RoundStatus.Pending, startTime);
      round1.subRounds = [subRound1];
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [round1, round2], GameStatus.Created);
      
      const user1Moves = gameEntity.getMovesForUser('user-1');
      const user2Moves = gameEntity.getMovesForUser('user-2');
      const user3Moves = gameEntity.getMovesForUser('user-3');
      
      expect(user1Moves).toHaveLength(2);
      expect(user1Moves[0].userId).toBe('user-1');
      expect(user1Moves[1].userId).toBe('user-1');
      
      expect(user2Moves).toHaveLength(1);
      expect(user2Moves[0].userId).toBe('user-2');
      
      expect(user3Moves).toHaveLength(0);
    });
  });

  describe('backing store pattern', () => {
    it('should provide access to backing store', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      const backingStore = gameEntity.internalGetBackingStore();
      
      expect(backingStore).toBeDefined();
      expect(backingStore.id).toBe('game-1');
      expect(backingStore.data).toBeDefined();
    });

    it('should create from backing store', () => {
      const originalGameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      const backingStore = originalGameEntity.internalGetBackingStore();
      
      const recreatedGameEntity = originalGameEntity.internalCreateFromBackingStore(backingStore);
      
      expect(recreatedGameEntity.id).toBe(originalGameEntity.id);
      expect(recreatedGameEntity.type).toBe(originalGameEntity.type);
      expect(recreatedGameEntity.usersIds).toEqual(originalGameEntity.usersIds);
      expect(recreatedGameEntity.rounds).toEqual(originalGameEntity.rounds);
      expect(recreatedGameEntity.status).toBe(originalGameEntity.status);
    });

    it('should preserve etag and metadata through backing store', () => {
      const metadata = { size: 100, lastModified: new Date().toISOString() };
      const originalGameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created, 'etag-123', metadata);
      const backingStore = originalGameEntity.internalGetBackingStore();
      
      const recreatedGameEntity = originalGameEntity.internalCreateFromBackingStore(backingStore);
      
      expect(recreatedGameEntity.metadata).toEqual(metadata);
    });
  });

  describe('factory method', () => {
    it('should create game entity using factory method', () => {
      const gameEntity = GameEntity.create('game-1', GameTypeLength.BO3, ['user-1'], [], GameStatus.Created);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe(GameTypeLength.BO3);
      expect(gameEntity.usersIds).toEqual(['user-1']);
      expect(gameEntity.rounds).toEqual([]);
      expect(gameEntity.isFinished).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should convert game entity to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      subRound.moves = [move];
      const round = new Round('round-1', RoundStatus.Finished, startTime);
      round.subRounds = [subRound];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [round], GameStatus.Finished);
      
      const json = gameEntity.toJSON();
      
      expect(json).toEqual({
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1', 'user-2'],
        rounds: [{
          id: 'round-1',
          subRounds: [{
            idNum: 1,
            moves: [{
              userId: 'user-1',
              context: {
                moveType: MoveType.Stone,
                size: 10,
                decorId: 1
              },
              time: expect.any(Number)
            }],
            startAt: startTime,
            finishedAt: startTime,
            updatedAt: startTime,
            status: 'init',
            winnerId: undefined
          }],
          status: RoundStatus.Finished,
          startTime: startTime,
          endTime: undefined,
          winnerId: undefined
        }],
        status: GameStatus.Finished,
        isFinished: true, // Backward compatibility
        createContext: undefined,
        endTime: undefined
      });
    });
  });

  describe('fromJSON', () => {
    it('should create game entity from valid JSON', () => {
      const startTime = Date.now();
      const json = {
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1', 'user-2'],
        rounds: [{
          id: 'round-1',
          subRounds: [{
            idNum: 1,
            moves: [{
              userId: 'user-1',
              context: {
                moveType: MoveType.Stone,
                size: 10,
                decorId: 1
              },
              time: Date.now()
            }],
            startAt: startTime,
            finishedAt: startTime,
            updatedAt: startTime
          }],
          status: RoundStatus.Finished,
          startTime: startTime
        }],
        isFinished: true
      };
      
      const gameEntity = GameEntity.fromJSON(json);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe(GameTypeLength.BO3);
      expect(gameEntity.usersIds).toEqual(['user-1', 'user-2']);
      expect(gameEntity.rounds).toHaveLength(1);
      expect(gameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.rounds[0].status).toBe(RoundStatus.Finished);
      expect(gameEntity.isFinished).toBe(true);
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => GameEntity.fromJSON(null)).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({})).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 123 })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: 'not-array' })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: [], rounds: 'not-array' })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: [], rounds: [], status: 'not-a-status' })).toThrow(ValidationError);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of rounds array', () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime, startTime);
      const round = new Round('round-1', RoundStatus.Pending, startTime);
      round.subRounds = [subRound];
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], GameStatus.Created);
      const rounds = gameEntity.rounds;
      
      // Attempting to mutate should not affect the original
      const subRound2 = new SubRound(1, startTime, startTime, startTime);
      const round2 = new Round('round-2', RoundStatus.Pending, startTime);
      round2.subRounds = [subRound2];
      rounds.push(round2);
      
      expect(gameEntity.rounds).toHaveLength(1);
      expect(rounds).toHaveLength(2); // Local copy was mutated
    });
  });
});
