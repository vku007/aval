import { describe, it, expect } from 'vitest';
import { Game, GameTypeLength } from './Game.js';
import { Round } from '../value-object/Round.js';
import { RoundStatus } from '../value-object/RoundStatus.js';
import { SubRound } from '../value-object/SubRound.js';
import { Move, MoveContext, MoveType } from '../value-object/Move.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('Game', () => {
  describe('constructor', () => {
    it('should create a game with valid data', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [], false);
      
      expect(game.id).toBe('game-1');
      expect(game.type).toBe(GameTypeLength.BO3);
      expect(game.usersIds).toEqual(['user-1', 'user-2']);
      expect(game.rounds).toEqual([]);
      expect(game.isFinished).toBe(false);
    });

    it('should create a game with rounds', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, [], startTime, startTime, startTime);
      const subRound2 = new SubRound(1, [], startTime, startTime, startTime);
      const round1 = new Round('round-1', [subRound1], RoundStatus.Pending, startTime);
      const round2 = new Round('round-2', [subRound2], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], false);
      
      expect(game.rounds).toHaveLength(2);
      expect(game.rounds[0].id).toBe('round-1');
      expect(game.rounds[1].id).toBe('round-2');
    });

    it('should throw ValidationError for invalid ID', () => {
      expect(() => new Game('', GameTypeLength.BO3, ['user-1'], [], false)).toThrow(ValidationError);
      expect(() => new Game('invalid id!', GameTypeLength.BO3, ['user-1'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid type', () => {
      expect(() => new Game('game-1', '', ['user-1'], [], false)).toThrow(ValidationError);
      expect(() => new Game('game-1', 'a'.repeat(101), ['user-1'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid usersIds', () => {
      expect(() => new Game('game-1', GameTypeLength.BO3, [], [], false)).toThrow(ValidationError);
      expect(() => new Game('game-1', GameTypeLength.BO3, 'not-array' as any, [], false)).toThrow(ValidationError);
      expect(() => new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-1'], [], false)).toThrow(ValidationError);
      expect(() => new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10', 'user-11'], [], false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rounds', () => {
      expect(() => new Game('game-1', GameTypeLength.BO3, ['user-1'], 'not-array' as any, false)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid isFinished', () => {
      expect(() => new Game('game-1', GameTypeLength.BO3, ['user-1'], [], 'not-a-boolean' as any)).toThrow(ValidationError);
    });
  });

  describe('addRound', () => {
    it('should add a round and return a new Game instance', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);
      
      const updatedGame = game.addRound(round);
      
      expect(updatedGame).not.toBe(game); // Different instance
      expect(updatedGame.id).toBe(game.id);
      expect(updatedGame.rounds).toHaveLength(1);
      expect(updatedGame.rounds[0].id).toBe('round-1');
      expect(game.rounds).toHaveLength(0); // Original unchanged
    });

    it('should throw ValidationError for invalid round', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      
      expect(() => game.addRound('not-a-round' as any)).toThrow(ValidationError);
    });
  });

  describe('setFinished', () => {
    it('should set finished status and return a new Game instance', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      
      const finishedGame = game.setFinished(true);
      
      expect(finishedGame).not.toBe(game); // Different instance
      expect(finishedGame.id).toBe(game.id);
      expect(finishedGame.isFinished).toBe(true);
      expect(game.isFinished).toBe(false); // Original unchanged
    });

    it('should throw ValidationError for invalid finished value', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      
      expect(() => game.setFinished('not-a-boolean' as any)).toThrow(ValidationError);
    });
  });

  describe('finish', () => {
    it('should finish the game and return a new Game instance', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      
      const finishedGame = game.finish();
      
      expect(finishedGame).not.toBe(game); // Different instance
      expect(finishedGame.id).toBe(game.id);
      expect(finishedGame.isFinished).toBe(true);
      expect(game.isFinished).toBe(false); // Original unchanged
    });
  });

  describe('addMoveToRound', () => {
    it('should throw error as addMoveToRound is no longer supported', () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round], false);
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      
      expect(() => game.addMoveToRound('round-1', move)).toThrow(ValidationError);
      expect(() => game.addMoveToRound('round-1', move)).toThrow('addMoveToRound is no longer supported');
    });
  });

  describe('finishRound', () => {
    it('should finish a specific round', () => {
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Current, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round], false);
      
      const updatedGame = game.finishRound('round-1');
      
      expect(updatedGame).not.toBe(game); // Different instance
      expect(updatedGame.rounds[0].status).toBe(RoundStatus.Finished);
      expect(game.rounds[0].status).toBe(RoundStatus.Current); // Original unchanged
    });

    it('should throw ValidationError for non-existent round', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      
      expect(() => game.finishRound('non-existent')).toThrow(ValidationError);
    });
  });

  describe('utility methods', () => {
    it('should check if game has rounds', () => {
      const emptyGame = new Game('game-1', GameTypeLength.BO3, ['user-1'], [], false);
      const startTime = Date.now();
      const subRound = new SubRound(1, [], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Pending, startTime);
      const gameWithRounds = new Game('game-2', GameTypeLength.BO3, ['user-1'], [round], false);
      
      expect(emptyGame.hasRounds()).toBe(false);
      expect(gameWithRounds.hasRounds()).toBe(true);
    });

    it('should get round count', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, [], startTime, startTime, startTime);
      const subRound2 = new SubRound(1, [], startTime, startTime, startTime);
      const round1 = new Round('round-1', [subRound1], RoundStatus.Pending, startTime);
      const round2 = new Round('round-2', [subRound2], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], false);
      
      expect(game.getRoundCount()).toBe(2);
    });

    it('should get last round', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, [], startTime, startTime, startTime);
      const subRound2 = new SubRound(1, [], startTime, startTime, startTime);
      const round1 = new Round('round-1', [subRound1], RoundStatus.Pending, startTime);
      const round2 = new Round('round-2', [subRound2], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], false);
      
      expect(game.getLastRound()?.id).toBe('round-2');
      
      const emptyGame = new Game('game-2', GameTypeLength.BO3, ['user-1'], [], false);
      expect(emptyGame.getLastRound()).toBeUndefined();
    });

    it('should get specific round by ID', () => {
      const startTime = Date.now();
      const subRound1 = new SubRound(1, [], startTime, startTime, startTime);
      const subRound2 = new SubRound(1, [], startTime, startTime, startTime);
      const round1 = new Round('round-1', [subRound1], RoundStatus.Pending, startTime);
      const round2 = new Round('round-2', [subRound2], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1'], [round1, round2], false);
      
      expect(game.getRound('round-1')?.id).toBe('round-1');
      expect(game.getRound('round-2')?.id).toBe('round-2');
      expect(game.getRound('non-existent')).toBeUndefined();
    });

    it('should check if user is participating', () => {
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [], false);
      
      expect(game.hasUser('user-1')).toBe(true);
      expect(game.hasUser('user-2')).toBe(true);
      expect(game.hasUser('user-3')).toBe(false);
    });

    it('should get moves for a specific user', () => {
      const context1 = new MoveContext(MoveType.Stone, 10, 1);
      const context2 = new MoveContext(MoveType.Paper, 20, 2);
      const context3 = new MoveContext(MoveType.Scissors, 30, 3);
      const move1 = new Move('user-1', context1, Date.now());
      const move2 = new Move('user-2', context2, Date.now());
      const move3 = new Move('user-1', context3, Date.now());
      
      const startTime = Date.now();
      const subRound1 = new SubRound(1, [move1, move2], startTime, startTime, startTime);
      const subRound2 = new SubRound(1, [move3], startTime, startTime, startTime);
      const round1 = new Round('round-1', [subRound1], RoundStatus.Pending, startTime);
      const round2 = new Round('round-2', [subRound2], RoundStatus.Pending, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [round1, round2], false);
      
      const user1Moves = game.getMovesForUser('user-1');
      const user2Moves = game.getMovesForUser('user-2');
      const user3Moves = game.getMovesForUser('user-3');
      
      expect(user1Moves).toHaveLength(2);
      expect(user1Moves[0].userId).toBe('user-1');
      expect(user1Moves[1].userId).toBe('user-1');
      
      expect(user2Moves).toHaveLength(1);
      expect(user2Moves[0].userId).toBe('user-2');
      
      expect(user3Moves).toHaveLength(0);
    });
  });

  describe('toJSON', () => {
    it('should convert game to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Finished, startTime);
      const game = new Game('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [round], true);
      
      const json = game.toJSON();
      
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
            updatedAt: startTime
          }],
          status: RoundStatus.Finished,
          startTime: startTime
        }],
        isFinished: true
      });
    });
  });

  describe('fromJSON', () => {
    it('should create game from valid JSON', () => {
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
      
      const game = Game.fromJSON(json);
      
      expect(game.id).toBe('game-1');
      expect(game.type).toBe(GameTypeLength.BO3);
      expect(game.usersIds).toEqual(['user-1', 'user-2']);
      expect(game.rounds).toHaveLength(1);
      expect(game.rounds[0].id).toBe('round-1');
      expect(game.rounds[0].status).toBe(RoundStatus.Finished);
      expect(game.isFinished).toBe(true);
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => Game.fromJSON(null)).toThrow(ValidationError);
      expect(() => Game.fromJSON({})).toThrow(ValidationError);
      expect(() => Game.fromJSON({ id: 123 })).toThrow(ValidationError);
      expect(() => Game.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: 'not-array' })).toThrow(ValidationError);
      expect(() => Game.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: [], rounds: 'not-array' })).toThrow(ValidationError);
      expect(() => Game.fromJSON({ id: 'game-1', type: GameTypeLength.BO3, usersIds: [], rounds: [], isFinished: 'not-boolean' })).toThrow(ValidationError);
    });
  });
});
