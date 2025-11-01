import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from './GameController.js';
import { GameService } from '../../application/services/GameService.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

// Mock GameService
const mockGameService = {
  getGame: vi.fn(),
  createGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
  getGameMetadata: vi.fn(),
  listGames: vi.fn(),
  addRoundToGame: vi.fn(),
  addMoveToGameRound: vi.fn(),
  finishGameRound: vi.fn(),
  finishGame: vi.fn()
};

// Mock Logger
const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
};

describe('GameController', () => {
  let gameController: GameController;

  beforeEach(() => {
    vi.clearAllMocks();
    gameController = new GameController(mockGameService as any, mockLogger as any);
  });

  describe('get', () => {
    it('should return game when found', async () => {
      const gameDto = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false,
        toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [], isFinished: false })
      };
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.getGame.mockResolvedValueOnce(gameDto);
      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const response = await gameController.get(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['cache-control']).toBe('private, must-revalidate');
      expect(mockGameService.getGame).toHaveBeenCalledWith('game-1', undefined);
    });

    it('should pass ifNoneMatch header', async () => {
      const gameDto = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false,
        toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [], isFinished: false })
      };
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.getGame.mockResolvedValueOnce(gameDto);
      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: { 'if-none-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      await gameController.get(request);

      expect(mockGameService.getGame).toHaveBeenCalledWith('game-1', 'etag-123');
    });

    it('should return 404 when game not found', async () => {
      mockGameService.getGame.mockRejectedValueOnce(new NotFoundError('Game not found'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const response = await gameController.get(request);

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Game Not Found',
        status: 404,
        detail: "Game 'game-1' not found",
        instance: '/apiv2/internal/games/game-1'
      });
    });
  });

  describe('getMeta', () => {
    it('should return game metadata', async () => {
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1/meta',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const response = await gameController.getMeta(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['cache-control']).toBe('private, must-revalidate');
      expect(mockGameService.getGameMetadata).toHaveBeenCalledWith('game-1');
    });
  });

  describe('create', () => {
    it('should create game successfully', async () => {
      const gameDto = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false,
        toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [], isFinished: false })
      };
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.createGame.mockResolvedValueOnce(gameDto);
      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/games',
        headers: {},
        query: {},
        params: {},
        body: {
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [],
          isFinished: false
        }
      };

      const response = await gameController.create(request);

      expect(response.statusCode).toBe(201);
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['location']).toBe('/apiv2/internal/games/game-1');
      expect(mockGameService.createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [],
          isFinished: false
        }),
        undefined
      );
    });

    it('should return 400 for validation error', async () => {
      mockGameService.createGame.mockRejectedValueOnce(new ValidationError('Invalid game data'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/games',
        headers: {},
        query: {},
        params: {},
        body: { invalid: 'data' }
      };

      const response = await gameController.create(request);

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Validation Error',
        status: 400,
        detail: 'Validation failed: id: Required, type: Required, usersIds: Required',
        instance: '/apiv2/internal/games',
        field: undefined
      });
    });
  });

  describe('update', () => {
    it('should update game successfully', async () => {
      const gameDto = {
        id: 'game-1',
        type: 'championship',
        usersIds: ['user-1', 'user-2'],
        rounds: [],
        isFinished: false,
        toJSON: () => ({ id: 'game-1', type: 'championship', usersIds: ['user-1', 'user-2'], rounds: [], isFinished: false })
      };
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.updateGame.mockResolvedValueOnce(gameDto);
      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PUT',
        path: '/apiv2/internal/games/game-1',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: {
          type: 'championship',
          usersIds: ['user-1', 'user-2'],
          rounds: [],
          isFinished: false
        }
      };

      const response = await gameController.update(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(mockGameService.updateGame).toHaveBeenCalledWith('game-1', expect.any(Object), false, 'etag-123');
    });
  });

  describe('patch', () => {
    it('should patch game successfully', async () => {
      const gameDto = {
        id: 'game-1',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: true,
        toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [], isFinished: true })
      };
      const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

      mockGameService.updateGame.mockResolvedValueOnce(gameDto);
      mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PATCH',
        path: '/apiv2/internal/games/game-1',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: {
          isFinished: true
        }
      };

      const response = await gameController.patch(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(mockGameService.updateGame).toHaveBeenCalledWith('game-1', expect.any(Object), true, 'etag-123');
    });
  });

  describe('delete', () => {
    it('should delete game successfully', async () => {
      mockGameService.deleteGame.mockResolvedValueOnce(undefined);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'DELETE',
        path: '/apiv2/internal/games/game-1',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const response = await gameController.delete(request);

      expect(response.statusCode).toBe(204);
      expect(mockGameService.deleteGame).toHaveBeenCalledWith('game-1', 'etag-123');
    });
  });

  describe('list', () => {
    it('should return list of games', async () => {
      const result = {
        names: ['game-1', 'game-2'],
        nextCursor: undefined
      };

      mockGameService.listGames.mockResolvedValueOnce(result);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games',
        headers: {},
        query: {},
        params: {},
        body: null
      };

      const response = await gameController.list(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['cache-control']).toBe('private, must-revalidate');
      expect(mockGameService.listGames).toHaveBeenCalledWith('', undefined, undefined);
    });

    it('should pass pagination parameters', async () => {
      const result = {
        names: [],
        nextCursor: 'next-cursor'
      };

      mockGameService.listGames.mockResolvedValueOnce(result);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games',
        headers: {},
        query: { prefix: 'game-', limit: '10', cursor: 'cursor-123' },
        params: {},
        body: null
      };

      await gameController.list(request);

      expect(mockGameService.listGames).toHaveBeenCalledWith('game-', 10, 'cursor-123');
    });
  });

  describe('game-specific operations', () => {
    describe('addRound', () => {
      it('should add round to game successfully', async () => {
        const gameDto = {
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [{ id: 'round-1', moves: [], isFinished: false }],
          isFinished: false,
          toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [{ id: 'round-1', moves: [], isFinished: false }], isFinished: false })
        };
        const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

        mockGameService.addRoundToGame.mockResolvedValueOnce(gameDto);
        mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/games/game-1/rounds',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: {
            id: 'round-1',
            moves: [],
            isFinished: false
          }
        };

        const response = await gameController.addRound(request);

        expect(response.statusCode).toBe(200);
        expect(response.headers?.['etag']).toBe('"etag-123"');
        expect(mockGameService.addRoundToGame).toHaveBeenCalledWith('game-1', expect.any(Object), 'etag-123');
      });
    });

    describe('addMove', () => {
      it('should add move to game round successfully', async () => {
        const gameDto = {
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [{ id: 'round-1', moves: [{ id: 'move-1', userId: 'user-1', value: 10, valueDecorated: 'ten' }], isFinished: false }],
          isFinished: false,
          toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [{ id: 'round-1', moves: [{ id: 'move-1', userId: 'user-1', value: 10, valueDecorated: 'ten' }], isFinished: false }], isFinished: false })
        };
        const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

        mockGameService.addMoveToGameRound.mockResolvedValueOnce(gameDto);
        mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/games/game-1/rounds/round-1/moves',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1', roundId: 'round-1' },
        body: {
            id: 'move-1',
            userId: 'user-1',
            value: 10,
            valueDecorated: 'ten'
          }
        };

        const response = await gameController.addMove(request);

        expect(response.statusCode).toBe(200);
        expect(response.headers?.['etag']).toBe('"etag-123"');
        expect(mockGameService.addMoveToGameRound).toHaveBeenCalledWith('game-1', 'round-1', expect.any(Object), 'etag-123');
      });
    });

    describe('finishRound', () => {
      it('should finish game round successfully', async () => {
        const gameDto = {
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [{ id: 'round-1', moves: [], isFinished: true }],
          isFinished: false,
          toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [{ id: 'round-1', moves: [], isFinished: true }], isFinished: false })
        };
        const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

        mockGameService.finishGameRound.mockResolvedValueOnce(gameDto);
        mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PATCH',
        path: '/apiv2/internal/games/game-1/rounds/round-1/finish',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1', roundId: 'round-1' },
        body: null
      };

        const response = await gameController.finishRound(request);

        expect(response.statusCode).toBe(200);
        expect(response.headers?.['etag']).toBe('"etag-123"');
        expect(mockGameService.finishGameRound).toHaveBeenCalledWith('game-1', 'round-1', 'etag-123');
      });
    });

    describe('finishGame', () => {
      it('should finish game successfully', async () => {
        const gameDto = {
          id: 'game-1',
          type: 'tournament',
          usersIds: ['user-1'],
          rounds: [],
          isFinished: true,
          toJSON: () => ({ id: 'game-1', type: 'tournament', usersIds: ['user-1'], rounds: [], isFinished: true })
        };
        const metadata = { etag: 'etag-123', size: 1024, lastModified: '2023-10-12T18:30:00.000Z' };

        mockGameService.finishGame.mockResolvedValueOnce(gameDto);
        mockGameService.getGameMetadata.mockResolvedValueOnce(metadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PATCH',
        path: '/apiv2/internal/games/game-1/finish',
        headers: { 'if-match': 'etag-123' },
        query: {},
        params: { id: 'game-1' },
        body: null
      };

        const response = await gameController.finishGame(request);

        expect(response.statusCode).toBe(200);
        expect(response.headers?.['etag']).toBe('"etag-123"');
        expect(mockGameService.finishGame).toHaveBeenCalledWith('game-1', 'etag-123');
      });
    });
  });

  describe('extractId', () => {
    it('should extract id from params.id', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      // Access private method through any
      const extractId = (gameController as any).extractId.bind(gameController);
      expect(extractId(request)).toBe('game-1');
    });

    it('should extract id from params.name (legacy)', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: {},
        query: {},
        params: { name: 'game-1' },
        body: null
      };

      const extractId = (gameController as any).extractId.bind(gameController);
      expect(extractId(request)).toBe('game-1');
    });

    it('should extract id from proxy parameter', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games/game-1',
        headers: {},
        query: {},
        params: { proxy: 'games/game-1' },
        body: null
      };

      const extractId = (gameController as any).extractId.bind(gameController);
      expect(extractId(request)).toBe('game-1');
    });

    it('should throw ValidationError when no id found', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/games',
        headers: {},
        query: {},
        params: {},
        body: null
      };

      const extractId = (gameController as any).extractId.bind(gameController);
      expect(() => extractId(request)).toThrow(ValidationError);
    });
  });

  describe('extractRoundId', () => {
    it('should extract roundId from params.roundId', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/games/game-1/rounds/round-1/moves',
        headers: {},
        query: {},
        params: { id: 'game-1', roundId: 'round-1' },
        body: null
      };

      const extractRoundId = (gameController as any).extractRoundId.bind(gameController);
      expect(extractRoundId(request)).toBe('round-1');
    });

    it('should extract roundId from path', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/games/game-1/rounds/round-1/moves',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const extractRoundId = (gameController as any).extractRoundId.bind(gameController);
      expect(extractRoundId(request)).toBe('round-1');
    });

    it('should throw ValidationError when no roundId found', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/games/game-1/rounds',
        headers: {},
        query: {},
        params: { id: 'game-1' },
        body: null
      };

      const extractRoundId = (gameController as any).extractRoundId.bind(gameController);
      expect(() => extractRoundId(request)).toThrow(ValidationError);
    });
  });
});
