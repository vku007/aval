import { describe, it, expect } from 'vitest';
import { User } from './User.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('User Entity', () => {
  describe('Creation', () => {
    it('should create a valid user', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      expect(user.id).toBe('user-123');
      expect(user.name).toBe('John Doe');
      expect(user.externalId).toBe(1001);
    });

    it('should create user with constructor', () => {
      const user = new User('user-456', 'Jane Smith', 2002);
      
      expect(user.id).toBe('user-456');
      expect(user.name).toBe('Jane Smith');
      expect(user.externalId).toBe(2002);
    });
  });

  describe('Validation', () => {
    it('should throw error for empty name', () => {
      expect(() => {
        User.create('user-123', '', 1001);
      }).toThrow(ValidationError);
    });

    it('should throw error for name too short', () => {
      expect(() => {
        User.create('user-123', 'A', 1001);
      }).toThrow('User name must be between 2 and 100 characters');
    });

    it('should throw error for name too long', () => {
      const longName = 'A'.repeat(101);
      expect(() => {
        User.create('user-123', longName, 1001);
      }).toThrow('User name must be between 2 and 100 characters');
    });

    it('should throw error for non-integer externalId', () => {
      expect(() => {
        User.create('user-123', 'John Doe', 1.5);
      }).toThrow('External ID must be an integer');
    });

    it('should throw error for negative externalId', () => {
      expect(() => {
        User.create('user-123', 'John Doe', -1);
      }).toThrow('External ID must be a positive integer');
    });

    it('should throw error for zero externalId', () => {
      expect(() => {
        User.create('user-123', 'John Doe', 0);
      }).toThrow('External ID must be a positive integer');
    });

    it('should accept valid name length', () => {
      const user = User.create('user-123', 'Jo', 1001); // 2 characters
      expect(user.name).toBe('Jo');
    });
  });

  describe('Updates', () => {
    it('should update name', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const updated = user.updateName('John Smith');
      
      expect(updated.name).toBe('John Smith');
      expect(updated.externalId).toBe(1001); // Unchanged
      expect(updated.id).toBe('user-123'); // Unchanged
    });

    it('should update externalId', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const updated = user.updateExternalId(2002);
      
      expect(updated.externalId).toBe(2002);
      expect(updated.name).toBe('John Doe'); // Unchanged
      expect(updated.id).toBe('user-123'); // Unchanged
    });

    it('should validate updated name', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      expect(() => {
        user.updateName('A'); // Too short
      }).toThrow('User name must be between 2 and 100 characters');
    });

    it('should validate updated externalId', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      expect(() => {
        user.updateExternalId(-1); // Negative
      }).toThrow('External ID must be a positive integer');
    });
  });

  describe('Entity Methods', () => {
    it('should have entity methods', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      // Should have entity methods
      expect(typeof user.merge).toBe('function');
      expect(typeof user.toJSON).toBe('function');
    });

    it('should validate ID format', () => {
      expect(() => {
        User.create('invalid id with spaces', 'John Doe', 1001);
      }).toThrow('Invalid user id: invalid id with spaces. Must match pattern ^[a-zA-Z0-9._-]{1,128}$');
    });

    it('should serialize to JSON correctly', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const json = user.toJSON();
      
      expect(json).toEqual({
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
    });
  });
});
