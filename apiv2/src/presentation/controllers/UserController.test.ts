import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserController } from './UserController.js';
import { UserService } from '../../application/services/UserService.js';
import { CreateUserDto } from '../../application/dto/CreateUserDto.js';
import { UpdateUserDto } from '../../application/dto/UpdateUserDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: UserService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockUserService = {
      getUser: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      getUserMetadata: vi.fn().mockResolvedValue({
        etag: '"etag-123"',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      }),
      listUsers: vi.fn()
    } as any;

    mockLogger = new Logger();
    controller = new UserController(mockUserService, mockLogger);
  });

  describe('get', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"etag-123"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.get(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ id: 'user-123', name: 'John Doe', externalId: 1001 });
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['cache-control']).toBe('private, max-age=300');
    });

    it('should pass If-None-Match header', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"etag-123"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: { 'if-none-match': '"etag-123"' },
        query: {},
        body: {}
      };

      await controller.get(request);

      expect(mockUserService.getUser).toHaveBeenCalledWith('user-123', '"etag-123"');
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(mockUserService.getUser).mockRejectedValue(new NotFoundError('User not found'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.get(request);

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'User Not Found',
        status: 404,
        detail: "User 'user-123' not found",
        instance: '/apiv2/internal/users/user-123'
      });
    });
  });

  describe('getMeta', () => {
    it('should return user metadata', async () => {
      const metadata = {
        etag: '"etag-123"',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      };

      vi.mocked(mockUserService.getUserMetadata).mockResolvedValue(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123/meta',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.getMeta(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(metadata);
      expect(response.headers?.['etag']).toBe('"etag-123"');
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(mockUserService.getUserMetadata).mockRejectedValue(new NotFoundError('User not found'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123/meta',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.getMeta(request);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"new-etag"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.createUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/users',
        params: {},
        headers: {},
        query: {},
        body: { id: 'user-123', name: 'John Doe', externalId: 1001 }
      };

      const response = await controller.create(request);

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({ id: 'user-123', name: 'John Doe', externalId: 1001 });
      expect(response.headers?.['location']).toBe('/apiv2/internal/users/user-123');
      expect(response.headers?.['etag']).toBe('"etag-123"');
    });

    it('should pass If-None-Match header for creation', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"new-etag"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.createUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/users',
        params: {},
        headers: { 'if-none-match': '*' },
        query: {},
        body: { id: 'user-123', name: 'John Doe', externalId: 1001 }
      };

      await controller.create(request);

      expect(mockUserService.createUser).toHaveBeenCalledWith(
        expect.any(CreateUserDto),
        '*'
      );
    });

    it('should return 400 for validation errors', async () => {
      // Mock the service to throw a validation error
      vi.mocked(mockUserService.createUser).mockRejectedValue(
        new ValidationError('Invalid user id: invalid id with spaces. Must match pattern ^[a-zA-Z0-9._-]{1,128}$')
      );

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/users',
        params: {},
        headers: {},
        query: {},
        body: { id: 'invalid id with spaces', name: 'John Doe', externalId: 1001 }
      };

      const response = await controller.create(request);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('title', 'Validation Error');
    });
  });

  describe('update', () => {
    it('should update user with replace strategy', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Jane Smith',
        externalId: 2002,
        metadata: { etag: '"updated-etag"' },
        toJSON: () => ({ id: 'user-123', name: 'Jane Smith', externalId: 2002 })
      };

      vi.mocked(mockUserService.updateUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PUT',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: { 'if-match': '"old-etag"' },
        query: {},
        body: { name: 'Jane Smith', externalId: 2002 }
      };

      const response = await controller.update(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ id: 'user-123', name: 'Jane Smith', externalId: 2002 });
      expect(response.headers?.['etag']).toBe('"etag-123"');
      
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ merge: false }),
        '"old-etag"'
      );
    });
  });

  describe('patch', () => {
    it('should update user with merge strategy', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Jane Smith',
        externalId: 1001, // Preserved from original
        metadata: { etag: '"updated-etag"' },
        toJSON: () => ({ id: 'user-123', name: 'Jane Smith', externalId: 1001 })
      };

      vi.mocked(mockUserService.updateUser).mockResolvedValue(mockUser as any);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PATCH',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: { 'if-match': '"old-etag"' },
        query: {},
        body: { name: 'Jane Smith' }
      };

      const response = await controller.patch(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ id: 'user-123', name: 'Jane Smith', externalId: 1001 });
      
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ merge: true }),
        '"old-etag"'
      );
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      vi.mocked(mockUserService.deleteUser).mockResolvedValue();

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'DELETE',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: { 'if-match': '"etag-123"' },
        query: {},
        body: {}
      };

      const response = await controller.delete(request);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
      
      expect(mockUserService.deleteUser).toHaveBeenCalledWith('user-123', '"etag-123"');
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(mockUserService.deleteUser).mockRejectedValue(new NotFoundError('User not found'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'DELETE',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.delete(request);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('list', () => {
    it('should return list of users', async () => {
      const listResult = {
        names: ['user-1', 'user-2'],
        nextCursor: 'next-token'
      };

      vi.mocked(mockUserService.listUsers).mockResolvedValue(listResult);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users',
        params: {},
        headers: {},
        query: { prefix: 'user-', limit: '10' },
        body: {}
      };

      const response = await controller.list(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(listResult);
      expect(response.headers?.['cache-control']).toBe('private, must-revalidate');
      
      expect(mockUserService.listUsers).toHaveBeenCalledWith('user-', 10, undefined);
    });

    it('should handle pagination cursor', async () => {
      const listResult = { names: ['user-3'], nextCursor: undefined };
      vi.mocked(mockUserService.listUsers).mockResolvedValue(listResult);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users',
        params: {},
        headers: {},
        query: { cursor: 'cursor-token' },
        body: {}
      };

      await controller.list(request);

      expect(mockUserService.listUsers).toHaveBeenCalledWith('', undefined, 'cursor-token');
    });
  });

  describe('extractId', () => {
    it('should extract ID from params.id', async () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { id: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"etag"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUser as any);

      await controller.get(request);

      expect(mockUserService.getUser).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should extract ID from params.name (legacy)', async () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { name: 'user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"etag"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUser as any);

      await controller.get(request);

      expect(mockUserService.getUser).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should extract ID from proxy parameter', async () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/user-123',
        params: { proxy: 'users/user-123' },
        headers: {},
        query: {},
        body: {}
      };

      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001,
        metadata: { etag: '"etag"' },
        toJSON: () => ({ id: 'user-123', name: 'John Doe', externalId: 1001 })
      };

      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUser as any);

      await controller.get(request);

      expect(mockUserService.getUser).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should throw ValidationError when no ID found', async () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/users/',
        params: {},
        headers: {},
        query: {},
        body: {}
      };

      await expect(controller.get(request)).rejects.toThrow(ValidationError);
    });
  });
});
