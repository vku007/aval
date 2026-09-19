import { SubRound } from '../../domain/value-object/SubRound.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { Move } from '../../domain/value-object/Move.js';
import { MoveEffectKind } from '../../domain/value-object/MoveEffect.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';
import type { GameResolver } from './GameResolver.js';
import { applySubRoundOutcome, requireTwoMoves, rpsWinnerUserId } from './rps.js';

/**
 * Extended resolver: RPS by MoveType; when types match, higher size wins, equal size is a draw.
 * Optional MoveContext.effects on one throw can alter type and/or size comparison.
 */
export class ExtendedGameResolver implements GameResolver {
  constructor(public readonly outcomeResolver: SimpleGameOutcomeResolver) {}

  calculateSubRoundResult(subRound: SubRound, outcome: GameOutcome): void {
    const [move1, move2] = requireTwoMoves(subRound);
    const actor = this.pickEffectActor(move1, move2);
    const winnerId = actor
      ? this.winnerWithEffects(actor, actor === move1 ? move2 : move1)
      : this.defaultWinner(move1, move2);
    applySubRoundOutcome(subRound, outcome, this.outcomeResolver, winnerId);
  }

  addGameOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void {
    this.outcomeResolver.addGameOutcome(outcome, userId, isWinner);
  }

  private pickEffectActor(move1: Move, move2: Move): Move | null {
    const firstHasEffects = move1.context.effects.length > 0;
    const secondHasEffects = move2.context.effects.length > 0;
    if (firstHasEffects && !secondHasEffects) {
      return move1;
    }
    if (secondHasEffects && !firstHasEffects) {
      return move2;
    }
    return null;
  }

  private defaultWinner(move1: Move, move2: Move): string | null {
    if (move1.context.moveType === move2.context.moveType) {
      return this.sizeWinner(move1, move2);
    }
    return rpsWinnerUserId(move1, move2);
  }

  private winnerWithEffects(actor: Move, opponent: Move): string | null {
    const sizeOnly = actor.context.hasKind(MoveEffectKind.SizeOnly);
    const typesEqual = actor.context.moveType === opponent.context.moveType;
    if (!sizeOnly && !typesEqual) {
      const typeWinner = rpsWinnerUserId(actor, opponent);
      if (typeWinner === opponent.userId && actor.context.hasKind(MoveEffectKind.Protection)) {
        return null;
      }
      return typeWinner;
    }
    if (actor.context.hasKind(MoveEffectKind.NegateSize)) {
      return null;
    }
    if (actor.context.hasKind(MoveEffectKind.Overpower)) {
      return actor.userId;
    }
    return this.sizeWinner(actor, opponent);
  }

  private sizeWinner(move1: Move, move2: Move): string | null {
    if (move1.context.size > move2.context.size) {
      return move1.userId;
    }
    if (move2.context.size > move1.context.size) {
      return move2.userId;
    }
    return null;
  }
}
