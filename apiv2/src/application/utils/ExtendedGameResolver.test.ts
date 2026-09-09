import { describe, it, expect } from 'vitest';
import { ExtendedGameResolver } from './ExtendedGameResolver.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';

describe('ExtendedGameResolver.calculateSubRoundResult', () => {
  const resolver = new ExtendedGameResolver(new SimpleGameOutcomeResolver());
  const USER_1 = 'user-1';
  const USER_2 = 'user-2';

  function subRoundWithMoves(
    type1: MoveType,
    size1: number,
    type2: MoveType,
    size2: number
  ): SubRound {
    const now = Date.now();
    const subRound = new SubRound(1, now, null, now);
    subRound.moves = [
      new Move(USER_1, new MoveContext(type1, size1, 0), now),
      new Move(USER_2, new MoveContext(type2, size2, 0), now),
    ];
    return subRound;
  }

  it('same type + larger size wins', () => {
    const subRound = subRoundWithMoves(MoveType.Stone, 8, MoveType.Stone, 3);
    resolver.calculateSubRoundResult(subRound, new GameOutcome());

    expect(subRound.status).toBe(SubRoundStatus.Done);
    expect(subRound.winnerId).toBe(USER_1);
  });

  it('same type + smaller first size loses', () => {
    const subRound = subRoundWithMoves(MoveType.Paper, 1, MoveType.Paper, 9);
    resolver.calculateSubRoundResult(subRound, new GameOutcome());

    expect(subRound.status).toBe(SubRoundStatus.Done);
    expect(subRound.winnerId).toBe(USER_2);
  });

  it('same type + equal size is a draw (no winnerId)', () => {
    const subRound = subRoundWithMoves(MoveType.Scissors, 5, MoveType.Scissors, 5);
    resolver.calculateSubRoundResult(subRound, new GameOutcome());

    expect(subRound.status).toBe(SubRoundStatus.Done);
    expect(subRound.winnerId).toBeUndefined();
  });

  it('different types ignore size (Paper 1 beats Stone 100)', () => {
    const subRound = subRoundWithMoves(MoveType.Paper, 1, MoveType.Stone, 100);
    resolver.calculateSubRoundResult(subRound, new GameOutcome());

    expect(subRound.status).toBe(SubRoundStatus.Done);
    expect(subRound.winnerId).toBe(USER_1);
  });

  it('different types ignore size (Stone 100 loses to Paper 1)', () => {
    const subRound = subRoundWithMoves(MoveType.Stone, 100, MoveType.Paper, 1);
    resolver.calculateSubRoundResult(subRound, new GameOutcome());

    expect(subRound.winnerId).toBe(USER_2);
  });

  it('throws when fewer than two moves', () => {
    const now = Date.now();
    const subRound = new SubRound(1, now, null, now);

    expect(() => resolver.calculateSubRoundResult(subRound, new GameOutcome())).toThrow(
      'Not enough moves to calculate sub-round result'
    );
  });
});
