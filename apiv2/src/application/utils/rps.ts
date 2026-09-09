import { Move, MoveType } from '../../domain/value-object/Move.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';

/**
 * True when type A beats type B in Classic RPS. Same types are not a win.
 */
export function beats(a: MoveType, b: MoveType): boolean {
  return (
    (a === MoveType.Stone && b === MoveType.Scissors) ||
    (a === MoveType.Paper && b === MoveType.Stone) ||
    (a === MoveType.Scissors && b === MoveType.Paper)
  );
}

/**
 * Winner by MoveType only. Returns null when types are equal (caller decides draw vs size).
 */
export function rpsWinnerUserId(move1: Move, move2: Move): string | null {
  if (move1.context.moveType === move2.context.moveType) {
    return null;
  }
  if (beats(move1.context.moveType, move2.context.moveType)) {
    return move1.userId;
  }
  if (beats(move2.context.moveType, move1.context.moveType)) {
    return move2.userId;
  }
  return null;
}

/**
 * Marks the sub-round done and records round outcome. winnerId null means draw.
 */
export function applySubRoundOutcome(
  subRound: SubRound,
  outcome: GameOutcome,
  outcomeResolver: SimpleGameOutcomeResolver,
  winnerId: string | null
): void {
  const move1 = subRound.moves[0];
  const move2 = subRound.moves[1];
  subRound.status = SubRoundStatus.Done;
  if (winnerId) {
    subRound.winnerId = winnerId;
  }
  outcomeResolver.addRoundOutcome(outcome, move1.userId, move1.userId === winnerId);
  outcomeResolver.addRoundOutcome(outcome, move2.userId, move2.userId === winnerId);
}

export function requireTwoMoves(subRound: SubRound): [Move, Move] {
  if (subRound.moves.length < 2) {
    throw new Error('Not enough moves to calculate sub-round result');
  }
  return [subRound.moves[0], subRound.moves[1]];
}
