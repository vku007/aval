import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { S3UserRepository } from './S3UserRepository.js';
import { User } from '../../domain/entity/User.js';
import { NotFoundError, ConflictError, PreconditionFailedError, NotModifiedError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';

// Mock the S3Client
vi.mock('@aws-sdk/client-s3');

describe('S3UserRepository', () => {
  let repository: S3UserRepository;
  let mockS3Client: any;
  let mockConfig: AppConfig;
  let userFactory: (id: string, name: string, externalId: number, etag?: string, metadata?: any) => User;

  beforeEach(() => {
    mockS3Client = {
      send: vi.fn()
    };
    
    mockConfig = {
      s3: {
        bucket: 'test-bucket',
        prefix: 'test/'
      },
      aws: {
        region: 'us-east-1'
      },
      cors: {
        allowedOrigin: 'https://test.com'
      }
    };

    userFactory = (id: string, name: string, externalId: number, etag?: string, metadata?: any) => 
      User.create(id, name, externalId, etag, metadata);

    repository = new S3UserRepository(mockS3Client, mockConfig, userFactory);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockResponse = {
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            if (event === 'end') callback();
          })
        },
        ETag: '"etag-123"',
        ContentLength: 50,
        LastModified: new Date('2023-01-01T00:00:00Z')
      };

      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      const result = await repository.findById('user-123');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-123');
      expect(result?.name).toBe('John Doe');
      expect(result?.externalId).toBe(1001);
      expect(result?.metadata?.etag).toBe('"etag-123"');
    });

    it('should return null when user not found', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      vi.mocked(mockS3Client.send).mockRejectedValue(error);

      const result = await repository.findById('user-123');

      expect(result).toBeNull();
    });

    it('should throw NotModifiedError when If-None-Match matches', async () => {
      const mockResponse = {
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            if (event === 'end') callback();
          })
        },
        ETag: '"etag-123"'
      };

      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      await expect(repository.findById('user-123', '"etag-123"')).rejects.toThrow(NotModifiedError);
    });
  });

  describe('save', () => {
    it('should save user successfully', async () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const mockResponse = {
        ETag: '"new-etag"'
      };

      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      const result = await repository.save(user);

      expect(result.id).toBe('user-123');
      expect(result.metadata?.etag).toBe('"new-etag"');
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should handle ETag preconditions on save', async () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      // Mock S3 GetObject response for findById call in checkPreconditions
      vi.mocked(mockS3Client.send).mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') callback(Buffer.from(JSON.stringify({ name: 'Old Name', externalId: 1001 })));
            if (event === 'end') callback();
          })
        },
        ETag: '"old-etag"'
      });
      
      // Mock S3 PutObject response for save operation
      const mockResponse = { ETag: '"new-etag"' };
      vi.mocked(mockS3Client.send).mockResolvedValueOnce(mockResponse);

      const result = await repository.save(user, { ifMatch: '"old-etag"' });

      expect(result.id).toBe('user-123');
      expect(result.metadata?.etag).toBe('"new-etag"');
      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictError when creating existing user with If-None-Match: *', async () => {
      const user = User.create('user-123', 'John Doe', 1001);
      
      // Mock existing user
      const existingUser = User.create('user-123', 'Existing', 1001, '"existing-etag"');
      repository.findById = vi.fn().mockResolvedValue(existingUser);

      await expect(repository.save(user, { ifNoneMatch: '*' })).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      vi.mocked(mockS3Client.send).mockResolvedValue({});

      await repository.delete('user-123');

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when deleting non-existent user', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      vi.mocked(mockS3Client.send).mockRejectedValue(error);

      await expect(repository.delete('user-123')).rejects.toThrow(NotFoundError);
    });

    it('should check ETag precondition before deletion', async () => {
      // Mock S3 GetObject response for findById call in checkPreconditions
      vi.mocked(mockS3Client.send).mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            if (event === 'end') callback();
          })
        },
        ETag: '"etag-123"'
      });
      
      // Mock S3 DeleteObject response
      vi.mocked(mockS3Client.send).mockResolvedValueOnce({});

      await repository.delete('user-123', { ifMatch: '"etag-123"' });

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
    });

    it('should throw PreconditionFailedError on ETag mismatch', async () => {
      const existingUser = User.create('user-123', 'John Doe', 1001, '"etag-123"');
      repository.findById = vi.fn().mockResolvedValue(existingUser);

      await expect(repository.delete('user-123', { ifMatch: '"wrong-etag"' })).rejects.toThrow(PreconditionFailedError);
    });
  });

  describe('findAll', () => {
    it('should return list of users', async () => {
      const mockResponse = {
        Contents: [
          { Key: 'test/users/user-1.json', Size: 50, LastModified: new Date('2023-01-01T00:00:00Z') },
          { Key: 'test/users/user-2.json', Size: 60, LastModified: new Date('2023-01-01T00:00:00Z') }
        ],
        NextContinuationToken: 'next-token'
      };

      // Mock S3 ListObjectsV2 response only (no additional HeadObject calls needed)
      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      const result = await repository.findAll();

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('user-1');
      expect(result.items[1].id).toBe('user-2');
      expect(result.nextCursor).toBe('next-token');
      expect(mockS3Client.send).toHaveBeenCalledTimes(1); // Only ListObjectsV2 call
    });

    it('should handle empty results', async () => {
      const mockResponse = { Contents: undefined };
      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      const result = await repository.findAll();

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockS3Client.send).mockRejectedValue(new Error('S3 Error'));

      const result = await repository.findAll();

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should return user metadata', async () => {
      const mockResponse = {
        ETag: '"etag-123"',
        ContentLength: 1024,
        LastModified: new Date('2023-01-01T00:00:00Z')
      };

      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      const result = await repository.getMetadata('user-123');

      expect(result).toEqual({
        etag: '"etag-123"',
        size: 1024,
        lastModified: '2023-01-01T00:00:00.000Z'
      });
    });

    it('should throw NotFoundError when user not found', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      vi.mocked(mockS3Client.send).mockRejectedValue(error);

      await expect(repository.getMetadata('user-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('keyFor', () => {
    it('should generate correct S3 key', async () => {
      const user = User.create('user-123', 'John Doe', 1001);
      const mockResponse = { ETag: '"etag"' };
      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      await repository.save(user);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should handle URL encoding in keys', async () => {
      const user = User.create('user-with-dashes', 'John Doe', 1001);
      const mockResponse = { ETag: '"etag"' };
      vi.mocked(mockS3Client.send).mockResolvedValue(mockResponse);

      await repository.save(user);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });
  });
});
