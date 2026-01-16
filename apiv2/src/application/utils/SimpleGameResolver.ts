import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { MoveType } from '../../domain/value-object/Move.js';

/**
 * Utility class for resolving sub-round results.
 */
export class SimpleGameResolver {
  /**
   * Calculates the result of a sub-round based on the moves.
   * Compares moves and determines the winner or if it's a draw.
   * @param subRound - The sub-round to calculate the result for
   */
  static calculateSubRoundResult(subRound: SubRound): void {
    // Implementation to calculate sub-round result
    // This will compare moves and determine winner/draw
    if (subRound.moves.length < 2) {
        // todo: throw error
      throw new Error('Not enough moves to calculate sub-round result');
    }
    // compare moves and determine winner/draw
    const move1 = subRound.moves[0];
    const move2 = subRound.moves[1];
    if (move1.context.moveType === move2.context.moveType) {
      // draw
      subRound.status = SubRoundStatus.Done;
    }
    if (move1.context.moveType === MoveType.Stone && move2.context.moveType === MoveType.Paper) {
      // move2 wins
        subRound.winnerId = move2.userId;
        subRound.status = SubRoundStatus.Done;
    }
    if (move1.context.moveType === MoveType.Paper && move2.context.moveType === MoveType.Scissors) {
      // move2 wins (Scissors beats Paper)
        subRound.winnerId = move2.userId;
        subRound.status = SubRoundStatus.Done;
    }
    if (move1.context.moveType === MoveType.Scissors && move2.context.moveType === MoveType.Stone) {
      // move2 wins (Stone beats Scissors)
        subRound.winnerId = move2.userId;
        subRound.status = SubRoundStatus.Done;
    }
    // Handle reverse cases (move2 first, move1 second)
    if (move2.context.moveType === MoveType.Stone && move1.context.moveType === MoveType.Paper) {
      // move1 wins (Paper beats Stone)
        subRound.winnerId = move1.userId;
        subRound.status = SubRoundStatus.Done;
    }
    if (move2.context.moveType === MoveType.Paper && move1.context.moveType === MoveType.Scissors) {
      // move1 wins (Scissors beats Paper)
        subRound.winnerId = move1.userId;
        subRound.status = SubRoundStatus.Done;
    }
    if (move2.context.moveType === MoveType.Scissors && move1.context.moveType === MoveType.Stone) {
      // move1 wins (Stone beats Scissors)
        subRound.winnerId = move1.userId;
        subRound.status = SubRoundStatus.Done;
    }
  }
}

