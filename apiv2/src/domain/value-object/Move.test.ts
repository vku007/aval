import { describe, it, expect } from 'vitest';
import { MoveContext, MoveType } from './Move.js';
import { MoveEffect, MoveEffectKind } from './MoveEffect.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('MoveEffect', () => {
  it('round-trips known kinds', () => {
    const effect = new MoveEffect(MoveEffectKind.Overpower);
    expect(MoveEffect.fromJSON(effect.toJSON()).kind).toBe(MoveEffectKind.Overpower);
  });

  it('rejects unknown kind', () => {
    expect(() => MoveEffect.fromJSON({ kind: 'Invisible' })).toThrow(ValidationError);
  });
});

describe('MoveContext effects', () => {
  it('defaults omitted effects to empty', () => {
    const context = MoveContext.fromJSON({
      moveType: MoveType.Stone,
      size: 3,
      decorId: 0
    });

    expect(context.effects).toEqual([]);
    expect(context.toJSON()).toEqual({
      moveType: MoveType.Stone,
      size: 3,
      decorId: 0,
      effects: []
    });
  });

  it('accepts one size effect and one type effect', () => {
    const context = new MoveContext(MoveType.Paper, 2, 0, [
      new MoveEffect(MoveEffectKind.Overpower),
      new MoveEffect(MoveEffectKind.Protection)
    ]);

    expect(context.hasKind(MoveEffectKind.Overpower)).toBe(true);
    expect(context.hasKind(MoveEffectKind.Protection)).toBe(true);
  });

  it('rejects two size-category effects', () => {
    expect(() => new MoveContext(MoveType.Stone, 1, 0, [
      new MoveEffect(MoveEffectKind.NegateSize),
      new MoveEffect(MoveEffectKind.Overpower)
    ])).toThrow(/at most one size-category/);
  });

  it('rejects two type-category effects', () => {
    expect(() => new MoveContext(MoveType.Stone, 1, 0, [
      new MoveEffect(MoveEffectKind.Protection),
      new MoveEffect(MoveEffectKind.SizeOnly)
    ])).toThrow(/at most one type-category/);
  });

  it('rejects duplicate kinds', () => {
    expect(() => new MoveContext(MoveType.Stone, 1, 0, [
      new MoveEffect(MoveEffectKind.Overpower),
      new MoveEffect(MoveEffectKind.Overpower)
    ])).toThrow(/duplicate kind/);
  });

  it('rejects a non-array effects field', () => {
    expect(() => MoveContext.fromJSON({
      moveType: MoveType.Stone,
      size: 1,
      decorId: 0,
      effects: { kind: 'Overpower' }
    })).toThrow(/effects must be an array/);
  });
});
