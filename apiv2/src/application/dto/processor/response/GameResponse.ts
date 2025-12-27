import { GameResponsePayload } from './payload/GameResponsePayload.js';

/**
 * GameResponse represents the response for getting a game.
 */
export class GameResponse {
  constructor(
    public readonly status: string,
    public readonly payload: GameResponsePayload
  ) {
    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      throw new Error('status is required and must be a non-empty string');
    }
    if (!payload || !(payload instanceof GameResponsePayload)) {
      throw new Error('payload is required and must be an instance of GameResponsePayload');
    }
  }
}

