import { ActionType } from './ActionType.js';
import { ActionContext } from './ActionContext.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * Action represents an action taken in a game.
 */
export class Action {
  constructor(
    public readonly type: ActionType,
    public readonly context: ActionContext
  ) {
    this.validateType(type);
    this.validateContext(context);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      type: this.type,
      context: this.context.toJSON()
    };
  }

  /**
   * Create a new Action from JSON data
   */
  static fromJSON(data: any): Action {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid action data: must be an object');
    }

    if (!data.type || typeof data.type !== 'string') {
      throw new ValidationError('Action type is required and must be a string');
    }

    if (!Object.values(ActionType).includes(data.type as ActionType)) {
      throw new ValidationError(`Invalid action type: ${data.type}. Must be one of: ${Object.values(ActionType).join(', ')}`);
    }

    if (!data.context || typeof data.context !== 'object') {
      throw new ValidationError('Action context is required and must be an object');
    }

    const context = ActionContext.fromJSON(data.context);

    return new Action(data.type as ActionType, context);
  }

  private validateType(type: ActionType): void {
    if (!type || !Object.values(ActionType).includes(type)) {
      throw new ValidationError(`type must be one of: ${Object.values(ActionType).join(', ')}`);
    }
  }

  private validateContext(context: ActionContext): void {
    if (!context || !(context instanceof ActionContext)) {
      throw new ValidationError('context is required and must be an instance of ActionContext');
    }
  }
}

