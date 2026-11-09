import { GamePlayerInventory } from '../../../../../domain/value-object/GamePlayerInventory.js';

/**
 * Enemy context on the player payload.
 * An extended game against one NPC includes that NPC's inventory.
 * A classic game, or a game against a person, leaves it empty.
 */
export class EnemyContext {
  constructor(
    public readonly inventory?: GamePlayerInventory
  ) {
    if (inventory !== undefined && !(inventory instanceof GamePlayerInventory)) {
      throw new Error('inventory must be an instance of GamePlayerInventory');
    }
  }

  toJSON(): { inventory?: ReturnType<GamePlayerInventory['toJSON']> } {
    if (!this.inventory) {
      return {};
    }
    return { inventory: this.inventory.toJSON() };
  }
}
