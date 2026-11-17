import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors/index.js';
import type { GameProcessorService } from '../../application/services/GameProcessorService.js';
import { CreateGameRequest } from '../../application/dto/processor/CreateGameRequest.js';
import { GameCreateContext } from '../../application/dto/processor/GameCreateContext.js';
import { Action } from '../../domain/value-object/Action.js';
import { GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
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
   * Store one player setting on the current user.
   * PATCH /apiv2/external/me
   */
  async patchMe(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new NotFoundError('User profile not found');
    }
    const ifMatch = request.headers['if-match'];
    try {
      const patch = parseSettingsPatch(request.body);
      const userDto = await this.userService.updateSettings(userId, patch, ifMatch);
      const metadata = await this.userService.getUserMetadata(userId);
      return HttpResponse.ok(userDto.toJSON()).withETag(metadata.etag);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: error.message,
          instance: request.path
        });
      }
      if (error instanceof PreconditionFailedError) {
        return HttpResponse.preconditionFailed({
          type: 'about:blank',
          title: 'Precondition Failed',
          status: 412,
          detail: error.message,
          instance: request.path
        });
      }
      throw error;
    }
  }

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

      const raw = request.body as Record<string, unknown>;
      for (const key of ['campaignId', 'campaignTile', 'campaignAttackId', 'campaignBattleSeed', 'campaignNpcAlgorithmId']) {
        if (raw[key] !== undefined) {
          throw new ValidationError(`${key} cannot be set on this route`);
        }
      }
      if (raw.episode !== undefined && raw.campaign === undefined) {
        throw new ValidationError('campaign is required');
      }

      // Parse request body to create GameCreateContext
      const gameCreateContext = GameCreateContext.fromJSON(request.body);
      const inventories = this.parseCreateInventories(request.body, userId);
      
      // Create CreateGameRequest
      const createGameRequest = new CreateGameRequest(userId, gameCreateContext, inventories);
      
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
        gameContext: response.payload.gameContext.toJSON(),
        playerContext: {
          roundStates: response.payload.playerContext.roundStates.map(rs => rs.toJSON()),
          inventory: response.payload.playerContext.inventory.toJSON()
        },
        enemyContext: response.payload.enemyContext.toJSON()
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
        gameContext: response.payload.gameContext.toJSON(),
        playerContext: {
          roundStates: response.payload.playerContext.roundStates.map(rs => rs.toJSON()),
          inventory: response.payload.playerContext.inventory.toJSON()
        },
        enemyContext: response.payload.enemyContext.toJSON()
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

  /**
   * Optional inventories on create. Omitted means the service fills both players.
   * A provided row must name the caller or NPC_1.
   */
  private parseCreateInventories(body: object, userId: string): GamePlayerInventory[] | undefined {
    const raw = (body as { inventories?: unknown }).inventories;
    if (raw === undefined) {
      return undefined;
    }
    if (!Array.isArray(raw)) {
      throw new ValidationError('inventories must be an array');
    }
    const parsed = raw.map(item => GamePlayerInventory.fromJSON(item));
    GamePlayerInventory.ensureForUsers([userId, 'NPC_1'], parsed, Date.now());
    return parsed;
  }
}

export function parseSettingsPatch(body: unknown): { hideAttackFeeNotice: boolean } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object');
  }
  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'settings') {
    throw new ValidationError('Request body must contain only settings');
  }
  const settings = obj.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new ValidationError('settings must be an object');
  }
  const settingKeys = Object.keys(settings as Record<string, unknown>);
  if (settingKeys.length !== 1 || settingKeys[0] !== 'hideAttackFeeNotice') {
    throw new ValidationError('settings must contain only hideAttackFeeNotice');
  }
  const flag = (settings as Record<string, unknown>).hideAttackFeeNotice;
  if (typeof flag !== 'boolean') {
    throw new ValidationError('hideAttackFeeNotice must be a boolean');
  }
  return { hideAttackFeeNotice: flag };
}

