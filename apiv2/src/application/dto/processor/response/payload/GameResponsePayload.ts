import { GameContext } from '../context/GameContext.js';
import { PlayerContext } from '../context/PlayerContext.js';
import { EnemyContext } from '../context/EnemyContext.js';

/**
 * GameResponsePayload contains the game response data.
 */
export class GameResponsePayload {
  constructor(
    public readonly gameContext: GameContext,
    public readonly playerContext: PlayerContext,
    public readonly enemyContext: EnemyContext
  ) {
    if (!gameContext || !(gameContext instanceof GameContext)) {
      throw new Error('gameContext is required and must be an instance of GameContext');
    }
    if (!playerContext || !(playerContext instanceof PlayerContext)) {
      throw new Error('playerContext is required and must be an instance of PlayerContext');
    }
    if (!enemyContext || !(enemyContext instanceof EnemyContext)) {
      throw new Error('enemyContext is required and must be an instance of EnemyContext');
    }
  }
}

