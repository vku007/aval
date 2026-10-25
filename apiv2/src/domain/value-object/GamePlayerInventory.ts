import { ValidationError } from '../../shared/errors/index.js';
import { Move, MoveType } from './Move.js';

export const DEFAULT_INVENTORY_AMOUNT = 1000;

const ITEM_KEYS = [
  'stones',
  'scissors',
  'papers',
  'NA_effect_stone',
  'NA_effect_scissors',
  'NA_effect_papers',
  'NT_effect'
] as const;

const CURRENCY_KEYS = ['gold', 'silver', 'copper'] as const;

export type InventoryItemKey = (typeof ITEM_KEYS)[number];
export type InventoryCurrencyKey = (typeof CURRENCY_KEYS)[number];
export type InventoryItems = Record<InventoryItemKey, number>;
export type InventoryCurrencies = Record<InventoryCurrencyKey, number>;
export type GestureItemKey = 'stones' | 'scissors' | 'papers';
export type NaEffectItemKey = 'NA_effect_stone' | 'NA_effect_scissors' | 'NA_effect_papers';

const NA_EFFECT_BY_GESTURE: Record<GestureItemKey, NaEffectItemKey> = {
  stones: 'NA_effect_stone',
  scissors: 'NA_effect_scissors',
  papers: 'NA_effect_papers'
};

/** Starting item stacks for an extended game. Coins stay at the default amount. */
export const ADVANCED_INVENTORY_ITEMS: InventoryItems = {
  stones: 20,
  scissors: 12,
  papers: 10,
  NA_effect_stone: 2,
  NA_effect_scissors: 5,
  NA_effect_papers: 3,
  NT_effect: 3
};

/** Stone, scissors, and papers stacks. Effect stacks are separate. */
export function gestureItemKey(moveType: MoveType): GestureItemKey {
  if (moveType === MoveType.Stone) {
    return 'stones';
  }
  if (moveType === MoveType.Scissors) {
    return 'scissors';
  }
  if (moveType === MoveType.Paper) {
    return 'papers';
  }
  throw new ValidationError(`Invalid moveType: ${moveType}`);
}

/** NA stack spent by a size effect on this gesture. */
export function naEffectItemKey(moveType: MoveType): NaEffectItemKey {
  return NA_EFFECT_BY_GESTURE[gestureItemKey(moveType)];
}

const USER_ID_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

/**
 * One player's stones, papers, scissors, effects, and coins on a game.
 * Counts are non-negative integers. `time` is the last update, in Unix milliseconds.
 */
export class GamePlayerInventory {
  constructor(
    public readonly userId: string,
    public readonly items: InventoryItems,
    public readonly currencies: InventoryCurrencies,
    public readonly time: number
  ) {
    this.validateUserId(userId);
    this.items = GamePlayerInventory.readItems(items);
    this.currencies = GamePlayerInventory.readCurrencies(currencies);
    this.time = GamePlayerInventory.readCount(time, 'time');
  }

  static defaultFor(userId: string, time: number): GamePlayerInventory {
    const items = {} as InventoryItems;
    for (const key of ITEM_KEYS) {
      items[key] = DEFAULT_INVENTORY_AMOUNT;
    }
    return new GamePlayerInventory(userId, items, GamePlayerInventory.defaultCurrencies(), time);
  }

  /** Extended-game start. Both players get these stacks. Coins stay at 1000. */
  static advancedFor(userId: string, time: number): GamePlayerInventory {
    return new GamePlayerInventory(
      userId,
      { ...ADVANCED_INVENTORY_ITEMS },
      GamePlayerInventory.defaultCurrencies(),
      time
    );
  }

