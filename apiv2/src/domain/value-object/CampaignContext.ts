import { ValidationError } from '../../shared/errors/index.js';

/**
 * CampaignContext is the chapter name on a game create context.
 * The same shape as the former episode field: `{ name }`.
 */
export class CampaignContext {
  constructor(
    public readonly name: string
  ) {
    this.validateName(name);
  }

  toJSON(): object {
    return {
      name: this.name
    };
  }

  static fromJSON(data: any): CampaignContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid campaign context data: must be an object');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('CampaignContext name is required and must be a string');
    }

    return new CampaignContext(data.name);
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('CampaignContext name is required and must be a non-empty string');
    }
  }
}
