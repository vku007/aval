import { describe, it, expect } from 'vitest';
import { Round } from './Round.js';
import { Move } from './Move.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('Round', () => {
  describe('constructor', () => {
    it('should create a round with valid data', () => {
      const round = new Round('round-1', [], false, Date.now());
      
      expect(round.id).toBe('round-1');
      expect(round.moves).toEqual([]);
      expect(round.isFinished).toBe(false);
      expect(typeof round.time).toBe('number');
    });

    it('should create a round with moves', () => {
      const move1 = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const move2 = new Move('move-2', 'user-2', 20, 'twenty', Date.now());
      const round = new Round('round-1', [move1, move2], false, Date.now());
      
      expect(round.moves).toHaveLength(2);
      expect(round.moves[0].id).toBe('move-1');
      expect(round.moves[1].id).toBe('move-2');
    });

    it('should throw ValidationError for invalid ID', () => {
      expect(() => new Round('', [], false, Date.now())).toThrow(ValidationError);
      expect(() => new Round('invalid id!', [], false, Date.now())).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid moves array', () => {
      expect(() => new Round('round-1', 'not-an-array' as any, false, Date.now())).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid isFinished', () => {
      expect(() => new Round('round-1', [], 'not-a-boolean' as any, Date.now())).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid time', () => {
      expect(() => new Round('round-1', [], false, 'not-a-number' as any)).toThrow(ValidationError);
      expect(() => new Round('round-1', [], false, -1)).toThrow(ValidationError);
      expect(() => new Round('round-1', [], false, 1.5)).toThrow(ValidationError);
      expect(() => new Round('round-1', [], false, 999999999999999999999)).toThrow(ValidationError);
    });
  });

  describe('addMove', () => {
    it('should add a move and return a new Round instance', () => {
      const round = new Round('round-1', [], false, Date.now());
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      
      const updatedRound = round.addMove(move);
      
      expect(updatedRound).not.toBe(round); // Different instance
      expect(updatedRound.id).toBe(round.id);
      expect(updatedRound.moves).toHaveLength(1);
      expect(updatedRound.moves[0].id).toBe('move-1');
      expect(round.moves).toHaveLength(0); // Original unchanged
    });

    it('should throw ValidationError for invalid move', () => {
      const round = new Round('round-1', [], false, Date.now());
      
      expect(() => round.addMove('not-a-move' as any)).toThrow(ValidationError);
    });
  });

  describe('setFinished', () => {
    it('should set finished status and return a new Round instance', () => {
      const round = new Round('round-1', [], false, Date.now());
      
      const finishedRound = round.setFinished(true);
      
      expect(finishedRound).not.toBe(round); // Different instance
      expect(finishedRound.id).toBe(round.id);
      expect(finishedRound.isFinished).toBe(true);
      expect(round.isFinished).toBe(false); // Original unchanged
    });

    it('should throw ValidationError for invalid finished value', () => {
      const round = new Round('round-1', [], false, Date.now());
      
      expect(() => round.setFinished('not-a-boolean' as any)).toThrow(ValidationError);
    });
  });

  describe('finish', () => {
    it('should finish the round and return a new Round instance', () => {
      const round = new Round('round-1', [], false, Date.now());
      
      const finishedRound = round.finish();
      
      expect(finishedRound).not.toBe(round); // Different instance
      expect(finishedRound.id).toBe(round.id);
      expect(finishedRound.isFinished).toBe(true);
      expect(round.isFinished).toBe(false); // Original unchanged
    });
  });

  describe('utility methods', () => {
    it('should check if round has moves', () => {
      const emptyRound = new Round('round-1', [], false, Date.now());
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const roundWithMoves = new Round('round-2', [move], false, Date.now());
      
      expect(emptyRound.hasMoves()).toBe(false);
      expect(roundWithMoves.hasMoves()).toBe(true);
    });

    it('should get move count', () => {
      const move1 = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const move2 = new Move('move-2', 'user-2', 20, 'twenty', Date.now());
      const round = new Round('round-1', [move1, move2], false, Date.now());
      
      expect(round.getMoveCount()).toBe(2);
    });

    it('should get last move', () => {
      const move1 = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const move2 = new Move('move-2', 'user-2', 20, 'twenty', Date.now());
      const round = new Round('round-1', [move1, move2], false, Date.now());
      
      expect(round.getLastMove()?.id).toBe('move-2');
      
      const emptyRound = new Round('round-2', [], false, Date.now());
      expect(emptyRound.getLastMove()).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should convert round to JSON', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten', Date.now());
      const round = new Round('round-1', [move], true, Date.now());
      
      const json = round.toJSON();
      
      expect(json).toEqual({
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
      });
    });
  });

  describe('fromJSON', () => {
    it('should create round from valid JSON', () => {
      const json = {
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
      };
      
      const round = Round.fromJSON(json);
      
      expect(round.id).toBe('round-1');
      expect(round.moves).toHaveLength(1);
      expect(round.moves[0].id).toBe('move-1');
      expect(round.isFinished).toBe(true);
      expect(typeof round.time).toBe('number');
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => Round.fromJSON(null)).toThrow(ValidationError);
      expect(() => Round.fromJSON({})).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 123 })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', moves: 'not-array' })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', moves: [], isFinished: 'not-boolean' })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', moves: [], isFinished: true, time: 'not-number' })).toThrow(ValidationError);
    });
  });
});
