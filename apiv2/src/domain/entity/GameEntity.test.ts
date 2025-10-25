import { describe, it, expect } from 'vitest';
import { GameEntity } from './GameEntity.js';
import { Round } from './Round.js';
import { Move } from './Move.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('GameEntity', () => {
  describe('constructor', () => {
    it('should create a game entity with valid data', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [], false);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe('tournament');
      expect(gameEntity.usersIds).toEqual(['user-1', 'user-2']);
      expect(gameEntity.rounds).toEqual([]);
      expect(gameEntity.isFinished).toBe(false);
    });

    it('should create a game entity with rounds', () => {
      const round1 = new Round('round-1', [], false, Date.now());
      const round2 = new Round('round-2', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round1, round2], false);
      
      expect(gameEntity.rounds).toHaveLength(2);
      expect(gameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.rounds[1].id).toBe('round-2');
    });

    it('should create a game entity with etag and metadata', () => {
      const metadata = { size: 100, lastModified: new Date().toISOString() };
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false, 'etag-123', metadata);
      
      expect(gameEntity.metadata).toEqual(metadata);
    });

    it('should throw ValidationError for invalid ID', () => {
      expect(() => new GameEntity('', 'tournament', ['user-1'], [], false)).toThrow(ValidationError);
      expect(() => new GameEntity('invalid id!', 'tournament', ['user-1'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid type', () => {
      expect(() => new GameEntity('game-1', '', ['user-1'], [], false)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', 'a'.repeat(101), ['user-1'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid usersIds', () => {
      expect(() => new GameEntity('game-1', 'tournament', [], [], false)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', 'tournament', 'not-array' as any, [], false)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', 'tournament', ['user-1', 'user-1'], [], false)).toThrow(ValidationError);
      expect(() => new GameEntity('game-1', 'tournament', ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10', 'user-11'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rounds', () => {
      expect(() => new GameEntity('game-1', 'tournament', ['user-1'], 'not-array' as any, false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid isFinished', () => {
      expect(() => new GameEntity('game-1', 'tournament', ['user-1'], [], 'not-a-boolean' as any)).toThrow(ValidationError);
    });
  });

  describe('immutable operations', () => {
    it('should add a round and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const round = new Round('round-1', [], false, Date.now());
      
      const updatedGameEntity = gameEntity.addRound(round);
      
      expect(updatedGameEntity).not.toBe(gameEntity); // Different instance
      expect(updatedGameEntity.id).toBe(gameEntity.id);
      expect(updatedGameEntity.rounds).toHaveLength(1);
      expect(updatedGameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.rounds).toHaveLength(0); // Original unchanged
    });

    it('should set finished status and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      
      const finishedGameEntity = gameEntity.setFinished(true);
      
      expect(finishedGameEntity).not.toBe(gameEntity); // Different instance
      expect(finishedGameEntity.id).toBe(gameEntity.id);
      expect(finishedGameEntity.isFinished).toBe(true);
      expect(gameEntity.isFinished).toBe(false); // Original unchanged
    });

    it('should finish the game and return a new GameEntity instance', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      
      const finishedGameEntity = gameEntity.finish();
      
      expect(finishedGameEntity).not.toBe(gameEntity); // Different instance
      expect(finishedGameEntity.id).toBe(gameEntity.id);
      expect(finishedGameEntity.isFinished).toBe(true);
      expect(gameEntity.isFinished).toBe(false); // Original unchanged
    });

    it('should add a move to a specific round', () => {
      const round = new Round('round-1', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round], false);
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      
      const updatedGameEntity = gameEntity.addMoveToRound('round-1', move);
      
      expect(updatedGameEntity).not.toBe(gameEntity); // Different instance
      expect(updatedGameEntity.rounds[0].moves).toHaveLength(1);
      expect(updatedGameEntity.rounds[0].moves[0].id).toBe('move-1');
      expect(gameEntity.rounds[0].moves).toHaveLength(0); // Original unchanged
    });

    it('should finish a specific round', () => {
      const round = new Round('round-1', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round], false);
      
      const updatedGameEntity = gameEntity.finishRound('round-1');
      
      expect(updatedGameEntity).not.toBe(gameEntity); // Different instance
      expect(updatedGameEntity.rounds[0].isFinished).toBe(true);
      expect(gameEntity.rounds[0].isFinished).toBe(false); // Original unchanged
    });

    it('should throw ValidationError for non-existent round', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      
      expect(() => gameEntity.addMoveToRound('non-existent', move)).toThrow(ValidationError);
      expect(() => gameEntity.finishRound('non-existent')).toThrow(ValidationError);
    });
  });

  describe('utility methods', () => {
    it('should check if game has rounds', () => {
      const emptyGameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const round = new Round('round-1', [], false, Date.now());
      const gameEntityWithRounds = new GameEntity('game-2', 'tournament', ['user-1'], [round], false);
      
      expect(emptyGameEntity.hasRounds()).toBe(false);
      expect(gameEntityWithRounds.hasRounds()).toBe(true);
    });

    it('should get round count', () => {
      const round1 = new Round('round-1', [], false, Date.now());
      const round2 = new Round('round-2', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round1, round2], false);
      
      expect(gameEntity.getRoundCount()).toBe(2);
    });

    it('should get last round', () => {
      const round1 = new Round('round-1', [], false, Date.now());
      const round2 = new Round('round-2', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round1, round2], false);
      
      expect(gameEntity.getLastRound()?.id).toBe('round-2');
      
      const emptyGameEntity = new GameEntity('game-2', 'tournament', ['user-1'], [], false);
      expect(emptyGameEntity.getLastRound()).toBeUndefined();
    });

    it('should get specific round by ID', () => {
      const round1 = new Round('round-1', [], false, Date.now());
      const round2 = new Round('round-2', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round1, round2], false);
      
      expect(gameEntity.getRound('round-1')?.id).toBe('round-1');
      expect(gameEntity.getRound('round-2')?.id).toBe('round-2');
      expect(gameEntity.getRound('non-existent')).toBeUndefined();
    });

    it('should check if user is participating', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [], false);
      
      expect(gameEntity.hasUser('user-1')).toBe(true);
      expect(gameEntity.hasUser('user-2')).toBe(true);
      expect(gameEntity.hasUser('user-3')).toBe(false);
    });

    it('should get moves for a specific user', () => {
      const move1 = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const move2 = new Move('move-2', 'user-2', 20, 'twenty', Date.now());
      const move3 = new Move('move-3', 'user-1', 30, 'thirty', Date.now());
      
      const round1 = new Round('round-1', [move1, move2], false, Date.now());
      const round2 = new Round('round-2', [move3], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [round1, round2], false);
      
      const user1Moves = gameEntity.getMovesForUser('user-1');
      const user2Moves = gameEntity.getMovesForUser('user-2');
      const user3Moves = gameEntity.getMovesForUser('user-3');
      
      expect(user1Moves).toHaveLength(2);
      expect(user1Moves[0].id).toBe('move-1');
      expect(user1Moves[1].id).toBe('move-3');
      
      expect(user2Moves).toHaveLength(1);
      expect(user2Moves[0].id).toBe('move-2');
      
      expect(user3Moves).toHaveLength(0);
    });
  });

  describe('backing store pattern', () => {
    it('should provide access to backing store', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const backingStore = gameEntity.internalGetBackingStore();
      
      expect(backingStore).toBeDefined();
      expect(backingStore.id).toBe('game-1');
      expect(backingStore.data).toBeDefined();
    });

    it('should create from backing store', () => {
      const originalGameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const backingStore = originalGameEntity.internalGetBackingStore();
      
      const recreatedGameEntity = originalGameEntity.internalCreateFromBackingStore(backingStore);
      
      expect(recreatedGameEntity.id).toBe(originalGameEntity.id);
      expect(recreatedGameEntity.type).toBe(originalGameEntity.type);
      expect(recreatedGameEntity.usersIds).toEqual(originalGameEntity.usersIds);
      expect(recreatedGameEntity.rounds).toEqual(originalGameEntity.rounds);
      expect(recreatedGameEntity.isFinished).toBe(originalGameEntity.isFinished);
    });

    it('should preserve etag and metadata through backing store', () => {
      const metadata = { size: 100, lastModified: new Date().toISOString() };
      const originalGameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false, 'etag-123', metadata);
      const backingStore = originalGameEntity.internalGetBackingStore();
      
      const recreatedGameEntity = originalGameEntity.internalCreateFromBackingStore(backingStore);
      
      expect(recreatedGameEntity.metadata).toEqual(metadata);
    });
  });

  describe('factory method', () => {
    it('should create game entity using factory method', () => {
      const gameEntity = GameEntity.create('game-1', 'tournament', ['user-1'], [], false);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe('tournament');
      expect(gameEntity.usersIds).toEqual(['user-1']);
      expect(gameEntity.rounds).toEqual([]);
      expect(gameEntity.isFinished).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should convert game entity to JSON', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const round = new Round('round-1', [move], true, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [round], true);
      
      const json = gameEntity.toJSON();
      
      expect(json).toEqual({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1', 'user-2'],
        rounds: [{
          id: 'round-1',
          moves: [{
            id: 'move-1',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten',
            time: expect.any(Number)
          }],
          isFinished: true,
          time: expect.any(Number)
        }],
        isFinished: true
      });
    });
  });

  describe('fromJSON', () => {
    it('should create game entity from valid JSON', () => {
      const json = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1', 'user-2'],
        rounds: [{
          id: 'round-1',
          moves: [{
            id: 'move-1',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten',
            time: Date.now()
          }],
          isFinished: true,
          time: Date.now()
        }],
        isFinished: true
      };
      
      const gameEntity = GameEntity.fromJSON(json);
      
      expect(gameEntity.id).toBe('game-1');
      expect(gameEntity.type).toBe('tournament');
      expect(gameEntity.usersIds).toEqual(['user-1', 'user-2']);
      expect(gameEntity.rounds).toHaveLength(1);
      expect(gameEntity.rounds[0].id).toBe('round-1');
      expect(gameEntity.isFinished).toBe(true);
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => GameEntity.fromJSON(null)).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({})).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 123 })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: 'tournament', usersIds: 'not-array' })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: 'tournament', usersIds: [], rounds: 'not-array' })).toThrow(ValidationError);
      expect(() => GameEntity.fromJSON({ id: 'game-1', type: 'tournament', usersIds: [], rounds: [], isFinished: 'not-boolean' })).toThrow(ValidationError);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of usersIds array', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false);
      const usersIds = gameEntity.usersIds;
      
      // Attempting to mutate should not affect the original
      usersIds.push('user-2');
      
      expect(gameEntity.usersIds).toEqual(['user-1']);
      expect(usersIds).toEqual(['user-1', 'user-2']); // Local copy was mutated
    });

    it('should not allow mutation of rounds array', () => {
      const round = new Round('round-1', [], false, Date.now());
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round], false);
      const rounds = gameEntity.rounds;
      
      // Attempting to mutate should not affect the original
      rounds.push(new Round('round-2', [], false, Date.now()));
      
      expect(gameEntity.rounds).toHaveLength(1);
      expect(rounds).toHaveLength(2); // Local copy was mutated
    });
  });
});
