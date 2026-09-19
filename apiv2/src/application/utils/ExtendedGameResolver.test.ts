import { describe, it, expect } from 'vitest';
import { ExtendedGameResolver } from './ExtendedGameResolver.js';
import { SimpleGameOutcomeResolver } from './SimpleGameOutcomeResolver.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { MoveEffect, MoveEffectKind } from '../../domain/value-object/MoveEffect.js';

describe('ExtendedGameResolver.calculateSubRoundResult', () => {
  const resolver = new ExtendedGameResolver(new SimpleGameOutcomeResolver());
  const USER_1 = 'user-1';
  const USER_2 = 'user-2';

  function subRoundWithMoves(
    type1: MoveType,
    size1: number,
    type2: MoveType,
    size2: number,
    effects1: MoveEffect[] = [],
    effects2: MoveEffect[] = []
  ): SubRound {
    const now = Date.now();
    const subRound = new SubRound(1, now, null, now);
    subRound.moves = [
      new Move(USER_1, new MoveContext(type1, size1, 0, effects1), now),
      new Move(USER_2, new MoveContext(type2, size2, 0, effects2), now),
    ];
    return subRound;
  }

  function effect(kind: MoveEffectKind): MoveEffect[] {
    return [new MoveEffect(kind)];
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

  describe('effects (actor is USER_1)', () => {
    it('NegateSize: same type different sizes is a draw', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 8, MoveType.Stone, 3, effect(MoveEffectKind.NegateSize)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBeUndefined();
    });

    it('NegateSize: different types still use RPS', () => {
      const subRound = subRoundWithMoves(
        MoveType.Paper, 1, MoveType.Stone, 100, effect(MoveEffectKind.NegateSize)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_1);
    });

    it('Overpower: same type wins even with a smaller size', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 1, MoveType.Stone, 9, effect(MoveEffectKind.Overpower)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_1);
    });

    it('Overpower: unused when types differ', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 9, MoveType.Paper, 1, effect(MoveEffectKind.Overpower)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_2);
    });

    it('Protection: type loss becomes a draw', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 5, MoveType.Paper, 1, effect(MoveEffectKind.Protection)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBeUndefined();
    });

    it('Protection: type win is still a win', () => {
      const subRound = subRoundWithMoves(
        MoveType.Paper, 1, MoveType.Stone, 9, effect(MoveEffectKind.Protection)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_1);
    });

    it('Protection: does not change a size loss', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 1, MoveType.Stone, 9, effect(MoveEffectKind.Protection)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_2);
    });

    it('SizeOnly: different types compare size', () => {
      const subRound = subRoundWithMoves(
        MoveType.Paper, 1, MoveType.Stone, 100, effect(MoveEffectKind.SizeOnly)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_2);
    });

    it('SizeOnly + Overpower: actor wins regardless of type or size', () => {
      const subRound = subRoundWithMoves(
        MoveType.Paper,
        1,
        MoveType.Stone,
        100,
        [new MoveEffect(MoveEffectKind.SizeOnly), new MoveEffect(MoveEffectKind.Overpower)]
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_1);
    });

    it('SizeOnly + NegateSize: different types become a draw', () => {
      const subRound = subRoundWithMoves(
        MoveType.Paper,
        1,
        MoveType.Stone,
        100,
        [new MoveEffect(MoveEffectKind.SizeOnly), new MoveEffect(MoveEffectKind.NegateSize)]
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBeUndefined();
    });

    it('Protection + Overpower: type loss is still a draw', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone,
        1,
        MoveType.Paper,
        9,
        [new MoveEffect(MoveEffectKind.Protection), new MoveEffect(MoveEffectKind.Overpower)]
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBeUndefined();
    });

    it('Protection + Overpower: same type smaller size wins', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone,
        1,
        MoveType.Stone,
        9,
        [new MoveEffect(MoveEffectKind.Protection), new MoveEffect(MoveEffectKind.Overpower)]
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_1);
    });

    it('Protection + NegateSize: same type is a draw', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone,
        8,
        MoveType.Stone,
        3,
        [new MoveEffect(MoveEffectKind.Protection), new MoveEffect(MoveEffectKind.NegateSize)]
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBeUndefined();
    });

    it('Overpower on USER_2: smaller size still wins', () => {
      const subRound = subRoundWithMoves(
        MoveType.Stone, 9, MoveType.Stone, 1, [], effect(MoveEffectKind.Overpower)
      );
      resolver.calculateSubRoundResult(subRound, new GameOutcome());
      expect(subRound.winnerId).toBe(USER_2);
    });
  });
});
