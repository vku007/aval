/**
 * Response class for game creation operation.
 */
export type ExecutionStatus = 'created' | 'failed';

export class CreateGameResponse {
  constructor(
    public readonly status: ExecutionStatus,
    public readonly gameId: string
  ) {
    if (!status || (status !== 'created' && status !== 'failed')) {
      throw new Error('status must be either "created" or "failed"');
    }
    if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
      throw new Error('gameId is required and must be a non-empty string');
    }
  }
}

