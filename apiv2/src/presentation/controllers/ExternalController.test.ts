import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExternalController } from './ExternalController.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { NotFoundError } from '../../shared/errors/index.js';

describe('ExternalController', () => {
  let controller: ExternalController;
  let mockUserService: UserService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockUserService = {
      getUser: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setContext: vi.fn(),
      clearContext: vi.fn(),
    } as any;

    controller = new ExternalController(mockUserService, mockLogger);
  });

  describe('getMe', () => {
      it('should return user profile for authenticated user', async () => {
        const userId = 'cognito-user-123';
        const mockUserDto = {
          id: userId,
          name: 'John Doe',
          externalId: 12345,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          toJSON: () => ({
            id: userId,
            name: 'John Doe',
            externalId: 12345,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          })
        };
        
        vi.mocked(mockUserService.getUser).mockResolvedValue(mockUserDto as any);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'john@example.com',
          role: 'user',
          groups: ['user']
        }
      };

      const response = await controller.getMe(request);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(mockUserDto.toJSON());
        expect(mockUserService.getUser).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user ID not in request', async () => {
      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: undefined // No user in request
      };

      await expect(controller.getMe(request)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user entity not in database', async () => {
      const userId = 'cognito-user-999';
      
      vi.mocked(mockUserService.getUser).mockRejectedValue(new Error('User not found'));

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'unknown@example.com',
          role: 'user',
          groups: ['user']
        }
      };

      await expect(controller.getMe(request)).rejects.toThrow();
    });

    it('should work for admin user', async () => {
      const userId = 'cognito-admin-123';
      const mockUserDto = {
        id: userId,
        name: 'Admin User',
        externalId: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        toJSON: () => ({
          id: userId,
          name: 'Admin User',
          externalId: 1,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z'
        })
      };
      
      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUserDto as any);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'admin@example.com',
          role: 'admin',
          groups: ['admin']
        }
      };

      const response = await controller.getMe(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockUserDto.toJSON());
    });

    it('should work for guest user', async () => {
      const userId = 'cognito-guest-123';
      const mockUserDto = {
        id: userId,
        name: 'Guest User',
        externalId: 999,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        toJSON: () => ({
          id: userId,
          name: 'Guest User',
          externalId: 999,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z'
        })
      };
      
      vi.mocked(mockUserService.getUser).mockResolvedValue(mockUserDto as any);

      const request: HttpRequest = {
        method: 'GET',
        path: '/apiv2/external/me',
        headers: {},
        query: {},
        params: {},
        body: null,
        requestId: 'test-request-id',
        user: {
          userId: userId,
          email: 'guest@example.com',
          role: 'guest',
          groups: ['guest']
        }
      };

      const response = await controller.getMe(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockUserDto.toJSON());
    });
  });
});

