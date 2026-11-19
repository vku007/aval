import { DIG_TURNS, unitFor, type ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import {
  effectiveDefenderKit,
  effectiveReward,
  tileRounds
} from '@apiv2/domain/campaign/ChapterDefinitionBuilder.js';
import type { ChapterSettings, RewardSettings, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { neighborsOnMap } from '@apiv2/domain/campaign/Hex.js';
import type { TileRounds } from '@apiv2/domain/campaign/Tile.js';
import { ITEM_KEYS, type InventoryItemKey } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { cellKey, type Cell } from './document.js';

export interface KitDelta {
  key: InventoryItemKey;
  delta: number;
}

export interface TileFacts {
  incomePerTurn: number | 'never-pays';
  digYield: number;
  digNet: number | null;
  rounds: TileRounds | null;
  reward: RewardSettings;
  rewardIsDefault: boolean;
  kit: ItemStack;
  kitIsDefault: boolean;
  kitDiff: KitDelta[];
}

export type StartVisibility = 'owned' | 'seen' | 'hidden';

export interface KitUsage {
  defaultCount: number;
  customCells: Cell[];
}

export function tileFacts(settings: ChapterSettings, cell: Cell): TileFacts {
  const tile = tileAt(settings, cell);
  const unit = unitFor(tile.product);
  const digYield = DIG_TURNS * tile.mines * unit;
  const kit = effectiveDefenderKit(settings, tile);
  return {
    incomePerTurn: tile.objective === true ? 'never-pays' : tile.mines * unit,
    digYield,
    digNet: tile.product === 'copper' ? digYield - settings.rules.digCost : null,
    rounds: tileRounds(settings, tile),
    reward: cloneReward(effectiveReward(settings, tile)),
    rewardIsDefault: tile.reward === undefined,
    kit,
    kitIsDefault: tile.defenderKit === undefined,
    kitDiff: kitDelta(kit, difficultyKit(settings, tile))
  };
}

/** `q,r` → fog at turn 0. Owned wins over revealed. */
export function startView(settings: ChapterSettings): Record<string, StartVisibility> {
  const view: Record<string, StartVisibility> = {};
  for (const tile of settings.tiles) {
    view[cellKey(tile)] = tile.owner === 'player' ? 'owned' : tile.revealed ? 'seen' : 'hidden';
  }
  return view;
}

/**
 * Hidden cells capture would reveal, matching `Campaign.capture`.
 * The cell itself comes first when it is hidden, then hidden neighbors in `NEIGHBOR_DELTAS` order.
 */
export function revealedBy(settings: ChapterSettings, cell: Cell): Cell[] {
  const hidden = new Set(
    settings.tiles.filter(tile => tile.revealed === false).map(tile => cellKey(tile))
  );
  const found: Cell[] = [];
  if (hidden.has(cellKey(cell))) found.push({ q: cell.q, r: cell.r });
  for (const neighbor of neighborsOnMap(cell.q, cell.r)) {
    if (hidden.has(cellKey(neighbor))) found.push({ q: neighbor.q, r: neighbor.r });
  }
  return found;
}

export function kitUsage(settings: ChapterSettings): Record<'easy' | 'normal' | 'hard', KitUsage> {
  const usage: Record<'easy' | 'normal' | 'hard', KitUsage> = {
    easy: { defaultCount: 0, customCells: [] },
    normal: { defaultCount: 0, customCells: [] },
    hard: { defaultCount: 0, customCells: [] }
  };
  for (const tile of settings.tiles) {
    if (tile.difficulty === null) continue;
    const bucket = usage[tile.difficulty];
    if (tile.defenderKit) bucket.customCells.push({ q: tile.q, r: tile.r });
    else bucket.defaultCount += 1;
  }
  return usage;
}

export function mixedValue<K extends keyof TileSettings>(
  tiles: readonly TileSettings[],
  field: K
): TileSettings[K] | 'mixed' {
  const first = tiles[0];
  if (!first) return 'mixed';
  const value = first[field];
  for (const tile of tiles.slice(1)) {
    if (!sameValue(tile[field], value)) return 'mixed';
  }
  return value;
}

function tileAt(settings: ChapterSettings, cell: Cell): TileSettings {
  const tile = settings.tiles.find(item => item.q === cell.q && item.r === cell.r);
  if (!tile) throw new Error(`No tile at ${cell.q},${cell.r}`);
  return tile;
}

function difficultyKit(settings: ChapterSettings, tile: TileSettings): ItemStack {
  if (tile.difficulty === null) return {};
  return settings.defenderKits[tile.difficulty];
}

function kitDelta(kit: ItemStack, base: ItemStack): KitDelta[] {
  const deltas: KitDelta[] = [];
  for (const key of ITEM_KEYS) {
    const delta = (kit[key] ?? 0) - (base[key] ?? 0);
    if (delta !== 0) deltas.push({ key, delta });
  }
  return deltas;
}

function cloneReward(reward: RewardSettings): RewardSettings {
  return { items: { ...reward.items }, currencies: { ...reward.currencies } };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!sameValue(left[key], right[key])) return false;
  }
  return true;
}
