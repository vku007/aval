import { describe, it, expect } from 'vitest';
import { Round } from './Round.js';
import { SubRound } from './SubRound.js';
import { Move, MoveContext, MoveType } from './Move.js';
import { RoundStatus } from './RoundStatus.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('Round', () => {
  describe('constructor', () => {
    it('should create a round with valid data', () => {
      const round = new Round('round-1', RoundStatus.Pending, Date.now());
      
      expect(round.id).toBe('round-1');
      expect(round.subRounds).toEqual([]);
      expect(round.status).toBe(RoundStatus.Pending);
      expect(typeof round.startTime).toBe('number');
    });

    it('should create a round with subRounds', () => {
      const context1 = new MoveContext(MoveType.Stone, 10, 1);
      const context2 = new MoveContext(MoveType.Paper, 20, 2);
      const move1 = new Move('user-1', context1, Date.now());
      const move2 = new Move('user-2', context2, Date.now());
      const startTime = Date.now();
      const subRound1 = new SubRound(1, startTime, startTime + 1000, startTime);
      subRound1.moves = [move1];
      const subRound2 = new SubRound(2, startTime + 1000, startTime + 2000, startTime + 1000);
      subRound2.moves = [move2];
      const round = new Round('round-1', RoundStatus.Current, startTime);
      round.subRounds = [subRound1, subRound2];
      
      expect(round.subRounds).toHaveLength(2);
      expect(round.subRounds[0].idNum).toBe(1);
      expect(round.subRounds[1].idNum).toBe(2);
    });

    it('should throw ValidationError for invalid ID', () => {
      expect(() => new Round('', RoundStatus.Pending, Date.now())).toThrow(ValidationError);
      expect(() => new Round('invalid id!', RoundStatus.Pending, Date.now())).toThrow(ValidationError);
    });

    it('should initialize subRounds as empty array', () => {
      const round = new Round('round-1', RoundStatus.Pending, Date.now());
      expect(round.subRounds).toEqual([]);
      expect(Array.isArray(round.subRounds)).toBe(true);
    });

    it('should throw ValidationError for invalid status', () => {
      expect(() => new Round('round-1', 'not-a-status' as any, Date.now())).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid startTime', () => {
      expect(() => new Round('round-1', RoundStatus.Pending, 'not-a-number' as any)).toThrow(ValidationError);
      expect(() => new Round('round-1', RoundStatus.Pending, -1)).toThrow(ValidationError);
      expect(() => new Round('round-1', RoundStatus.Pending, 1.5)).toThrow(ValidationError);
      expect(() => new Round('round-1', RoundStatus.Pending, 999999999999999999999)).toThrow(ValidationError);
    });

    it('should create a round with winnerId and endTime', () => {
      const startTime = Date.now();
      const endTime = startTime + 1000;
      const round = new Round('round-1', RoundStatus.Finished, startTime, 'winner-user-1', endTime);
      
      expect(round.winnerId).toBe('winner-user-1');
      expect(round.endTime).toBe(endTime);
    });

    it('should throw ValidationError for invalid winnerId', () => {
      expect(() => new Round('round-1', RoundStatus.Pending, Date.now(), '')).toThrow(ValidationError);
      expect(() => new Round('round-1', RoundStatus.Pending, Date.now(), 'invalid id!')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid endTime', () => {
      const startTime = Date.now();
      expect(() => new Round('round-1', RoundStatus.Pending, startTime, undefined, -1)).toThrow(ValidationError);
      expect(() => new Round('round-1', RoundStatus.Pending, startTime, undefined, startTime - 1000)).toThrow(ValidationError);
    });
  });

  describe('setStatus', () => {
    it('should set status', () => {
      const round = new Round('round-1', RoundStatus.Pending, Date.now());
      
      round.setStatus(RoundStatus.Current);
      
      expect(round.status).toBe(RoundStatus.Current);
    });

    it('should throw ValidationError for invalid status value', () => {
      const round = new Round('round-1', RoundStatus.Pending, Date.now());
      
      expect(() => round.setStatus('not-a-status' as any)).toThrow(ValidationError);
    });
  });

  describe('finish', () => {
    it('should finish the round', () => {
      const round = new Round('round-1', RoundStatus.Current, Date.now());
      
      round.finish();
      
      expect(round.status).toBe(RoundStatus.Finished);
    });
  });

  describe('toJSON', () => {
    it('should convert round to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, startTime, startTime + 1000, startTime);
      subRound.moves = [move];
      const round = new Round('round-1', RoundStatus.Finished, startTime, 'winner-user-1', startTime + 1000);
      round.subRounds = [subRound];
      
      const json = round.toJSON();
      
      expect(json).toEqual({
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
          finishedAt: startTime + 1000,
          updatedAt: startTime,
          status: expect.any(String),
          winnerId: undefined
        }],
        status: RoundStatus.Finished,
        startTime: startTime,
        winnerId: 'winner-user-1',
        endTime: startTime + 1000
      });
    });
  });

  describe('fromJSON', () => {
    it('should create round from valid JSON', () => {
      const startTime = Date.now();
      const move = {
        userId: 'user-1',
        context: {
          moveType: MoveType.Stone,
          size: 10,
          decorId: 1
        },
        time: Date.now()
      };
      const json = {
        id: 'round-1',
        subRounds: [{
          idNum: 1,
          moves: [move],
          startAt: startTime,
          finishedAt: startTime + 1000,
          updatedAt: startTime,
          status: 'init',
          winnerId: undefined
        }],
        status: RoundStatus.Finished,
        startTime: startTime,
        winnerId: 'winner-user-1',
        endTime: startTime + 1000
      };
      
      const round = Round.fromJSON(json);
      
      expect(round.id).toBe('round-1');
      expect(round.subRounds).toHaveLength(1);
      expect(round.subRounds[0].idNum).toBe(1);
      expect(round.subRounds[0].moves).toHaveLength(1);
      expect(round.subRounds[0].moves[0].userId).toBe('user-1');
      expect(round.status).toBe(RoundStatus.Finished);
      expect(typeof round.startTime).toBe('number');
      expect(round.winnerId).toBe('winner-user-1');
      expect(round.endTime).toBe(startTime + 1000);
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => Round.fromJSON(null)).toThrow(ValidationError);
      expect(() => Round.fromJSON({})).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 123 })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', subRounds: 'not-array' })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', subRounds: [], status: 'not-a-status' })).toThrow(ValidationError);
      expect(() => Round.fromJSON({ id: 'round-1', subRounds: [], status: RoundStatus.Pending, startTime: 'not-number' })).toThrow(ValidationError);
    });
  });
});
