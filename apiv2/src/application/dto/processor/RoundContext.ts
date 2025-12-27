import { ValidationError } from '../../../shared/errors/index.js';

/**
 * RoundContext represents the context of a round with power information.
 */
export class RoundContext {
  constructor(
    public readonly power: number
  ) {
    this.validatePower(power);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      power: this.power
    };
  }

  /**
   * Create a new RoundContext from JSON data
   */
  static fromJSON(data: any): RoundContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid round context data: must be an object');
    }

    if (typeof data.power !== 'number') {
      throw new ValidationError('RoundContext power is required and must be a number');
    }

    return new RoundContext(data.power);
  }

  private validatePower(power: number): void {
    if (typeof power !== 'number') {
      throw new ValidationError('power must be a number');
    }
    if (!Number.isFinite(power)) {
      throw new ValidationError('power must be a finite number');
    }
  }
}

