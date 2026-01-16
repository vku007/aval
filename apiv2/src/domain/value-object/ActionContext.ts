import { Move } from './Move.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * ActionContext represents the context of an action.
 */
export class ActionContext {
  constructor(
    public readonly move?: Move
  ) {
    if (move !== undefined) {
      this.validateMove(move);
    }
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      move: this.move?.toJSON()
    };
  }

  /**
   * Create a new ActionContext from JSON data
   */
  static fromJSON(data: any): ActionContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid action context data: must be an object');
    }

    const move = data.move ? Move.fromJSON(data.move) : undefined;

    return new ActionContext(move);
  }

  private validateMove(move: Move): void {
    if (!move || !(move instanceof Move)) {
      throw new ValidationError('move must be an instance of Move');
    }
  }
}

