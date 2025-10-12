import { describe, it, expect } from 'vitest';
import { User } from './User.js';
import { JsonEntity } from './JsonEntity.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { EntityMetadata } from '../../shared/types/common.js';

describe('User Entity', () => {
  describe('Creation', () => {
    it('should create a valid user', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      expect(user.id).toBe('user-123');
      expect(user.name).toBe('John Doe');
      expect(user.externalId).toBe(1001);
      
      // Test internal backing store (for persistence layer)
      const backingStore = user.internalGetBackingStore();
      expect(backingStore).toBeInstanceOf(JsonEntity);
      expect(backingStore.id).toBe('user-123');
      expect(backingStore.data).toEqual({ name: 'John Doe', externalId: 1001 });
    });

    it('should create user with metadata', () => {
      const metadata: EntityMetadata = {
        etag: 'etag-123',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      };
      
      const user = User.create('user-456', 'Jane Smith', 2002, 'etag-123', metadata);
      
      expect(user.id).toBe('user-456');
      expect(user.name).toBe('Jane Smith');
      expect(user.externalId).toBe(2002);
      expect(user.metadata).toEqual(metadata);
    });

    it('should create user with constructor', () => {
      const user = new User('user-456', 'Jane Smith', 2002);
      
      expect(user.id).toBe('user-456');
      expect(user.name).toBe('Jane Smith');
      expect(user.externalId).toBe(2002);
      
      // Test internal backing store
      const backingStore = user.internalGetBackingStore();
      expect(backingStore).toBeInstanceOf(JsonEntity);
      expect(backingStore.id).toBe('user-456');
      expect(backingStore.data).toEqual({ name: 'Jane Smith', externalId: 2002 });
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
      expect(updated.internalGetBackingStore().data).toEqual({ name: 'John Smith', externalId: 1001 });
    });

    it('should preserve metadata during updates', () => {
      const metadata: EntityMetadata = {
        etag: 'etag-123',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      };
      
      const user = User.create('user-123', 'John Doe', 1001, 'etag-123', metadata);
      const updated = user.updateName('John Smith');
      
      expect(updated.name).toBe('John Smith');
      expect(updated.metadata).toEqual(metadata); // Metadata preserved
      expect(updated.internalGetBackingStore().etag).toBe('etag-123'); // ETag preserved
    });

    it('should update externalId', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const updated = user.updateExternalId(2002);
      
      expect(updated.externalId).toBe(2002);
      expect(updated.name).toBe('John Doe'); // Unchanged
      expect(updated.id).toBe('user-123'); // Unchanged
      expect(updated.internalGetBackingStore().data).toEqual({ name: 'John Doe', externalId: 2002 });
    });

    it('should create user from backing store', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const newBacked = new JsonEntity('user-123', { name: 'Updated Backed', externalId: 9999 });
      const updated = user.internalCreateFromBackingStore(newBacked);
      
      expect(updated.internalGetBackingStore().data).toEqual({ name: 'Updated Backed', externalId: 9999 });
      expect(updated.name).toBe('Updated Backed');
      expect(updated.externalId).toBe(9999);
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

    it('should merge fields', () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const merged = user.merge({ name: 'Merged Name' });
      
      expect(merged.name).toBe('Merged Name');
      expect(merged.externalId).toBe(1001); // Unchanged
      expect(merged.id).toBe('user-123'); // Unchanged
      expect(merged.internalGetBackingStore().data).toEqual({ name: 'Merged Name', externalId: 1001 });
    });

    it('should preserve metadata during merge', () => {
      const metadata: EntityMetadata = {
        etag: 'etag-456',
        size: 2048,
        lastModified: '2023-02-01T00:00:00Z'
      };
      
      const user = User.create('user-123', 'John Doe', 1001, 'etag-456', metadata);
      const merged = user.merge({ externalId: 9999 });
      
      expect(merged.name).toBe('John Doe'); // Unchanged
      expect(merged.externalId).toBe(9999); // Updated
      expect(merged.metadata).toEqual(metadata); // Metadata preserved
      expect(merged.internalGetBackingStore().etag).toBe('etag-456'); // ETag preserved
    });
  });
});
