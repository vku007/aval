import { SubRound } from '../../domain/value-object/SubRound.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';
import type { GameResolver } from './GameResolver.js';
import { applySubRoundOutcome, requireTwoMoves, rpsWinnerUserId } from './rps.js';

/**
 * Extended resolver: RPS by MoveType; when types match, higher size wins, equal size is a draw.
 */
export class ExtendedGameResolver implements GameResolver {
  constructor(public readonly outcomeResolver: SimpleGameOutcomeResolver) {}

  calculateSubRoundResult(subRound: SubRound, outcome: GameOutcome): void {
    const [move1, move2] = requireTwoMoves(subRound);
    let winnerId: string | null;
    if (move1.context.moveType === move2.context.moveType) {
      if (move1.context.size > move2.context.size) {
        winnerId = move1.userId;
      } else if (move2.context.size > move1.context.size) {
        winnerId = move2.userId;
      } else {
        winnerId = null;
      }
    } else {
      winnerId = rpsWinnerUserId(move1, move2);
    }
    applySubRoundOutcome(subRound, outcome, this.outcomeResolver, winnerId);
  }

  addGameOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void {
    this.outcomeResolver.addGameOutcome(outcome, userId, isWinner);
  }
}
