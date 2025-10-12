import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService, IUserRepository } from './UserService.js';
import { User } from '../../domain/entity/User.js';
import { CreateUserDto } from '../dto/CreateUserDto.js';
import { UpdateUserDto } from '../dto/UpdateUserDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError, PreconditionFailedError, NotModifiedError } from '../../shared/errors/index.js';

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: IUserRepository;
  let mockLogger: Logger;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn(),
      getMetadata: vi.fn()
    };
    mockLogger = new Logger();
    userService = new UserService(mockRepository, mockLogger);
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      const user = User.create('user-123', 'John Doe', 1001, 'etag-123');
      vi.mocked(mockRepository.findById).mockResolvedValue(user);

      const result = await userService.getUser('user-123');

      expect(result).toEqual({
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
      expect(mockRepository.findById).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should pass ifNoneMatch header', async () => {
      const user = User.create('user-123', 'John Doe', 1001);
      vi.mocked(mockRepository.findById).mockResolvedValue(user);

      await userService.getUser('user-123', 'etag-123');

      expect(mockRepository.findById).toHaveBeenCalledWith('user-123', 'etag-123');
    });

    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(userService.getUser('user-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const dto = new CreateUserDto('user-123', 'John Doe', 1001);
      const createdUser = User.create('user-123', 'John Doe', 1001, 'new-etag');
      vi.mocked(mockRepository.save).mockResolvedValue(createdUser);

      const result = await userService.createUser(dto);

      expect(result).toEqual({
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123', name: 'John Doe', externalId: 1001 }),
        { ifNoneMatch: undefined }
      );
    });

    it('should pass ifNoneMatch header for creation', async () => {
      const dto = new CreateUserDto('user-123', 'John Doe', 1001);
      const createdUser = User.create('user-123', 'John Doe', 1001, 'new-etag');
      vi.mocked(mockRepository.save).mockResolvedValue(createdUser);

      await userService.createUser(dto, '*');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(User),
        { ifNoneMatch: '*' }
      );
    });
  });

  describe('updateUser', () => {
    it('should update user with replace strategy', async () => {
      const existingUser = User.create('user-123', 'John Doe', 1001, 'old-etag');
      const updatedUser = User.create('user-123', 'Jane Smith', 2002, 'new-etag');
      const dto = new UpdateUserDto({ name: 'Jane Smith', externalId: 2002 }, false);

      vi.mocked(mockRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockRepository.save).mockResolvedValue(updatedUser);

      const result = await userService.updateUser('user-123', dto);

      expect(result).toEqual({
        id: 'user-123',
        name: 'Jane Smith',
        externalId: 2002
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123', name: 'Jane Smith', externalId: 2002 }),
        { ifMatch: undefined }
      );
    });

    it('should update user with merge strategy', async () => {
      const existingUser = User.create('user-123', 'John Doe', 1001, 'old-etag');
      const mergedUser = existingUser.merge({ name: 'Jane Smith' });
      const dto = new UpdateUserDto({ name: 'Jane Smith' }, true);

      vi.mocked(mockRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockRepository.save).mockResolvedValue(mergedUser);

      const result = await userService.updateUser('user-123', dto);

      expect(result.name).toBe('Jane Smith');
      expect(result.externalId).toBe(1001); // Should preserve existing value
    });

    it('should throw NotFoundError when user not found', async () => {
      const dto = new UpdateUserDto({ name: 'Jane Smith' }, false);
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(userService.updateUser('user-123', dto)).rejects.toThrow(NotFoundError);
    });

    it('should pass ifMatch header for updates', async () => {
      const existingUser = User.create('user-123', 'John Doe', 1001, 'old-etag');
      const dto = new UpdateUserDto({ name: 'Jane Smith' }, false);

      vi.mocked(mockRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(mockRepository.save).mockResolvedValue(existingUser);

      await userService.updateUser('user-123', dto, 'old-etag');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(User),
        { ifMatch: 'old-etag' }
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue();

      await userService.deleteUser('user-123');

      expect(mockRepository.delete).toHaveBeenCalledWith('user-123', { ifMatch: undefined });
    });

    it('should pass ifMatch header for deletion', async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue();

      await userService.deleteUser('user-123', 'etag-123');

      expect(mockRepository.delete).toHaveBeenCalledWith('user-123', { ifMatch: 'etag-123' });
    });
  });

  describe('getUserMetadata', () => {
    it('should return user metadata', async () => {
      const metadata = {
        etag: 'etag-123',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      };
      vi.mocked(mockRepository.getMetadata).mockResolvedValue(metadata);

      const result = await userService.getUserMetadata('user-123');

      expect(result).toEqual(metadata);
      expect(mockRepository.getMetadata).toHaveBeenCalledWith('user-123');
    });
  });

  describe('listUsers', () => {
    it('should return list of user IDs', async () => {
      const users = [
        User.create('user-1', 'John Doe', 1001),
        User.create('user-2', 'Jane Smith', 1002)
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue({
        items: users,
        nextCursor: 'next-cursor'
      });

      const result = await userService.listUsers();

      expect(result).toEqual({
        names: ['user-1', 'user-2'],
        nextCursor: 'next-cursor'
      });
    });

    it('should pass pagination parameters', async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue({
        items: [],
        nextCursor: undefined
      });

      await userService.listUsers('user-', 10, 'cursor-123');

      expect(mockRepository.findAll).toHaveBeenCalledWith('user-', 10, 'cursor-123');
    });
  });
});
