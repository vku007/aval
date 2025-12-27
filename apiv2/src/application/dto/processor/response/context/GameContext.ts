import { GameStatus } from '../../../../../domain/value-object/GameStatus.js';

/**
 * GameContext represents the game context information.
 */
export class GameContext {
  constructor(
    public readonly status: GameStatus
  ) {
    if (!status || !Object.values(GameStatus).includes(status)) {
      throw new Error(`status must be one of: ${Object.values(GameStatus).join(', ')}`);
    }
  }
}

