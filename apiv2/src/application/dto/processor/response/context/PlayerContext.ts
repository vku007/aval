import { RoundState } from '../../RoundState.js';

/**
 * PlayerContext represents the player context information.
 */
export class PlayerContext {
  constructor(
    public readonly roundStates: RoundState[]
  ) {
    if (!Array.isArray(roundStates)) {
      throw new Error('roundStates must be an array');
    }
    roundStates.forEach((roundState, index) => {
      if (!(roundState instanceof RoundState)) {
        throw new Error(`roundStates[${index}] must be an instance of RoundState`);
      }
    });
  }
}

