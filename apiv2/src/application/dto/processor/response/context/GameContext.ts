import { GameStatus } from '../../../../../domain/value-object/GameStatus.js';
import { GameCreateContext } from '../../GameCreateContext.js';
import { InitGameContext } from './InitGameContext.js';
import { KindOfGame } from '../../../../../domain/value-object/KindOfGame.js';

/**
 * GameContext represents the game context information.
 * Extended games also carry the per-turn size caps set at create.
 */
export class GameContext {
  constructor(
    public readonly status: GameStatus,
    public readonly initGameContext?: InitGameContext,
    public readonly maxStonePerTurn?: number,
    public readonly maxScissorsPerTurn?: number,
    public readonly maxPaperPerTurn?: number
  ) {
    if (!status || !Object.values(GameStatus).includes(status)) {
      throw new Error(`status must be one of: ${Object.values(GameStatus).join(', ')}`);
    }
    if (initGameContext !== undefined && !(initGameContext instanceof InitGameContext)) {
      throw new Error('initGameContext must be an instance of InitGameContext if provided');
    }
  }

  static fromCreateContext(status: GameStatus, createContext?: GameCreateContext): GameContext {
    const initGameContext = createContext
      ? InitGameContext.fromGameCreateContext(createContext)
      : undefined;
    if (createContext?.kind === KindOfGame.Extended) {
      return new GameContext(
        status,
        initGameContext,
        createContext.maxStonePerTurn,
        createContext.maxScissorsPerTurn,
        createContext.maxPaperPerTurn
      );
    }
    return new GameContext(status, initGameContext);
  }

  toJSON(): object {
    const json: Record<string, unknown> = {
      status: this.status,
      initGameContext: this.initGameContext?.toJSON()
    };
    if (this.maxStonePerTurn !== undefined) {
      json.max_stone_per_turn = this.maxStonePerTurn;
      json.max_scissors_per_turn = this.maxScissorsPerTurn;
      json.max_paper_per_turn = this.maxPaperPerTurn;
    }
    return json;
  }
}

