import { describe, it, expect } from 'vitest';
import { GameResponseDto, RoundResponseDto, MoveResponseDto } from './GameResponseDto.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { GameTypeLength } from '../../domain/entity/Game.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';

describe('GameResponseDto', () => {
  describe('fromGameEntity', () => {
    it('should create response DTO from game entity', () => {
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [], false);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.id).toBe('game-1');
      expect(responseDto.type).toBe(GameTypeLength.BO3);
      expect(responseDto.usersIds).toEqual(['user-1', 'user-2']);
      expect(responseDto.rounds).toEqual([]);
      expect(responseDto.isFinished).toBe(false);
    });

    it('should create response DTO with rounds and moves', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Finished, startTime);
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [round], true);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.rounds).toHaveLength(1);
      expect(responseDto.rounds[0].id).toBe('round-1');
      expect(responseDto.rounds[0].moves).toHaveLength(1);
      expect(responseDto.rounds[0].moves[0].userId).toBe('user-1');
      expect(responseDto.rounds[0].isFinished).toBe(true);
      expect(responseDto.isFinished).toBe(true);
    });

    it('should include etag and metadata', () => {
      const metadata = { size: 100, lastModified: new Date().toISOString() };
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1'], [], false, 'etag-123', metadata);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.etag).toBe('etag-123');
      expect(responseDto.metadata).toEqual(metadata);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Finished, startTime);
      const gameEntity = new GameEntity('game-1', GameTypeLength.BO3, ['user-1', 'user-2'], [round], true);
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      const json = responseDto.toJSON();
      
      expect(json).toEqual({
        id: 'game-1',
        type: GameTypeLength.BO3,
        usersIds: ['user-1', 'user-2'],
        rounds: [{
          id: 'round-1',
          moves: [{
            userId: 'user-1',
            context: {
              moveType: MoveType.Stone,
              size: 10,
              decorId: 1
            },
            time: expect.any(Number)
          }],
          isFinished: true
        }],
        isFinished: true,
        etag: undefined,
        metadata: undefined
      });
    });
  });
});

describe('RoundResponseDto', () => {
  describe('fromRound', () => {
    it('should create response DTO from round', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Finished, startTime);
      
      const responseDto = RoundResponseDto.fromRound(round);
      
      expect(responseDto.id).toBe('round-1');
      expect(responseDto.moves).toHaveLength(1);
      expect(responseDto.moves[0].userId).toBe('user-1');
      expect(responseDto.isFinished).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const startTime = Date.now();
      const subRound = new SubRound(1, [move], startTime, startTime, startTime);
      const round = new Round('round-1', [subRound], RoundStatus.Finished, startTime);
      const responseDto = RoundResponseDto.fromRound(round);
      
      const json = responseDto.toJSON();
      
      expect(json).toEqual({
        id: 'round-1',
        moves: [{
          userId: 'user-1',
          context: {
            moveType: MoveType.Stone,
            size: 10,
            decorId: 1
          },
          time: expect.any(Number)
        }],
        isFinished: true
      });
    });
  });
});

describe('MoveResponseDto', () => {
  describe('fromMove', () => {
    it('should create response DTO from move', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      
      const responseDto = MoveResponseDto.fromMove(move);
      
      expect(responseDto.userId).toBe('user-1');
      expect(responseDto.context.moveType).toBe(MoveType.Stone);
      expect(responseDto.context.size).toBe(10);
      expect(responseDto.context.decorId).toBe(1);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const context = new MoveContext(MoveType.Stone, 10, 1);
      const move = new Move('user-1', context, Date.now());
      const responseDto = MoveResponseDto.fromMove(move);
      
      const json = responseDto.toJSON();
      
      expect(json).toEqual({
        userId: 'user-1',
        context: {
          moveType: MoveType.Stone,
          size: 10,
          decorId: 1
        },
        time: expect.any(Number)
      });
    });
  });
});
