import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { UserService } from '../../application/services/UserService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError } from '../../shared/errors/index.js';

/**
 * External-facing controller for public API endpoints
 * Handles requests to /apiv2/external/*
 */
export class ExternalController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger
  ) {}

  /**
   * Get current user's profile
   * GET /apiv2/external/me
   * 
   * Requires authentication (any role)
   * Returns user entity based on JWT token's user ID
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

      // Get user entity from database using getUser (which returns UserResponseDto)
      const userDto = await this.userService.getUser(userId);

      this.logger.info('User profile retrieved', { userId });

      // Return user data as JSON (toJSON() returns the plain object)
      return HttpResponse.ok(userDto.toJSON());

    } catch (error: any) {
      this.logger.error('Failed to get user profile', {
        error: error.message,
        path: request.path,
        userId: request.user?.userId
      });
      throw error;
    }
  }
}

