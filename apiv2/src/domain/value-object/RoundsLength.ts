/**
 * RoundsLength enum represents the number of rounds in a game.
 * BO1 - Best of 1
 * BO3 - Best of 3
 * BO7 - Best of 7
 */
export enum RoundsLength {
  BO1 = 'BO1',
  BO3 = 'BO3',
  BO7 = 'BO7'
}

/**
 * Namespace for RoundsLength enum methods
 */
export namespace RoundsLength {
  /**
   * Returns the amount of possible rounds for a given RoundsLength
   * @param roundsLength - The RoundsLength enum value
   * @returns The number of possible rounds
   */
  export function amtRounds(roundsLength: RoundsLength): number {
    switch (roundsLength) {
      case RoundsLength.BO1:
        return 1;
      case RoundsLength.BO3:
        return 3;
      case RoundsLength.BO7:
        return 7;
      default:
        throw new Error(`Unknown RoundsLength: ${roundsLength}`);
    }
  }
}

