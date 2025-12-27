import { GameResponsePayload } from './response/payload/GameResponsePayload.js';

/**
 * Response class for game update operation.
 */
export type UpdateExecutionStatus = 'updated' | 'failed';

export class UpdateGameResponse {
  constructor(
    public readonly status: UpdateExecutionStatus,
    public readonly gameId: string,
    public readonly payload: GameResponsePayload
  ) {
    if (!status || (status !== 'updated' && status !== 'failed')) {
      throw new Error('status must be either "updated" or "failed"');
    }
    if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
      throw new Error('gameId is required and must be a non-empty string');
    }
    if (!payload || !(payload instanceof GameResponsePayload)) {
      throw new Error('payload is required and must be an instance of GameResponsePayload');
    }
  }
}

