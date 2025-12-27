import { GameType } from '../../../domain/value-object/GameType.js';
import { RoundsLength } from '../../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../../domain/value-object/EpisodeContext.js';

/**
 * Immutable request class for creating a game.
 * Represents game settings, not a domain entity.
 */
export class CreateGameRequest {
  constructor(
    public readonly userId: string,
    public readonly gameType: GameType,
    public readonly rounds: RoundsLength,
    public readonly kind: KindOfGame,
    public readonly level: GameLevel,
    public readonly episode: EpisodeContext
  ) {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('userId is required and must be a non-empty string');
    }
    if (!gameType || !Object.values(GameType).includes(gameType)) {
      throw new Error(`gameType must be one of: ${Object.values(GameType).join(', ')}`);
    }
    if (!rounds || !Object.values(RoundsLength).includes(rounds)) {
      throw new Error(`rounds must be one of: ${Object.values(RoundsLength).join(', ')}`);
    }
    if (!kind || !Object.values(KindOfGame).includes(kind)) {
      throw new Error(`kind must be one of: ${Object.values(KindOfGame).join(', ')}`);
    }
    if (!level || !(level instanceof GameLevel)) {
      throw new Error('level is required and must be an instance of GameLevel');
    }
    if (!episode || !(episode instanceof EpisodeContext)) {
      throw new Error('episode is required and must be an instance of EpisodeContext');
    }
  }
}

