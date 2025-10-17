import { describe, it, expect } from 'vitest';
import { UpdateGameDtoValidator } from './UpdateGameDto.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('UpdateGameDto', () => {
  describe('validation', () => {
    it('should validate valid update data', () => {
      const validData = {
        type: 'tournament',
        usersIds: ['user-1', 'user-2'],
        isFinished: true
      };

      const result = UpdateGameDtoValidator.validate(validData);

      expect(result.type).toBe('tournament');
      expect(result.usersIds).toEqual(['user-1', 'user-2']);
      expect(result.isFinished).toBe(true);
    });

    it('should validate partial update data', () => {
      const partialData = {
        type: 'tournament'
      };

      const result = UpdateGameDtoValidator.validate(partialData);

      expect(result.type).toBe('tournament');
      expect(result.usersIds).toBeUndefined();
      expect(result.isFinished).toBeUndefined();
    });

    it('should validate empty object', () => {
      const emptyData = {};

      const result = UpdateGameDtoValidator.validate(emptyData);

      expect(result).toEqual({});
    });

    it('should validate with rounds and moves', () => {
      const validData = {
        rounds: [{
          id: 'round-1',
          moves: [{
            id: 'move-1',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten'
          }],
          isFinished: false
        }]
      };

      const result = UpdateGameDtoValidator.validate(validData);

      expect(result.rounds).toHaveLength(1);
      expect(result.rounds![0].id).toBe('round-1');
      expect(result.rounds![0].moves).toHaveLength(1);
    });

    it('should throw ValidationError for invalid type', () => {
      const invalidData = {
        type: ''
      };

      expect(() => UpdateGameDtoValidator.validate(invalidData)).toThrow(ValidationError);
      expect(() => UpdateGameDtoValidator.validate({ type: 'a'.repeat(101) })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid usersIds', () => {
      expect(() => UpdateGameDtoValidator.validate({
        usersIds: []
      })).toThrow(ValidationError);

      expect(() => UpdateGameDtoValidator.validate({
        usersIds: ['user-1', 'user-1']
      })).toThrow(ValidationError);

      expect(() => UpdateGameDtoValidator.validate({
        usersIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10', 'user-11']
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rounds', () => {
      expect(() => UpdateGameDtoValidator.validate({
        rounds: [{
          id: '',
          moves: [],
          isFinished: false
        }]
      })).toThrow(ValidationError);

      expect(() => UpdateGameDtoValidator.validate({
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
      expect(() => UpdateGameDtoValidator.validate({
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

      const result = UpdateGameDtoValidator.validatePartial(partialData);

      expect(result.type).toBe('tournament');
    });

    it('should throw ValidationError for invalid partial data', () => {
      const invalidPartialData = {
        type: ''
      };

      expect(() => UpdateGameDtoValidator.validatePartial(invalidPartialData)).toThrow(ValidationError);
    });
  });
});
