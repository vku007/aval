import { ValidationError } from '../../shared/errors/index.js';
import {
  CURRENCY_KEYS,
  ITEM_KEYS,
  type InventoryCurrencies,
  type InventoryCurrencyKey,
  type InventoryItemKey,
  type InventoryItems
} from '../value-object/GamePlayerInventory.js';

export type ItemStack = Partial<Record<InventoryItemKey, number>>;
export type CurrencyStack = Partial<Record<InventoryCurrencyKey, number>>;

export type MineProduct = 'stones' | 'scissors' | 'papers' | 'copper';

const ITEM_KEY_SET = new Set<string>(ITEM_KEYS);
const CURRENCY_KEY_SET = new Set<string>(CURRENCY_KEYS);

/** A definition that names any other key fails at load. */
export function assertItemKeys(stack: Record<string, unknown>, label: string): void {
  for (const key of Object.keys(stack)) {
    if (!ITEM_KEY_SET.has(key)) {
      throw new Error(`Campaign definition ${label} names unknown item key '${key}'`);
    }
  }
}

export function assertCurrencyKeys(stack: Record<string, unknown>, label: string): void {
  for (const key of Object.keys(stack)) {
    if (!CURRENCY_KEY_SET.has(key)) {
      throw new Error(`Campaign definition ${label} names unknown currency key '${key}'`);
    }
  }
}

export function unitFor(product: MineProduct): number {
  return product === 'copper' ? 2 : 1;
}

/** Dig pays this many turns of that tile's mine income at once. */
export const DIG_TURNS = 2;

export function positiveItems(stack: ItemStack): ItemStack {
  const items: ItemStack = {};
  for (const key of ITEM_KEYS) {
    const amount = stack[key] ?? 0;
    if (amount > 0) {
      items[key] = amount;
    }
  }
  return items;
}

export function positiveCurrencies(stack: CurrencyStack): CurrencyStack {
  const currencies: CurrencyStack = {};
  for (const key of CURRENCY_KEYS) {
    const amount = stack[key] ?? 0;
    if (amount > 0) {
      currencies[key] = amount;
    }
  }
  return currencies;
}

/**
 * Items and currencies on a campaign instance.
 * Same keys as a game inventory. No userId.
 */
export class CampaignInventory {
  readonly items: InventoryItems;
  readonly currencies: InventoryCurrencies;

  constructor(items: InventoryItems, currencies: InventoryCurrencies) {
    this.items = CampaignInventory.readItems(items);
    this.currencies = CampaignInventory.readCurrencies(currencies);
  }

  static empty(): CampaignInventory {
    return CampaignInventory.fromPartial({}, {});
  }

  static fromPartial(items: ItemStack, currencies: CurrencyStack): CampaignInventory {
    const fullItems = {} as InventoryItems;
    for (const key of ITEM_KEYS) {
      fullItems[key] = items[key] ?? 0;
    }
    const fullCurrencies = {} as InventoryCurrencies;
    for (const key of CURRENCY_KEYS) {
      fullCurrencies[key] = currencies[key] ?? 0;
    }
    return new CampaignInventory(fullItems, fullCurrencies);
  }

  canPayItems(cost: ItemStack): boolean {
    for (const key of ITEM_KEYS) {
      if ((this.items[key] ?? 0) < (cost[key] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  canPayCopper(amount: number): boolean {
    return this.currencies.copper >= amount;
  }

  debitItems(cost: ItemStack): CampaignInventory {
    const next = { ...this.items };
    for (const key of ITEM_KEYS) {
      const amount = cost[key] ?? 0;
      if (amount === 0) {
        continue;
      }
      if (next[key] < amount) {
        throw new ValidationError(`Not enough ${key}`);
      }
      next[key] -= amount;
    }
    return new CampaignInventory(next, this.currencies);
  }

  creditItems(gain: ItemStack): CampaignInventory {
    const next = { ...this.items };
    for (const key of ITEM_KEYS) {
      next[key] += gain[key] ?? 0;
    }
    return new CampaignInventory(next, this.currencies);
  }

  debitCopper(amount: number): CampaignInventory {
    if (this.currencies.copper < amount) {
      throw new ValidationError('Not enough copper');
    }
    return new CampaignInventory(this.items, {
      ...this.currencies,
      copper: this.currencies.copper - amount
    });
  }

  creditCopper(amount: number): CampaignInventory {
    return new CampaignInventory(this.items, {
      ...this.currencies,
      copper: this.currencies.copper + amount
    });
  }

  creditCurrency(key: InventoryCurrencyKey, amount: number): CampaignInventory {
    return new CampaignInventory(this.items, {
      ...this.currencies,
      [key]: this.currencies[key] + amount
    });
  }

  creditProduct(product: MineProduct, amount: number): CampaignInventory {
    if (amount === 0) {
      return this;
    }
    if (product === 'copper') {
      return this.creditCopper(amount);
    }
    return this.creditItems({ [product]: amount });
  }

  addStack(items: ItemStack, currencies: CurrencyStack): CampaignInventory {
    let next = this.creditItems(items);
    for (const key of CURRENCY_KEYS) {
      const amount = currencies[key] ?? 0;
      if (amount !== 0) {
        next = next.creditCurrency(key, amount);
      }
    }
    return next;
  }

  toJSON(): { items: InventoryItems; currencies: InventoryCurrencies } {
    return {
      items: { ...this.items },
      currencies: { ...this.currencies }
    };
  }

  static fromJSON(data: any): CampaignInventory {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid campaign inventory: must be an object');
    }
    return new CampaignInventory(data.items, data.currencies);
  }

  private static readItems(data: InventoryItems): InventoryItems {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Campaign inventory items are required');
    }
    const items = {} as InventoryItems;
    for (const key of ITEM_KEYS) {
      items[key] = readCount(data[key], `items.${key}`);
    }
    return items;
  }

  private static readCurrencies(data: InventoryCurrencies): InventoryCurrencies {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Campaign inventory currencies are required');
    }
    const currencies = {} as InventoryCurrencies;
    for (const key of CURRENCY_KEYS) {
      currencies[key] = readCount(data[key], `currencies.${key}`);
    }
    return currencies;
  }
}

function readCount(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative integer`);
  }
  return value;
}
