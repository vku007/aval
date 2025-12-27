import { ValidationError } from '../../shared/errors/index.js';

/**
 * GameLevel represents a game level with a name.
 */
export class GameLevel {
  constructor(
    public readonly name: string
  ) {
    this.validateName(name);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      name: this.name
    };
  }

  /**
   * Create a new GameLevel from JSON data
   */
  static fromJSON(data: any): GameLevel {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid game level data: must be an object');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('GameLevel name is required and must be a string');
    }

    return new GameLevel(data.name);
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('GameLevel name is required and must be a non-empty string');
    }
  }
}

