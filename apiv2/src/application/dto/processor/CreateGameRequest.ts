import { ValidationError } from '../../../shared/errors/index.js';
import { GameCreateContext } from './GameCreateContext.js';

/**
 * Immutable request class for creating a game.
 * Represents game settings, not a domain entity.
 */
export class CreateGameRequest {
  constructor(
    public readonly userId: string,
    public readonly gameCreateContext: GameCreateContext
  ) {
    this.validateUserId(userId);
    this.validateGameCreateContext(gameCreateContext);
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required and must be a non-empty string');
    }
  }

  private validateGameCreateContext(gameCreateContext: GameCreateContext): void {
    if (!gameCreateContext || !(gameCreateContext instanceof GameCreateContext)) {
      throw new ValidationError('gameCreateContext is required and must be an instance of GameCreateContext');
    }
  }
}

