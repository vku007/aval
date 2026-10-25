import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExternalController } from './ExternalController.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { GameProcessorService } from '../../application/services/GameProcessorService.js';
import { CreateGameResponse } from '../../application/dto/processor/CreateGameResponse.js';
import { GameResponse } from '../../application/dto/processor/response/GameResponse.js';
import { GameResponsePayload } from '../../application/dto/processor/response/payload/GameResponsePayload.js';
import { GameContext } from '../../application/dto/processor/response/context/GameContext.js';
import { PlayerContext } from '../../application/dto/processor/response/context/PlayerContext.js';
import { EnemyContext } from '../../application/dto/processor/response/context/EnemyContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
import { CreateGameRequest } from '../../application/dto/processor/CreateGameRequest.js';

describe('ExternalController', () => {
  let controller: ExternalController;
  let mockUserService: UserService;
  let mockLogger: Logger;
  let mockGameProcessorService: GameProcessorService;

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

    mockGameProcessorService = {
      createGame: vi.fn(),
      getGame: vi.fn(),
      updateGame: vi.fn(),
    } as any;

    controller = new ExternalController(mockUserService, mockLogger, mockGameProcessorService);
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

  describe('games', () => {
    const userId = 'player-1';

    function authed(body: unknown, params: Record<string, string> = {}): HttpRequest {
      return {
        method: 'POST',
        path: '/apiv2/external/games',
        headers: {},
        query: {},
        params,
        body,
        requestId: 'test-request-id',
        user: {
          userId,
          email: 'player@example.com',
          role: 'user',
          groups: ['user']
        }
      };
    }

    const createBody = {
      gameType: 'PVE',
      rounds: 'BO1',
      kind: 'classic',
      level: { name: '1' },
      episode: { name: 'intro' }
    };

    it('should pass caller inventories into create and omit them from the response', async () => {
      vi.mocked(mockGameProcessorService.createGame).mockResolvedValue(
        new CreateGameResponse('created', 'game-1')
      );
      const inventory = new GamePlayerInventory(
        userId,
        { ...GamePlayerInventory.defaultFor(userId, 5).items, stones: 4 },
        GamePlayerInventory.defaultFor(userId, 5).currencies,
        5
      );

      const response = await controller.createGame(authed({
        ...createBody,
        inventories: [inventory.toJSON()]
      }));

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ status: 'created', gameId: 'game-1' });
      const request = vi.mocked(mockGameProcessorService.createGame).mock.calls[0][0] as CreateGameRequest;
      expect(request.inventories?.[0].items.stones).toBe(4);
      expect(request.inventories).toHaveLength(1);
    });

    it('should reject an inventory user who is not the caller or NPC_1', async () => {
      const inventory = GamePlayerInventory.defaultFor('other-user', 1);
      await expect(controller.createGame(authed({
        ...createBody,
        inventories: [inventory.toJSON()]
      }))).rejects.toThrow(ValidationError);
      expect(mockGameProcessorService.createGame).not.toHaveBeenCalled();
    });

    it('should return only the caller inventory on get', async () => {
      const inventory = GamePlayerInventory.defaultFor(userId, 8);
      vi.mocked(mockGameProcessorService.getGame).mockResolvedValue(
        new GameResponse(
          'success',
          new GameResponsePayload(
            new GameContext(GameStatus.Created),
            new PlayerContext([], inventory),
            new EnemyContext()
          )
        )
      );

      const response = await controller.getGame(authed(null, { gameId: 'game-1' }));

      expect(response.statusCode).toBe(200);
      expect((response.body as { payload: { playerContext: { inventory: unknown } } }).payload.playerContext.inventory)
        .toEqual(inventory.toJSON());
    });
  });
});

