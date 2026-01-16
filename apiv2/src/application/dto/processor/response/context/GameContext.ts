import { GameStatus } from '../../../../../domain/value-object/GameStatus.js';
import { InitGameContext } from './InitGameContext.js';

/**
 * GameContext represents the game context information.
 */
export class GameContext {
  constructor(
    public readonly status: GameStatus,
    public readonly initGameContext?: InitGameContext
  ) {
    if (!status || !Object.values(GameStatus).includes(status)) {
      throw new Error(`status must be one of: ${Object.values(GameStatus).join(', ')}`);
    }
    if (initGameContext !== undefined && !(initGameContext instanceof InitGameContext)) {
      throw new Error('initGameContext must be an instance of InitGameContext if provided');
    }
  }
}

