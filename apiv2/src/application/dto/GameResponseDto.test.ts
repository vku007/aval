import { describe, it, expect } from 'vitest';
import { GameResponseDto, RoundResponseDto, MoveResponseDto } from './GameResponseDto.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { Round } from '../../domain/entity/Round.js';
import { Move } from '../../domain/entity/Move.js';

describe('GameResponseDto', () => {
  describe('fromGameEntity', () => {
    it('should create response DTO from game entity', () => {
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [], false);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.id).toBe('game-1');
      expect(responseDto.type).toBe('tournament');
      expect(responseDto.usersIds).toEqual(['user-1', 'user-2']);
      expect(responseDto.rounds).toEqual([]);
      expect(responseDto.isFinished).toBe(false);
    });

    it('should create response DTO with rounds and moves', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten');
      const round = new Round('round-1', [move], true);
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [round], true);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.rounds).toHaveLength(1);
      expect(responseDto.rounds[0].id).toBe('round-1');
      expect(responseDto.rounds[0].moves).toHaveLength(1);
      expect(responseDto.rounds[0].moves[0].id).toBe('move-1');
      expect(responseDto.isFinished).toBe(true);
    });

    it('should include etag and metadata', () => {
      const metadata = { size: 100, lastModified: new Date() };
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1'], [], false, 'etag-123', metadata);
      
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      expect(responseDto.etag).toBe('etag-123');
      expect(responseDto.metadata).toEqual(metadata);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten');
      const round = new Round('round-1', [move], true);
      const gameEntity = new GameEntity('game-1', 'tournament', ['user-1', 'user-2'], [round], true);
      const responseDto = GameResponseDto.fromGameEntity(gameEntity);
      
      const json = responseDto.toJSON();
      
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
            valueDecorated: 'ten'
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
      const move = new Move('move-1', 'user-1', 10, 'ten');
      const round = new Round('round-1', [move], true);
      
      const responseDto = RoundResponseDto.fromRound(round);
      
      expect(responseDto.id).toBe('round-1');
      expect(responseDto.moves).toHaveLength(1);
      expect(responseDto.moves[0].id).toBe('move-1');
      expect(responseDto.isFinished).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten');
      const round = new Round('round-1', [move], true);
      const responseDto = RoundResponseDto.fromRound(round);
      
      const json = responseDto.toJSON();
      
      expect(json).toEqual({
        id: 'round-1',
        moves: [{
          id: 'move-1',
          userId: 'user-1',
          value: 10,
          valueDecorated: 'ten'
        }],
        isFinished: true
      });
    });
  });
});

describe('MoveResponseDto', () => {
  describe('fromMove', () => {
    it('should create response DTO from move', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten');
      
      const responseDto = MoveResponseDto.fromMove(move);
      
      expect(responseDto.id).toBe('move-1');
      expect(responseDto.userId).toBe('user-1');
      expect(responseDto.value).toBe(10);
      expect(responseDto.valueDecorated).toBe('ten');
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const move = new Move('move-1', 'user-1', 10, 'ten');
      const responseDto = MoveResponseDto.fromMove(move);
      
      const json = responseDto.toJSON();
      
      expect(json).toEqual({
        id: 'move-1',
        userId: 'user-1',
        value: 10,
        valueDecorated: 'ten'
      });
    });
  });
});
