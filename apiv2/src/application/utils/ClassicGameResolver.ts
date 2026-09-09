import { SubRound } from '../../domain/value-object/SubRound.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';
import type { GameResolver } from './GameResolver.js';
import { applySubRoundOutcome, requireTwoMoves, rpsWinnerUserId } from './rps.js';

/**
 * Classic resolver: RPS by MoveType. Same types are always a draw; size is ignored.
 */
export class ClassicGameResolver implements GameResolver {
  constructor(public readonly outcomeResolver: SimpleGameOutcomeResolver) {}

  calculateSubRoundResult(subRound: SubRound, outcome: GameOutcome): void {
    const [move1, move2] = requireTwoMoves(subRound);
    const winnerId =
      move1.context.moveType === move2.context.moveType
        ? null
        : rpsWinnerUserId(move1, move2);
    applySubRoundOutcome(subRound, outcome, this.outcomeResolver, winnerId);
  }

  addGameOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void {
    this.outcomeResolver.addGameOutcome(outcome, userId, isWinner);
  }
}
