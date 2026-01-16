import { GameType } from '../../../domain/value-object/GameType.js';
import { RoundsLength } from '../../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../../domain/value-object/EpisodeContext.js';
import { ValidationError } from '../../../shared/errors/index.js';

/**
 * GameCreateContext represents the game creation context with game settings.
 */
export class GameCreateContext {
  constructor(
    public readonly gameType: GameType,
    public readonly rounds: RoundsLength,
    public readonly kind: KindOfGame,
    public readonly level: GameLevel,
    public readonly episode: EpisodeContext
  ) {
    this.validateGameType(gameType);
    this.validateRounds(rounds);
    this.validateKind(kind);
    this.validateLevel(level);
    this.validateEpisode(episode);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      gameType: this.gameType,
      rounds: this.rounds,
      kind: this.kind,
      level: this.level.toJSON(),
      episode: this.episode.toJSON()
    };
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

    return new GameCreateContext(
      data.gameType as GameType,
      data.rounds as RoundsLength,
      data.kind as KindOfGame,
      level,
      episode
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
}

