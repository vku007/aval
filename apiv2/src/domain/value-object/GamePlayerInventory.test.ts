import { describe, it, expect } from 'vitest';
import {
  ADVANCED_INVENTORY_ITEMS,
  DEFAULT_INVENTORY_AMOUNT,
  GamePlayerInventory
} from './GamePlayerInventory.js';
import { ValidationError } from '../../shared/errors/index.js';
import { Move, MoveContext, MoveType } from './Move.js';
import { MoveEffect, MoveEffectKind } from './MoveEffect.js';

describe('GamePlayerInventory', () => {
  it('should default every amount to 1000', () => {
    const inventory = GamePlayerInventory.defaultFor('user-1', 7);
    expect(inventory.userId).toBe('user-1');
    expect(inventory.time).toBe(7);
    expect(inventory.items.stones).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventory.items.NT_effect).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventory.currencies.copper).toBe(DEFAULT_INVENTORY_AMOUNT);
  });

  it('should start an advanced inventory with the extended stacks and default coins', () => {
    const inventory = GamePlayerInventory.advancedFor('user-1', 7);
    expect(inventory.items).toEqual(ADVANCED_INVENTORY_ITEMS);
    expect(inventory.items).toEqual({
      stones: 21,
      scissors: 12,
      papers: 12,
      NA_effect_stone: 3,
      NA_effect_scissors: 2,
      NA_effect_papers: 5,
      NT_effect: 3
    });
    expect(inventory.currencies.gold).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventory.currencies.silver).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventory.currencies.copper).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventory.time).toBe(7);
  });

  it('should reject a missing item key and a negative count', () => {
    const sample = GamePlayerInventory.defaultFor('user-1', 1).toJSON();
    const items = { ...sample.items };
    delete (items as { stones?: number }).stones;
    expect(() => GamePlayerInventory.fromJSON({ ...sample, items })).toThrow(ValidationError);
    expect(() => GamePlayerInventory.fromJSON({
      ...sample,
      currencies: { ...sample.currencies, gold: -1 }
    })).toThrow(ValidationError);
    expect(() => GamePlayerInventory.fromJSON({ ...sample, time: 1.5 })).toThrow(ValidationError);
  });

  it('should keep provided rows and fill missing participants', () => {
    const provided = new GamePlayerInventory(
      'user-1',
      { ...GamePlayerInventory.defaultFor('user-1', 1).items, stones: 3 },
      GamePlayerInventory.defaultFor('user-1', 1).currencies,
      4
    );
    const inventories = GamePlayerInventory.ensureForUsers(
      ['user-1', 'NPC_1'],
      [provided],
      99
    );
    expect(inventories[0].items.stones).toBe(3);
    expect(inventories[0].time).toBe(4);
    expect(inventories[1].userId).toBe('NPC_1');
    expect(inventories[1].items.papers).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(inventories[1].time).toBe(99);
  });

  it('should reject an unknown user and a duplicate user', () => {
    const stranger = GamePlayerInventory.defaultFor('other', 1);
    expect(() => GamePlayerInventory.ensureForUsers(['user-1'], [stranger], 0)).toThrow(ValidationError);
    const one = GamePlayerInventory.defaultFor('user-1', 1);
    const two = GamePlayerInventory.defaultFor('user-1', 2);
    expect(() => GamePlayerInventory.ensureForUsers(['user-1'], [one, two], 0)).toThrow(ValidationError);
  });

  function move(moveType: MoveType, size: number, kinds: MoveEffectKind[] = []): Move {
    return new Move(
      'user-1',
      new MoveContext(moveType, size, 0, kinds.map(kind => new MoveEffect(kind))),
      50
    );
  }

  function withItems(patch: Partial<GamePlayerInventory['items']>): GamePlayerInventory {
    const base = GamePlayerInventory.defaultFor('user-1', 3);
    return new GamePlayerInventory('user-1', { ...base.items, ...patch }, base.currencies, 3);
  }

  it('should remove the thrown size and leave effects untouched', () => {
    const inventory = withItems({ stones: 5 });
    const next = inventory.spendForMove(move(MoveType.Stone, 3), 9);

    expect(next.items.stones).toBe(2);
    expect(next.items.NA_effect_stone).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(next.items.NT_effect).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(next.currencies.gold).toBe(DEFAULT_INVENTORY_AMOUNT);
    expect(next.time).toBe(9);
    expect(inventory.items.stones).toBe(5);
    expect(inventory.time).toBe(3);
  });

  it('should remove only the NA effect of the thrown type when a size effect is used', () => {
    const inventory = withItems({
      scissors: 4,
      NA_effect_stone: 2,
      NA_effect_scissors: 5,
      NA_effect_papers: 3
    });
    const next = inventory.spendForMove(move(MoveType.Scissors, 1, [MoveEffectKind.Overpower]), 9);

    expect(next.items.scissors).toBe(3);
    expect(next.items.NA_effect_stone).toBe(2);
    expect(next.items.NA_effect_scissors).toBe(4);
    expect(next.items.NA_effect_papers).toBe(3);
    expect(next.items.NT_effect).toBe(DEFAULT_INVENTORY_AMOUNT);
  });

  it('should remove one NT effect when a type effect is used', () => {
    const inventory = withItems({ scissors: 4, NT_effect: 2 });
    const next = inventory.spendForMove(move(MoveType.Scissors, 2, [MoveEffectKind.SizeOnly]), 9);

    expect(next.items.scissors).toBe(2);
    expect(next.items.NT_effect).toBe(1);
    expect(next.items.NA_effect_stone).toBe(DEFAULT_INVENTORY_AMOUNT);
  });

  it('should charge both effect groups when both are used', () => {
    const inventory = withItems({
      stones: 6,
      NA_effect_stone: 3,
      NA_effect_scissors: 3,
      NA_effect_papers: 3,
      NT_effect: 4
    });
    const next = inventory.spendForMove(
      move(MoveType.Stone, 2, [MoveEffectKind.NegateSize, MoveEffectKind.Protection]),
      9
    );

    expect(next.items.stones).toBe(4);
    expect(next.items.NA_effect_stone).toBe(2);
    expect(next.items.NA_effect_scissors).toBe(3);
    expect(next.items.NA_effect_papers).toBe(3);
    expect(next.items.NT_effect).toBe(3);
  });

  it('should reject a move the inventory cannot pay for', () => {
    const shortStones = withItems({ stones: 1 });
    expect(() => shortStones.spendForMove(move(MoveType.Stone, 2), 9)).toThrow(/Not enough stones/);
    expect(shortStones.items.stones).toBe(1);

    const shortNa = withItems({ NA_effect_scissors: 0, NA_effect_stone: 2, NA_effect_papers: 2 });
    expect(() => shortNa.spendForMove(move(MoveType.Scissors, 1, [MoveEffectKind.NegateSize]), 9))
      .toThrow(/Not enough NA_effect_scissors/);
    expect(shortNa.items.NA_effect_stone).toBe(2);
    expect(shortNa.items.NA_effect_papers).toBe(2);

    const shortNt = withItems({ NT_effect: 0 });
    expect(() => shortNt.spendForMove(move(MoveType.Paper, 1, [MoveEffectKind.Protection]), 9))
      .toThrow(/Not enough NT_effect/);
  });
});
