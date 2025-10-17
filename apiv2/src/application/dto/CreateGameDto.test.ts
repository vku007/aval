import { describe, it, expect } from 'vitest';
import { CreateGameDtoValidator } from './CreateGameDto.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('CreateGameDto', () => {
  describe('validation', () => {
    it('should validate valid game data', () => {
      const validData = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1', 'user-2'],
        rounds: [],
        isFinished: false
      };

      const result = CreateGameDtoValidator.validate(validData);

      expect(result.id).toBe('game-1');
      expect(result.type).toBe('tournament');
      expect(result.usersIds).toEqual(['user-1', 'user-2']);
      expect(result.rounds).toEqual([]);
      expect(result.isFinished).toBe(false);
    });

    it('should validate game with rounds and moves', () => {
      const validData = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [{
          id: 'round-1',
          moves: [{
            id: 'move-1',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten'
          }],
          isFinished: false
        }],
        isFinished: false
      };

      const result = CreateGameDtoValidator.validate(validData);

      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].id).toBe('round-1');
      expect(result.rounds[0].moves).toHaveLength(1);
      expect(result.rounds[0].moves[0].id).toBe('move-1');
    });

    it('should apply default values', () => {
      const minimalData = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1']
      };

      const result = CreateGameDtoValidator.validate(minimalData);

      expect(result.rounds).toEqual([]);
      expect(result.isFinished).toBe(false);
    });

    it('should throw ValidationError for invalid ID', () => {
      const invalidData = {
        id: '',
        type: 'tournament',
        usersIds: ['user-1']
      };

      expect(() => CreateGameDtoValidator.validate(invalidData)).toThrow(ValidationError);
      expect(() => CreateGameDtoValidator.validate({ ...invalidData, id: 'invalid id!' })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid type', () => {
      const invalidData = {
        id: 'game-1',
        type: '',
        usersIds: ['user-1']
      };

      expect(() => CreateGameDtoValidator.validate(invalidData)).toThrow(ValidationError);
      expect(() => CreateGameDtoValidator.validate({ ...invalidData, type: 'a'.repeat(101) })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid usersIds', () => {
      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: []
      })).toThrow(ValidationError);

      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1', 'user-1']
      })).toThrow(ValidationError);

      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10', 'user-11']
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rounds', () => {
      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [{
          id: '',
          moves: [],
          isFinished: false
        }]
      })).toThrow(ValidationError);

      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [{
          id: 'round-1',
          moves: [{
            id: '',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten'
          }],
          isFinished: false
        }]
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid move values', () => {
      expect(() => CreateGameDtoValidator.validate({
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [{
          id: 'round-1',
          moves: [{
            id: 'move-1',
            userId: 'user-1',
            value: Infinity,
            valueDecorated: 'ten'
          }],
          isFinished: false
        }]
      })).toThrow(ValidationError);
    });
  });

  describe('validatePartial', () => {
    it('should validate partial data', () => {
      const partialData = {
        type: 'tournament'
      };

      const result = CreateGameDtoValidator.validatePartial(partialData);

      expect(result.type).toBe('tournament');
      expect(result.id).toBeUndefined();
    });

    it('should throw ValidationError for invalid partial data', () => {
      const invalidPartialData = {
        type: ''
      };

      expect(() => CreateGameDtoValidator.validatePartial(invalidPartialData)).toThrow(ValidationError);
    });
  });
});
