import { GameType } from '../../../domain/value-object/GameType.js';
import { RoundsLength } from '../../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../../domain/value-object/EpisodeContext.js';
import { MoveType } from '../../../domain/value-object/Move.js';
import { ValidationError } from '../../../shared/errors/index.js';

export const DEFAULT_MAX_STONE_PER_TURN = 9;
export const DEFAULT_MAX_SCISSORS_PER_TURN = 4;
export const DEFAULT_MAX_PAPER_PER_TURN = 7;

/**
 * GameCreateContext represents the game creation context with game settings.
 */
export class GameCreateContext {
  /** Extended only. Largest Stone size allowed in one throw. */
  public readonly maxStonePerTurn?: number;
  /** Extended only. Largest Scissors size allowed in one throw. */
  public readonly maxScissorsPerTurn?: number;
  /** Extended only. Largest Paper size allowed in one throw. */
  public readonly maxPaperPerTurn?: number;

  constructor(
    public readonly gameType: GameType,
    public readonly rounds: RoundsLength,
    public readonly kind: KindOfGame,
    public readonly level: GameLevel,
    public readonly episode: EpisodeContext,
    maxStonePerTurn?: number,
    maxScissorsPerTurn?: number,
    maxPaperPerTurn?: number
  ) {
    this.validateGameType(gameType);
    this.validateRounds(rounds);
    this.validateKind(kind);
    this.validateLevel(level);
    this.validateEpisode(episode);
    if (kind === KindOfGame.Extended) {
      this.maxStonePerTurn = GameCreateContext.readCap(
        maxStonePerTurn,
        DEFAULT_MAX_STONE_PER_TURN,
        'max_stone_per_turn'
      );
      this.maxScissorsPerTurn = GameCreateContext.readCap(
        maxScissorsPerTurn,
        DEFAULT_MAX_SCISSORS_PER_TURN,
        'max_scissors_per_turn'
      );
      this.maxPaperPerTurn = GameCreateContext.readCap(
        maxPaperPerTurn,
        DEFAULT_MAX_PAPER_PER_TURN,
        'max_paper_per_turn'
      );
    }
  }

  /** Largest legal size for this throw. Extended games only. */
  capFor(moveType: MoveType): number {
    if (moveType === MoveType.Stone) {
      return this.maxStonePerTurn ?? DEFAULT_MAX_STONE_PER_TURN;
    }
    if (moveType === MoveType.Scissors) {
      return this.maxScissorsPerTurn ?? DEFAULT_MAX_SCISSORS_PER_TURN;
    }
    if (moveType === MoveType.Paper) {
      return this.maxPaperPerTurn ?? DEFAULT_MAX_PAPER_PER_TURN;
    }
    throw new ValidationError(`Invalid moveType: ${moveType}`);
  }

  /** JSON field that carries `capFor(moveType)`. */
  capField(moveType: MoveType): string {
    if (moveType === MoveType.Stone) {
      return 'max_stone_per_turn';
    }
    if (moveType === MoveType.Scissors) {
      return 'max_scissors_per_turn';
    }
    if (moveType === MoveType.Paper) {
      return 'max_paper_per_turn';
    }
    throw new ValidationError(`Invalid moveType: ${moveType}`);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    const json: Record<string, unknown> = {
      gameType: this.gameType,
      rounds: this.rounds,
      kind: this.kind,
      level: this.level.toJSON(),
      episode: this.episode.toJSON()
    };
    if (this.kind === KindOfGame.Extended) {
      json.max_stone_per_turn = this.maxStonePerTurn;
      json.max_scissors_per_turn = this.maxScissorsPerTurn;
      json.max_paper_per_turn = this.maxPaperPerTurn;
    }
    return json;
  }

  /**
   * Create a new GameCreateContext from JSON data
   */
  static fromJSON(data: any): GameCreateContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid game create context data: must be an object');
    }

    if (!data.gameType || typeof data.gameType !== 'string') {
      throw new ValidationError('GameCreateContext gameType is required and must be a string');
    }
    if (!Object.values(GameType).includes(data.gameType as GameType)) {
      throw new ValidationError(`Invalid gameType: ${data.gameType}. Must be one of: ${Object.values(GameType).join(', ')}`);
    }

    if (!data.rounds || typeof data.rounds !== 'string') {
      throw new ValidationError('GameCreateContext rounds is required and must be a string');
    }
    if (!Object.values(RoundsLength).includes(data.rounds as RoundsLength)) {
      throw new ValidationError(`Invalid rounds: ${data.rounds}. Must be one of: ${Object.values(RoundsLength).join(', ')}`);
    }

    if (!data.kind || typeof data.kind !== 'string') {
      throw new ValidationError('GameCreateContext kind is required and must be a string');
    }
    if (!Object.values(KindOfGame).includes(data.kind as KindOfGame)) {
      throw new ValidationError(`Invalid kind: ${data.kind}. Must be one of: ${Object.values(KindOfGame).join(', ')}`);
    }

    if (!data.level || typeof data.level !== 'object') {
      throw new ValidationError('GameCreateContext level is required and must be an object');
    }
    const level = GameLevel.fromJSON(data.level);

    if (!data.episode || typeof data.episode !== 'object') {
      throw new ValidationError('GameCreateContext episode is required and must be an object');
    }
    const episode = EpisodeContext.fromJSON(data.episode);

    const kind = data.kind as KindOfGame;
    return new GameCreateContext(
      data.gameType as GameType,
      data.rounds as RoundsLength,
      kind,
      level,
      episode,
      kind === KindOfGame.Extended ? data.max_stone_per_turn : undefined,
      kind === KindOfGame.Extended ? data.max_scissors_per_turn : undefined,
      kind === KindOfGame.Extended ? data.max_paper_per_turn : undefined
    );
  }

  private validateGameType(gameType: GameType): void {
    if (!gameType || !Object.values(GameType).includes(gameType)) {
      throw new ValidationError(`gameType must be one of: ${Object.values(GameType).join(', ')}`);
    }
  }

  private validateRounds(rounds: RoundsLength): void {
    if (!rounds || !Object.values(RoundsLength).includes(rounds)) {
      throw new ValidationError(`rounds must be one of: ${Object.values(RoundsLength).join(', ')}`);
    }
  }

  private validateKind(kind: KindOfGame): void {
    if (!kind || !Object.values(KindOfGame).includes(kind)) {
      throw new ValidationError(`kind must be one of: ${Object.values(KindOfGame).join(', ')}`);
    }
  }

  private validateLevel(level: GameLevel): void {
    if (!level || !(level instanceof GameLevel)) {
      throw new ValidationError('level is required and must be an instance of GameLevel');
    }
  }

  private validateEpisode(episode: EpisodeContext): void {
    if (!episode || !(episode instanceof EpisodeContext)) {
      throw new ValidationError('episode is required and must be an instance of EpisodeContext');
    }
  }

  /** Omitted uses `fallback`. A provided value is an integer >= 1. */
  private static readCap(value: unknown, fallback: number, label: string): number {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new ValidationError(`${label} must be an integer >= 1`);
    }
    return value;
  }
}

