import { ValidationError } from '../../../shared/errors/index.js';

/**
 * CoinOutcomeEvent represents a coin outcome event.
 */
export class CoinOutcomeEvent {
  constructor(
    public readonly amount: number,
    public readonly coinDescriptionId: string
  ) {
    this.validateAmount(amount);
    this.validateCoinDescriptionId(coinDescriptionId);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      amount: this.amount,
      coinDescriptionId: this.coinDescriptionId
    };
  }

  /**
   * Create a new CoinOutcomeEvent from JSON data
   */
  static fromJSON(data: any): CoinOutcomeEvent {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid coin outcome event data: must be an object');
    }

    if (typeof data.amount !== 'number') {
      throw new ValidationError('CoinOutcomeEvent amount is required and must be a number');
    }

    if (!data.coinDescriptionId || typeof data.coinDescriptionId !== 'string') {
      throw new ValidationError('CoinOutcomeEvent coinDescriptionId is required and must be a string');
    }

    return new CoinOutcomeEvent(
      data.amount,
      data.coinDescriptionId
    );
  }

  private validateAmount(amount: number): void {
    if (typeof amount !== 'number') {
      throw new ValidationError('CoinOutcomeEvent amount must be a number');
    }

    if (!Number.isFinite(amount)) {
      throw new ValidationError('CoinOutcomeEvent amount must be a finite number');
    }

    if (amount < 0) {
      throw new ValidationError('CoinOutcomeEvent amount must be a non-negative number');
    }
  }

  private validateCoinDescriptionId(coinDescriptionId: string): void {
    if (!coinDescriptionId || typeof coinDescriptionId !== 'string') {
      throw new ValidationError('CoinOutcomeEvent coinDescriptionId is required and must be a string');
    }

    if (coinDescriptionId.trim().length === 0) {
      throw new ValidationError('CoinOutcomeEvent coinDescriptionId cannot be empty');
    }
  }
}
