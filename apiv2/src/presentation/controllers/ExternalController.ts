import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { GameProcessorService } from '../../application/services/GameProcessorService.js';
import { CreateGameRequest } from '../../application/dto/processor/CreateGameRequest.js';
import { GameCreateContext } from '../../application/dto/processor/GameCreateContext.js';
import { Action } from '../../domain/value-object/Action.js';
import { CreateUserDto } from '../../application/dto/CreateUserDto.js';
import type { AuthenticatedRequest } from '../../presentation/middleware/auth.js';

/**
 * External-facing controller for public API endpoints
 * Handles requests to /apiv2/external/*
 */
export class ExternalController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger,
    private readonly gameProcessorService: GameProcessorService
  ) {}

  /**
   * Get current user's profile
   * GET /apiv2/external/me
   * 
   * Requires authentication (any role)
   * Returns user entity based on JWT token's user ID
   * Auto-creates user in database if they don't exist yet
   */
  async getMe(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      // Get user ID from JWT token (set by authMiddleware)
      const userId = request.user?.userId;
      
      if (!userId) {
        this.logger.warn('User ID not found in request', {
          path: request.path,
          user: request.user
        });
        throw new NotFoundError('User profile not found');
      }

      this.logger.info('Fetching user profile', { userId });

      try {
        // Try to get user entity from database
        const userDto = await this.userService.getUser(userId);
        this.logger.info('User profile retrieved', { userId });
        return HttpResponse.ok(userDto.toJSON());
      } catch (error: any) {
        // If user not found, auto-create them
        if (error instanceof NotFoundError) {
          this.logger.info('User not found in database, auto-creating', { userId });
          
          // Cast to AuthenticatedRequest to access display_name
          const authRequest = request as AuthenticatedRequest;
          // Get user info from JWT token (use display_name, email, or fallback)
          const displayName = authRequest.user?.display_name || authRequest.user?.email || 'User';
          const name = displayName.length >= 2 && displayName.length <= 100 
            ? displayName 
            : (displayName.length < 2 ? 'User' : displayName.substring(0, 100));
          
          // Generate deterministic externalId from userId (simple hash)
          const externalId = this.generateExternalId(userId);
          
          // Create user DTO and save
          const createDto = new CreateUserDto(userId, name, externalId);
          const userDto = await this.userService.createUser(createDto);
          
          this.logger.info('User auto-created', { userId, name, externalId });
          return HttpResponse.ok(userDto.toJSON());
        }
        // Re-throw other errors
        throw error;
      }

    } catch (error: any) {
      this.logger.error('Failed to get user profile', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId
      });
      throw error;
    }
  }

  /**
   * Generate a deterministic positive integer from a string (userId)
   * Uses a simple hash function to convert string to positive integer
   */
  private generateExternalId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive and >= 1
    return Math.abs(hash) % 2147483647 + 1; // Max 32-bit int - 1, then add 1 to ensure >= 1
  }

  /**
   * Create a new game
   * POST /apiv2/external/games
   * 
   * Requires authentication (any role)
   * Creates a game for the authenticated user
   */
  async createGame(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      // Get user ID from JWT token (set by authMiddleware)
      const userId = request.user?.userId;
      
      if (!userId) {
        this.logger.warn('User ID not found in request', {
          path: request.path,
          user: request.user
        });
        throw new NotFoundError('User profile not found');
      }

      if (!request.body || typeof request.body !== 'object') {
        throw new ValidationError('Request body is required and must be an object');
      }

      this.logger.info('Creating game', { userId });

      // Parse request body to create GameCreateContext
      const gameCreateContext = GameCreateContext.fromJSON(request.body);
      
      // Create CreateGameRequest
      const createGameRequest = new CreateGameRequest(userId, gameCreateContext);
      
      // Call service
      const response = await this.gameProcessorService.createGame(createGameRequest);

      this.logger.info('Game created', { userId, gameId: response.gameId, status: response.status });

      // Serialize response
      return HttpResponse.ok({
        status: response.status,
        gameId: response.gameId
      });

    } catch (error: any) {
      this.logger.error('Failed to create game', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId
      });
      throw error;
    }
  }

  /**
   * Get a game by ID
   * GET /apiv2/external/games/:gameId
   * 
   * Requires authentication (any role)
   * Returns game data for the authenticated user
   */
  async getGame(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      // Get user ID from JWT token (set by authMiddleware)
      const userId = request.user?.userId;
      
      if (!userId) {
        this.logger.warn('User ID not found in request', {
          path: request.path,
          user: request.user
        });
        throw new NotFoundError('User profile not found');
      }

      // Extract gameId from params
      const gameId = request.params.gameId;
      if (!gameId) {
        throw new ValidationError('Game ID is required');
      }

      this.logger.info('Getting game', { userId, gameId });

      // Call service
      const response = await this.gameProcessorService.getGame(userId, gameId);

      this.logger.info('Game retrieved', { userId, gameId, status: response.status });

      // Serialize response payload
      const payload = {
        gameContext: {
          status: response.payload.gameContext.status,
          initGameContext: response.payload.gameContext.initGameContext?.toJSON()
        },
        playerContext: {
          roundStates: response.payload.playerContext.roundStates.map(rs => rs.toJSON())
        },
        enemyContext: {}
      };

      return HttpResponse.ok({
        status: response.status,
        payload
      });

    } catch (error: any) {
      this.logger.error('Failed to get game', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId,
        gameId: request.params.gameId
      });
      throw error;
    }
  }

  /**
   * Update a game with an action
   * PUT/PATCH /apiv2/external/games/:gameId
   * 
   * Requires authentication (any role)
   * Updates a game for the authenticated user
   */
  async updateGame(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      // Get user ID from JWT token (set by authMiddleware)
      const userId = request.user?.userId;
      
      if (!userId) {
        this.logger.warn('User ID not found in request', {
          path: request.path,
          user: request.user
        });
        throw new NotFoundError('User profile not found');
      }

      // Extract gameId from params
      const gameId = request.params.gameId;
      if (!gameId) {
        throw new ValidationError('Game ID is required');
      }

      if (!request.body || typeof request.body !== 'object') {
        throw new ValidationError('Request body is required and must be an object');
      }

      this.logger.info('Updating game', { userId, gameId });

      // Parse request body to create Action
      const action = Action.fromJSON(request.body);
      
      // Call service
      const response = await this.gameProcessorService.updateGame(userId, gameId, action);

      this.logger.info('Game updated', { userId, gameId, status: response.status });

      // Serialize response payload
      const payload = {
        gameContext: {
          status: response.payload.gameContext.status,
          initGameContext: response.payload.gameContext.initGameContext?.toJSON()
        },
        playerContext: {
          roundStates: response.payload.playerContext.roundStates.map(rs => rs.toJSON())
        },
        enemyContext: {}
      };

      return HttpResponse.ok({
        status: response.status,
        gameId: response.gameId,
        payload,
        message: response.message
      });

    } catch (error: any) {
      this.logger.error('Failed to update game', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId,
        gameId: request.params.gameId
      });
      throw error;
    }
  }
}

