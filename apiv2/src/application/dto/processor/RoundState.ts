import { RoundStatus } from '../../../domain/value-object/RoundStatus.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { RoundContext } from './RoundContext.js';

/**
 * RoundState represents the state of a round with status and timestamps.
 */
export class RoundState {
  constructor(
    public readonly status: RoundStatus,
    public readonly started: Date | null,
    public readonly updated: Date | null,
    public readonly roundId: string,
    public readonly roundContext: RoundContext
  ) {
    this.validateStatus(status);
    this.validateStarted(started);
    this.validateUpdated(updated);
    this.validateRoundId(roundId);
    this.validateRoundContext(roundContext);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      status: this.status,
      started: this.started ? this.started.toISOString() : null,
      updated: this.updated ? this.updated.toISOString() : null,
      roundId: this.roundId,
      roundContext: this.roundContext.toJSON()
    };
  }

  /**
   * Create a new RoundState from JSON data
   */
  static fromJSON(data: any): RoundState {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid round state data: must be an object');
    }

    if (!data.status || typeof data.status !== 'string') {
      throw new ValidationError('RoundState status is required and must be a string');
    }

    if (!Object.values(RoundStatus).includes(data.status as RoundStatus)) {
      throw new ValidationError(`Invalid status: ${data.status}. Must be one of: ${Object.values(RoundStatus).join(', ')}`);
    }

    if (!data.roundId || typeof data.roundId !== 'string') {
      throw new ValidationError('RoundState roundId is required and must be a string');
    }

    if (!data.roundContext || typeof data.roundContext !== 'object') {
      throw new ValidationError('RoundState roundContext is required and must be an object');
    }

    const started = data.started ? new Date(data.started) : null;
    const updated = data.updated ? new Date(data.updated) : null;
    const roundContext = RoundContext.fromJSON(data.roundContext);

    return new RoundState(data.status as RoundStatus, started, updated, data.roundId, roundContext);
  }

  private validateStatus(status: RoundStatus): void {
    if (!status || !Object.values(RoundStatus).includes(status)) {
      throw new ValidationError(`status must be one of: ${Object.values(RoundStatus).join(', ')}`);
    }
  }

  private validateStarted(started: Date | null): void {
    if (started !== null && !(started instanceof Date)) {
      throw new ValidationError('started must be a Date object or null');
    }
    if (started !== null && isNaN(started.getTime())) {
      throw new ValidationError('started must be a valid Date');
    }
  }

  private validateUpdated(updated: Date | null): void {
    if (updated !== null && !(updated instanceof Date)) {
      throw new ValidationError('updated must be a Date object or null');
    }
    if (updated !== null && isNaN(updated.getTime())) {
      throw new ValidationError('updated must be a valid Date');
    }
  }

  private validateRoundId(roundId: string): void {
    if (!roundId || typeof roundId !== 'string' || roundId.trim().length === 0) {
      throw new ValidationError('roundId is required and must be a non-empty string');
    }
  }

  private validateRoundContext(roundContext: RoundContext): void {
    if (!roundContext || !(roundContext instanceof RoundContext)) {
      throw new ValidationError('roundContext is required and must be an instance of RoundContext');
    }
  }
}

