import { ValidationError } from '../../../shared/errors/index.js';
import { GameCreateContext } from './GameCreateContext.js';
import { GamePlayerInventory } from '../../../domain/value-object/GamePlayerInventory.js';

/**
 * Immutable request class for creating a game.
 * Represents game settings, not a domain entity.
 */
export class CreateGameRequest {
  constructor(
    public readonly userId: string,
    public readonly gameCreateContext: GameCreateContext,
    public readonly inventories?: GamePlayerInventory[]
  ) {
    this.validateUserId(userId);
    this.validateGameCreateContext(gameCreateContext);
    this.validateInventories(inventories);
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required and must be a non-empty string');
    }
  }

  private validateGameCreateContext(gameCreateContext: GameCreateContext): void {
    if (!gameCreateContext || !(gameCreateContext instanceof GameCreateContext)) {
      throw new ValidationError('gameCreateContext is required and must be an instance of GameCreateContext');
    }
  }

  private validateInventories(inventories?: GamePlayerInventory[]): void {
    if (inventories === undefined) {
      return;
    }
    if (!Array.isArray(inventories)) {
      throw new ValidationError('inventories must be an array');
    }
    inventories.forEach((inventory, index) => {
      if (!(inventory instanceof GamePlayerInventory)) {
        throw new ValidationError(`inventories[${index}] must be a GamePlayerInventory`);
      }
    });
  }
}

