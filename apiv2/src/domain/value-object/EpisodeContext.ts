import { ValidationError } from '../../shared/errors/index.js';

/**
 * EpisodeContext represents an episode context with a name.
 */
export class EpisodeContext {
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
   * Create a new EpisodeContext from JSON data
   */
  static fromJSON(data: any): EpisodeContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid episode context data: must be an object');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('EpisodeContext name is required and must be a string');
    }

    return new EpisodeContext(data.name);
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('EpisodeContext name is required and must be a non-empty string');
    }
  }
}

