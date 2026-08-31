import { ValidationError } from '../../../shared/errors/index.js';
import { RewardPointType } from './RewardPointType.js';

/**
 * PointOutcomeEvent represents a point outcome event.
 */
export class PointOutcomeEvent {
  constructor(
    public readonly amount: number,
    public readonly type: RewardPointType
  ) {
    this.validateAmount(amount);
    this.validateType(type);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      amount: this.amount,
      type: this.type
    };
  }

  /**
   * Create a new PointOutcomeEvent from JSON data
   */
  static fromJSON(data: any): PointOutcomeEvent {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid point outcome event data: must be an object');
    }

    if (typeof data.amount !== 'number') {
      throw new ValidationError('PointOutcomeEvent amount is required and must be a number');
    }

    if (!data.type || typeof data.type !== 'string') {
      throw new ValidationError('PointOutcomeEvent type is required and must be a string');
    }

    if (!Object.values(RewardPointType).includes(data.type as RewardPointType)) {
      throw new ValidationError(`Invalid type: ${data.type}. Must be one of: ${Object.values(RewardPointType).join(', ')}`);
    }

    return new PointOutcomeEvent(
      data.amount,
      data.type as RewardPointType
    );
  }

  private validateAmount(amount: number): void {
    if (typeof amount !== 'number') {
      throw new ValidationError('PointOutcomeEvent amount must be a number');
    }

    if (!Number.isFinite(amount)) {
      throw new ValidationError('PointOutcomeEvent amount must be a finite number');
    }

    if (amount < 0) {
      throw new ValidationError('PointOutcomeEvent amount must be a non-negative number');
    }
  }

  private validateType(type: RewardPointType): void {
    if (!type) {
      throw new ValidationError('PointOutcomeEvent type is required');
    }

    if (!Object.values(RewardPointType).includes(type)) {
      throw new ValidationError(`Invalid type: ${type}. Must be one of: ${Object.values(RewardPointType).join(', ')}`);
    }
  }
}
