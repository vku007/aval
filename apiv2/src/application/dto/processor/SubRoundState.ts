import { SubRoundStatus } from '../../../domain/value-object/SubRoundStatus.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { Move } from '../../../domain/value-object/Move.js';

/**
 * SubRoundState represents the presentation state of a sub-round.
 * This is a presentation object for the SubRound domain entity.
 */
export class SubRoundState {
  constructor(
    public readonly idNum: number,
    public readonly status: SubRoundStatus,
    public readonly started: Date | null,
    public readonly finished: Date | null,
    public readonly updated: Date | null,
    public readonly winnerId?: string,
    public readonly moves: Move[] = []
  ) {
    this.validateIdNum(idNum);
    this.validateStatus(status);
    this.validateStarted(started);
    this.validateFinished(finished);
    this.validateUpdated(updated);
    this.validateWinnerId(winnerId);
    this.validateMoves(moves);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      idNum: this.idNum,
      status: this.status,
      started: this.started ? this.started.toISOString() : null,
      finished: this.finished ? this.finished.toISOString() : null,
      updated: this.updated ? this.updated.toISOString() : null,
      winnerId: this.winnerId,
      moves: this.moves.map(move => move.toJSON())
    };
  }

  /**
   * Create a new SubRoundState from JSON data
   */
  static fromJSON(data: any): SubRoundState {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid sub-round state data: must be an object');
    }

    if (typeof data.idNum !== 'number') {
      throw new ValidationError('SubRoundState idNum is required and must be a number');
    }

    if (!data.status || typeof data.status !== 'string') {
      throw new ValidationError('SubRoundState status is required and must be a string');
    }

    if (!Object.values(SubRoundStatus).includes(data.status as SubRoundStatus)) {
      throw new ValidationError(`Invalid status: ${data.status}. Must be one of: ${Object.values(SubRoundStatus).join(', ')}`);
    }

    const started = data.started ? new Date(data.started) : null;
    const finished = data.finished ? new Date(data.finished) : null;
    const updated = data.updated ? new Date(data.updated) : null;
    const moves = Array.isArray(data.moves) ? data.moves.map((moveData: any) => Move.fromJSON(moveData)) : [];

    return new SubRoundState(
      data.idNum,
      data.status as SubRoundStatus,
      started,
      finished,
      updated,
      data.winnerId,
      moves
    );
  }

  private validateIdNum(idNum: number): void {
    if (typeof idNum !== 'number' || !Number.isInteger(idNum) || idNum < 0) {
      throw new ValidationError('idNum must be a non-negative integer');
    }
  }

  private validateStatus(status: SubRoundStatus): void {
    if (!status || !Object.values(SubRoundStatus).includes(status)) {
      throw new ValidationError(`status must be one of: ${Object.values(SubRoundStatus).join(', ')}`);
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

  private validateUpdated(updated: Date | null): void {
    if (updated !== null && !(updated instanceof Date)) {
      throw new ValidationError('updated must be a Date object or null');
    }
    if (updated !== null && isNaN(updated.getTime())) {
      throw new ValidationError('updated must be a valid Date');
    }
  }

  private validateWinnerId(winnerId?: string): void {
    if (winnerId !== undefined && winnerId !== null) {
      if (typeof winnerId !== 'string' || winnerId.trim().length === 0) {
        throw new ValidationError('winnerId must be a non-empty string if provided');
      }
    }
  }

  private validateMoves(moves: Move[]): void {
    if (!Array.isArray(moves)) {
      throw new ValidationError('moves must be an array');
    }
    moves.forEach((move, index) => {
      if (!(move instanceof Move)) {
        throw new ValidationError(`moves[${index}] must be an instance of Move`);
      }
    });
  }
}

