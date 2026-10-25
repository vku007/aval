import { RoundState } from '../../RoundState.js';
import { GamePlayerInventory } from '../../../../../domain/value-object/GamePlayerInventory.js';

/**
 * PlayerContext represents the player context information.
 */
export class PlayerContext {
  constructor(
    public readonly roundStates: RoundState[],
    public readonly inventory: GamePlayerInventory
  ) {
    if (!Array.isArray(roundStates)) {
      throw new Error('roundStates must be an array');
    }
    roundStates.forEach((roundState, index) => {
      if (!(roundState instanceof RoundState)) {
        throw new Error(`roundStates[${index}] must be an instance of RoundState`);
      }
    });
    if (!(inventory instanceof GamePlayerInventory)) {
      throw new Error('inventory is required and must be an instance of GamePlayerInventory');
    }
  }
}

