import { describe, it, expect } from 'vitest';
import { CreateUserDto } from './CreateUserDto.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('CreateUserDto', () => {
  describe('Creation', () => {
    it('should create a valid DTO', () => {
      const dto = new CreateUserDto('user-123', 'John Doe', 1001);
      
      expect(dto.id).toBe('user-123');
      expect(dto.name).toBe('John Doe');
      expect(dto.externalId).toBe(1001);
    });

    it('should create DTO from request', () => {
      const requestBody = {
        id: 'user-456',
        name: 'Jane Smith',
        externalId: 2002
      };
      
      const dto = CreateUserDto.fromRequest(requestBody);
      
      expect(dto.id).toBe('user-456');
      expect(dto.name).toBe('Jane Smith');
      expect(dto.externalId).toBe(2002);
    });

    it('should convert to User entity', () => {
      const dto = new CreateUserDto('user-123', 'John Doe', 1001);
      const user = dto.toUser();
      
      expect(user.id).toBe('user-123');
      expect(user.name).toBe('John Doe');
      expect(user.externalId).toBe(1001);
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid request body', () => {
      expect(() => {
        CreateUserDto.fromRequest(null);
      }).toThrow('Request body must be an object');
    });

    it('should throw error for missing id', () => {
      const requestBody = {
        name: 'John Doe',
        externalId: 1001
      };
      
      expect(() => {
        CreateUserDto.fromRequest(requestBody);
      }).toThrow('Field "id" is required and must be a string');
    });

    it('should throw error for missing name', () => {
      const requestBody = {
        id: 'user-123',
        externalId: 1001
      };
      
      expect(() => {
        CreateUserDto.fromRequest(requestBody);
      }).toThrow('Field "name" is required and must be a string');
    });

    it('should throw error for missing externalId', () => {
      const requestBody = {
        id: 'user-123',
        name: 'John Doe'
      };
      
      expect(() => {
        CreateUserDto.fromRequest(requestBody);
      }).toThrow('Field "externalId" is required and must be an integer');
    });

    it('should throw error for invalid externalId type', () => {
      const requestBody = {
        id: 'user-123',
        name: 'John Doe',
        externalId: '1001' // string instead of number
      };
      
      expect(() => {
        CreateUserDto.fromRequest(requestBody);
      }).toThrow('Field "externalId" is required and must be an integer');
    });

    it('should throw error for invalid externalId (float)', () => {
      const requestBody = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001.5
      };
      
      expect(() => {
        CreateUserDto.fromRequest(requestBody);
      }).toThrow('Field "externalId" is required and must be an integer');
    });
  });
});
