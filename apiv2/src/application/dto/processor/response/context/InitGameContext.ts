import { GameType } from '../../../../../domain/value-object/GameType.js';
import { RoundsLength } from '../../../../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../../../../domain/value-object/KindOfGame.js';
import { ValidationError } from '../../../../../shared/errors/index.js';
import { GameCreateContext } from '../../GameCreateContext.js';

/**
 * InitGameContext represents the initial game creation context.
 * This is a presentation object for the GameCreateContext domain object.
 */
export class InitGameContext {
  constructor(
    public readonly gameType: GameType,
    public readonly rounds: RoundsLength,
    public readonly kind: KindOfGame,
    public readonly level: { name: string },
    public readonly episode: { name: string }
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
      level: this.level,
      episode: this.episode
    };
  }

  /**
   * Create a new InitGameContext from JSON data
   */
  static fromJSON(data: any): InitGameContext {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid init game context data: must be an object');
    }

    if (!data.gameType || typeof data.gameType !== 'string') {
      throw new ValidationError('InitGameContext gameType is required and must be a string');
    }
    if (!Object.values(GameType).includes(data.gameType as GameType)) {
      throw new ValidationError(`Invalid gameType: ${data.gameType}. Must be one of: ${Object.values(GameType).join(', ')}`);
    }

    if (!data.rounds || typeof data.rounds !== 'string') {
      throw new ValidationError('InitGameContext rounds is required and must be a string');
    }
    if (!Object.values(RoundsLength).includes(data.rounds as RoundsLength)) {
      throw new ValidationError(`Invalid rounds: ${data.rounds}. Must be one of: ${Object.values(RoundsLength).join(', ')}`);
    }

    if (!data.kind || typeof data.kind !== 'string') {
      throw new ValidationError('InitGameContext kind is required and must be a string');
    }
    if (!Object.values(KindOfGame).includes(data.kind as KindOfGame)) {
      throw new ValidationError(`Invalid kind: ${data.kind}. Must be one of: ${Object.values(KindOfGame).join(', ')}`);
    }

    if (!data.level || typeof data.level !== 'object') {
      throw new ValidationError('InitGameContext level is required and must be an object');
    }
    if (!data.level.name || typeof data.level.name !== 'string') {
      throw new ValidationError('InitGameContext level.name is required and must be a string');
    }

    if (!data.episode || typeof data.episode !== 'object') {
      throw new ValidationError('InitGameContext episode is required and must be an object');
    }
    if (!data.episode.name || typeof data.episode.name !== 'string') {
      throw new ValidationError('InitGameContext episode.name is required and must be a string');
    }

    return new InitGameContext(
      data.gameType as GameType,
      data.rounds as RoundsLength,
      data.kind as KindOfGame,
      { name: data.level.name },
      { name: data.episode.name }
    );
  }

  /**
   * Create InitGameContext from GameCreateContext domain object
   */
  static fromGameCreateContext(gameCreateContext: GameCreateContext): InitGameContext {
    return new InitGameContext(
      gameCreateContext.gameType,
      gameCreateContext.rounds,
      gameCreateContext.kind,
      { name: gameCreateContext.level.name },
      { name: gameCreateContext.episode.name }
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

  private validateLevel(level: { name: string }): void {
    if (!level || typeof level !== 'object') {
      throw new ValidationError('level is required and must be an object');
    }
    if (!level.name || typeof level.name !== 'string' || level.name.trim().length === 0) {
      throw new ValidationError('level.name is required and must be a non-empty string');
    }
  }

  private validateEpisode(episode: { name: string }): void {
    if (!episode || typeof episode !== 'object') {
      throw new ValidationError('episode is required and must be an object');
    }
    if (!episode.name || typeof episode.name !== 'string' || episode.name.trim().length === 0) {
      throw new ValidationError('episode.name is required and must be a non-empty string');
    }
  }
}

