import { SubRound } from '../../domain/value-object/SubRound.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';

/**
 * Resolves sub-round winners and attaches game-level outcome (rewards).
 */
export interface GameResolver {
  calculateSubRoundResult(subRound: SubRound, outcome: GameOutcome): void;
  addGameOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void;
}