  /**
   * Keep provided rows and fill any participant who has none.
   * `fillTime` is used only for those new rows.
   * `fill` is `defaultFor` unless the game is extended, which uses `advancedFor`.
   */
  static ensureForUsers(
    usersIds: string[],
    provided: GamePlayerInventory[] | undefined,
    fillTime: number,
    fill: (userId: string, time: number) => GamePlayerInventory = GamePlayerInventory.defaultFor
  ): GamePlayerInventory[] {
    const byUser = new Map<string, GamePlayerInventory>();
    if (provided !== undefined) {
      if (!Array.isArray(provided)) {
        throw new ValidationError('inventories must be an array');
      }
      provided.forEach((inventory, index) => {
        if (!(inventory instanceof GamePlayerInventory)) {
          throw new ValidationError(`inventories[${index}] must be a GamePlayerInventory`);
        }
        if (!usersIds.includes(inventory.userId)) {
          throw new ValidationError(`Inventory userId '${inventory.userId}' is not a participant`);
        }
        if (byUser.has(inventory.userId)) {
          throw new ValidationError(`Duplicate inventory for userId '${inventory.userId}'`);
        }
        byUser.set(inventory.userId, inventory);
      });
    }

    return usersIds.map(userId => byUser.get(userId) ?? fill(userId, fillTime));
  }

  private static defaultCurrencies(): InventoryCurrencies {
    const currencies = {} as InventoryCurrencies;
    for (const key of CURRENCY_KEYS) {
      currencies[key] = DEFAULT_INVENTORY_AMOUNT;
    }
    return currencies;
  }

  /**
   * Extended-move cost. Does not mutate this inventory.
   * The thrown type loses `size` items.
   * A size effect (NegateSize, Overpower) removes one NA effect of the thrown type.
   * A type effect (Protection, SizeOnly) removes one NT effect.
   */
  spendForMove(move: Move, time: number): GamePlayerInventory {
    const next = { ...this.items };
    const costs = GamePlayerInventory.costsForMove(move);
    for (const key of ITEM_KEYS) {
      const cost = costs[key];
      if (cost === 0) {
        continue;
      }
      if (next[key] < cost) {
        throw new ValidationError(`Not enough ${key} in inventory`, `items.${key}`);
      }
      next[key] -= cost;
    }
    return new GamePlayerInventory(this.userId, next, this.currencies, time);
  }

  toJSON(): {
    userId: string;
    items: InventoryItems;
    currencies: InventoryCurrencies;
    time: number;
  } {
    return {
      userId: this.userId,
      items: { ...this.items },
      currencies: { ...this.currencies },
      time: this.time
    };
  }

  static fromJSON(data: any): GamePlayerInventory {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ValidationError('Invalid inventory data: must be an object');
    }
    if (!data.userId || typeof data.userId !== 'string') {
      throw new ValidationError('Inventory userId is required and must be a string');
    }
    return new GamePlayerInventory(
      data.userId,
      data.items,
      data.currencies,
      data.time
    );
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) {
      throw new ValidationError(
        `Invalid inventory userId: ${userId}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
      );
    }
  }

  private static readItems(data: any): InventoryItems {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ValidationError('Inventory items are required and must be an object');
    }
    const items = {} as InventoryItems;
    for (const key of ITEM_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        throw new ValidationError(`Inventory items.${key} is required`);
      }
      items[key] = this.readCount(data[key], `items.${key}`);
    }
    return items;
  }

  private static readCurrencies(data: any): InventoryCurrencies {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ValidationError('Inventory currencies are required and must be an object');
    }
    const currencies = {} as InventoryCurrencies;
    for (const key of CURRENCY_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        throw new ValidationError(`Inventory currencies.${key} is required`);
      }
      currencies[key] = this.readCount(data[key], `currencies.${key}`);
    }
    return currencies;
  }

  private static costsForMove(move: Move): InventoryItems {
    const costs = {} as InventoryItems;
    for (const key of ITEM_KEYS) {
      costs[key] = 0;
    }

    costs[gestureItemKey(move.context.moveType)] += move.context.size;

    const hasNa = move.context.effects.some(effect => effect.category === 'size');
    const hasNt = move.context.effects.some(effect => effect.category === 'type');
    if (hasNa) {
      costs[naEffectItemKey(move.context.moveType)] += 1;
    }
    if (hasNt) {
      costs.NT_effect += 1;
    }
    return costs;
  }

  private static readCount(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new ValidationError(`${label} must be a non-negative integer`);
    }
    return value;
  }
}
