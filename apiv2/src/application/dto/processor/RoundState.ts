import { RoundStatus } from '../../../domain/value-object/RoundStatus.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { SubRoundState } from './SubRoundState.js';

/**
 * RoundState represents the presentation state of a round.
 * This is a presentation object for the Round domain entity.
 */
export class RoundState {
  constructor(
    public readonly status: RoundStatus,
    public readonly started: Date | null,
    public readonly finished: Date | null,
    public readonly roundId: string,
    public readonly winnerId?: string,
    public readonly subRoundStates: SubRoundState[] = []
  ) {
    this.validateStatus(status);
    this.validateStarted(started);
    this.validateFinished(finished);
    this.validateRoundId(roundId);
    this.validateWinnerId(winnerId);
    this.validateSubRoundStates(subRoundStates);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      status: this.status,
      started: this.started ? this.started.toISOString() : null,
      finished: this.finished ? this.finished.toISOString() : null,
      roundId: this.roundId,
      winnerId: this.winnerId,
      subRoundStates: this.subRoundStates.map(srs => srs.toJSON())
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

    const started = data.started ? new Date(data.started) : null;
    const finished = data.finished ? new Date(data.finished) : null;
    const subRoundStates = Array.isArray(data.subRoundStates) 
      ? data.subRoundStates.map((srsData: any) => SubRoundState.fromJSON(srsData))
      : [];

    return new RoundState(
      data.status as RoundStatus,
      started,
      finished,
      data.roundId,
      data.winnerId,
      subRoundStates
    );
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

  private validateFinished(finished: Date | null): void {
    if (finished !== null && !(finished instanceof Date)) {
      throw new ValidationError('finished must be a Date object or null');
    }
    if (finished !== null && isNaN(finished.getTime())) {
      throw new ValidationError('finished must be a valid Date');
    }
  }

  private validateRoundId(roundId: string): void {
    if (!roundId || typeof roundId !== 'string' || roundId.trim().length === 0) {
      throw new ValidationError('roundId is required and must be a non-empty string');
    }
  }

  private validateWinnerId(winnerId?: string): void {
    if (winnerId !== undefined && winnerId !== null) {
      if (typeof winnerId !== 'string' || winnerId.trim().length === 0) {
        throw new ValidationError('winnerId must be a non-empty string if provided');
      }
    }
  }

  private validateSubRoundStates(subRoundStates: SubRoundState[]): void {
    if (!Array.isArray(subRoundStates)) {
      throw new ValidationError('subRoundStates must be an array');
    }
    subRoundStates.forEach((subRoundState, index) => {
      if (!(subRoundState instanceof SubRoundState)) {
        throw new ValidationError(`subRoundStates[${index}] must be an instance of SubRoundState`);
      }
    });
  }
}
