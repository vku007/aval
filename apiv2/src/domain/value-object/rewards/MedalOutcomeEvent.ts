import { ValidationError } from '../../../shared/errors/index.js';
import { Medal } from './Medal.js';

/**
 * MedalOutcomeEvent represents a medal outcome event.
 */
export class MedalOutcomeEvent {
  constructor(
    public readonly amount: number,
    public readonly medal: Medal
  ) {
    this.validateAmount(amount);
    this.validateMedal(medal);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      amount: this.amount,
      medal: this.medal.toJSON()
    };
  }

  /**
   * Create a new MedalOutcomeEvent from JSON data
   */
  static fromJSON(data: any): MedalOutcomeEvent {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid medal outcome event data: must be an object');
    }

    if (typeof data.amount !== 'number') {
      throw new ValidationError('MedalOutcomeEvent amount is required and must be a number');
    }

    if (!data.medal || typeof data.medal !== 'object') {
      throw new ValidationError('MedalOutcomeEvent medal is required and must be an object');
    }

    const medal = Medal.fromJSON(data.medal);

    return new MedalOutcomeEvent(
      data.amount,
      medal
    );
  }

  private validateAmount(amount: number): void {
    if (typeof amount !== 'number') {
      throw new ValidationError('MedalOutcomeEvent amount must be a number');
    }

    if (!Number.isFinite(amount)) {
      throw new ValidationError('MedalOutcomeEvent amount must be a finite number');
    }

    if (amount < 0) {
      throw new ValidationError('MedalOutcomeEvent amount must be a non-negative number');
    }
  }

  private validateMedal(medal: Medal): void {
    if (!medal || !(medal instanceof Medal)) {
      throw new ValidationError('MedalOutcomeEvent medal is required and must be an instance of Medal');
    }
  }
}
