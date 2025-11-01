import { describe, it, expect } from 'vitest';
import { UserProfile } from './UserProfile.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('UserProfile', () => {
  describe('constructor', () => {
    it('should create a user profile with valid data', () => {
      const profile = new UserProfile('user-1', 'John Doe', 123);
      
      expect(profile.id).toBe('user-1');
      expect(profile.name).toBe('John Doe');
      expect(profile.externalId).toBe(123);
    });

    it('should throw error for invalid ID', () => {
      expect(() => new UserProfile('', 'John', 123)).toThrow('User ID');
      expect(() => new UserProfile('invalid@id', 'John', 123)).toThrow('Invalid user id');
    });

    it('should throw error for invalid name', () => {
      expect(() => new UserProfile('user-1', '', 123)).toThrow('User name');
      expect(() => new UserProfile('user-1', 'J', 123)).toThrow('User name must be between 2 and 100 characters');
      expect(() => new UserProfile('user-1', 'a'.repeat(101), 123)).toThrow('User name must be between 2 and 100 characters');
    });

    it('should throw error for invalid external ID', () => {
      expect(() => new UserProfile('user-1', 'John', 0)).toThrow('External ID must be a positive integer');
      expect(() => new UserProfile('user-1', 'John', -1)).toThrow('External ID must be a positive integer');
      expect(() => new UserProfile('user-1', 'John', 1.5)).toThrow('External ID must be an integer');
    });
  });

  describe('updateName', () => {
    it('should update name immutably', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.updateName('Jane');
      
      expect(profile1.name).toBe('John'); // Original unchanged
      expect(profile2.name).toBe('Jane'); // New instance updated
      expect(profile2.id).toBe('user-1');
      expect(profile2.externalId).toBe(123);
    });

    it('should validate new name', () => {
      const profile = new UserProfile('user-1', 'John', 123);
      expect(() => profile.updateName('')).toThrow('User name');
      expect(() => profile.updateName('J')).toThrow('User name must be between 2 and 100 characters');
    });
  });

  describe('updateExternalId', () => {
    it('should update external ID immutably', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.updateExternalId(456);
      
      expect(profile1.externalId).toBe(123); // Original unchanged
      expect(profile2.externalId).toBe(456); // New instance updated
      expect(profile2.id).toBe('user-1');
      expect(profile2.name).toBe('John');
    });

    it('should validate new external ID', () => {
      const profile = new UserProfile('user-1', 'John', 123);
      expect(() => profile.updateExternalId(0)).toThrow('External ID must be a positive integer');
      expect(() => profile.updateExternalId(-1)).toThrow('External ID must be a positive integer');
    });
  });

  describe('merge', () => {
    it('should merge partial updates', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.merge({ name: 'Jane' });
      
      expect(profile2.name).toBe('Jane');
      expect(profile2.externalId).toBe(123);
    });

    it('should merge external ID only', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.merge({ externalId: 456 });
      
      expect(profile2.name).toBe('John');
      expect(profile2.externalId).toBe(456);
    });

    it('should merge both fields', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.merge({ name: 'Jane', externalId: 456 });
      
      expect(profile2.name).toBe('Jane');
      expect(profile2.externalId).toBe(456);
    });

    it('should validate merged values', () => {
      const profile = new UserProfile('user-1', 'John', 123);
      expect(() => profile.merge({ name: 'J' })).toThrow('User name must be between 2 and 100 characters');
      expect(() => profile.merge({ externalId: 0 })).toThrow('External ID must be a positive integer');
    });
  });

  describe('hasName', () => {
    it('should check name case-insensitively', () => {
      const profile = new UserProfile('user-1', 'John Doe', 123);
      
      expect(profile.hasName('John Doe')).toBe(true);
      expect(profile.hasName('john doe')).toBe(true);
      expect(profile.hasName('JOHN DOE')).toBe(true);
      expect(profile.hasName('Jane')).toBe(false);
    });
  });

  describe('hasExternalId', () => {
    it('should check external ID', () => {
      const profile = new UserProfile('user-1', 'John', 123);
      
      expect(profile.hasExternalId(123)).toBe(true);
      expect(profile.hasExternalId(456)).toBe(false);
    });
  });

  describe('getDisplayName', () => {
    it('should return display name', () => {
      const profile = new UserProfile('user-1', 'John Doe', 123);
      expect(profile.getDisplayName()).toBe('John Doe');
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const profile = new UserProfile('user-1', 'John', 123);
      const json = profile.toJSON();
      
      expect(json).toEqual({
        id: 'user-1',
        name: 'John',
        externalId: 123
      });
    });
  });

  describe('fromJSON', () => {
    it('should create from valid JSON', () => {
      const json = {
        id: 'user-1',
        name: 'John',
        externalId: 123
      };
      
      const profile = UserProfile.fromJSON(json);
      
      expect(profile.id).toBe('user-1');
      expect(profile.name).toBe('John');
      expect(profile.externalId).toBe(123);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => UserProfile.fromJSON(null)).toThrow('Invalid user profile data');
      expect(() => UserProfile.fromJSON({})).toThrow('User profile ID is required');
      expect(() => UserProfile.fromJSON({ id: 'user-1' })).toThrow('User profile name is required');
      expect(() => UserProfile.fromJSON({ id: 'user-1', name: 'John' })).toThrow('User profile externalId must be a number');
    });
  });

  describe('immutability', () => {
    it('should maintain immutability across all operations', () => {
      const profile1 = new UserProfile('user-1', 'John', 123);
      const profile2 = profile1.updateName('Jane');
      const profile3 = profile1.updateExternalId(456);
      const profile4 = profile1.merge({ name: 'Bob', externalId: 789 });
      
      // Original should remain unchanged
      expect(profile1.name).toBe('John');
      expect(profile1.externalId).toBe(123);
      
      // Each operation creates a new instance
      expect(profile2.name).toBe('Jane');
      expect(profile2.externalId).toBe(123);
      
      expect(profile3.name).toBe('John');
      expect(profile3.externalId).toBe(456);
      
      expect(profile4.name).toBe('Bob');
      expect(profile4.externalId).toBe(789);
    });
  });
});

