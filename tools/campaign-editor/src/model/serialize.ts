import type { CurrencyStack, ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import {
  safeParseChapterSettings,
  type ChapterSettings,
  type RewardSettings,
  type TileSettings
} from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { NPC_ALGORITHM_V1 } from '@apiv2/domain/campaign/Garrison.js';
import {
  CURRENCY_KEYS,
  ITEM_KEYS,
  type InventoryCurrencyKey,
  type InventoryItemKey
} from '@apiv2/domain/value-object/GamePlayerInventory.js';

const TILE_COUNT = 19;
const ITEM_KEY_SET = new Set<string>(ITEM_KEYS);
const CURRENCY_KEY_SET = new Set<string>(CURRENCY_KEYS);

export interface ChapterIssue {
  path: (string | number)[];
  message: string;
}

export type ReadChapterResult =
  | { ok: true; settings: ChapterSettings }
  | { ok: false; issues: ChapterIssue[] };

export function serializeChapter(settings: ChapterSettings): string {
  const text = {
    id: settings.id,
    title: settings.title,
    goal: settings.goal,
    rulesetVersion: settings.rulesetVersion,
    tileCount: TILE_COUNT,
    rules: writeRules(settings.rules),
    startingInventory: {
      items: writeItemStack(settings.startingInventory.items, true),
      currencies: writeCurrencyStack(settings.startingInventory.currencies, true)
    },
    defenderKits: {
      easy: writeItemStack(settings.defenderKits.easy, false),
      normal: writeItemStack(settings.defenderKits.normal, false),
      hard: writeItemStack(settings.defenderKits.hard, false)
    },
    rounds: {
      easy: settings.rounds.easy,
      normal: settings.rounds.normal,
      hard: settings.rounds.hard
    },
    easyRewards: {
      stones: writeReward(settings.easyRewards.stones),
      scissors: writeReward(settings.easyRewards.scissors),
      papers: writeReward(settings.easyRewards.papers),
      copper: writeReward(settings.easyRewards.copper)
    },
    tiles: settings.tiles.map(writeTile)
  };
  return JSON.stringify(text, null, 2) + '\n';
}

/**
 * Zod rebuilds objects in schema key order. The bundled stacks are not in that
 * order, and an unchanged export has to match the file, so a valid document
 * is the parsed JSON object itself.
 */
export function readChapterText(text: string): ReadChapterResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return { ok: false, issues: [{ path: [], message }] };
  }
  const parsed = safeParseChapterSettings(value);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return { ok: true, settings: value as ChapterSettings };
}

function writeRules(rules: ChapterSettings['rules']): Record<string, unknown> {
  const out: Record<string, unknown> = {
    digCost: rules.digCost,
    searchCost: rules.searchCost,
    increaseMinesCost: rules.increaseMinesCost,
    battleEntry: rules.battleEntry
  };
  if (rules.attackFee !== undefined) out.attackFee = rules.attackFee;
  if (rules.battleKit) out.battleKit = writeItemStack(rules.battleKit, false);
  out.marketplace = writeItemStack(rules.marketplace, false);
  out.scoreWeights = {
    base: rules.scoreWeights.base,
    perTurn: rules.scoreWeights.perTurn,
    perVictory: rules.scoreWeights.perVictory,
    perSilver: rules.scoreWeights.perSilver,
    perCopper: rules.scoreWeights.perCopper
  };
  out.economyConsumesActionPoint = rules.economyConsumesActionPoint;
  out.actionPointsPerTurn = rules.actionPointsPerTurn;
  return out;
}

function writeTile(tile: TileSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {
    q: tile.q,
    r: tile.r,
    product: tile.product,
    mines: tile.mines,
    maxMines: tile.maxMines,
    difficulty: tile.difficulty,
    revealed: tile.revealed
  };
  if (tile.owner === 'player') out.owner = 'player';
  if (tile.objective === true) out.objective = true;
  out.label = tile.label !== undefined && tile.label.length > 0 ? tile.label : `(${tile.q},${tile.r})`;
  if (tile.npcAlgorithmId !== undefined && tile.npcAlgorithmId !== NPC_ALGORITHM_V1) {
    out.npcAlgorithmId = tile.npcAlgorithmId;
  }
  if (tile.defenderKit) out.defenderKit = writeItemStack(tile.defenderKit, false);
  if (tile.reward) out.reward = writeReward(tile.reward);
  if (tile.stash) out.stash = writeReward(tile.stash);
  return out;
}

function writeReward(reward: RewardSettings): RewardSettings {
  return {
    items: writeItemStack(reward.items, false),
    currencies: writeCurrencyStack(reward.currencies, false)
  };
}

/**
 * Other stacks keep the loaded key order and drop zeros. `keepZeros` writes
 * every key in constant order, including zeros. That is `startingInventory`.
 */
function writeItemStack(stack: ItemStack, keepZeros: boolean): ItemStack {
  const out: ItemStack = {};
  if (keepZeros) {
    for (const key of ITEM_KEYS) out[key] = stack[key] ?? 0;
    return out;
  }
  for (const key of Object.keys(stack)) {
    if (!ITEM_KEY_SET.has(key)) continue;
    const amount = stack[key as InventoryItemKey];
    if (amount === undefined || amount === 0) continue;
    out[key as InventoryItemKey] = amount;
  }
  return out;
}

function writeCurrencyStack(stack: CurrencyStack, keepZeros: boolean): CurrencyStack {
  const out: CurrencyStack = {};
  if (keepZeros) {
    for (const key of CURRENCY_KEYS) out[key] = stack[key] ?? 0;
    return out;
  }
  for (const key of Object.keys(stack)) {
    if (!CURRENCY_KEY_SET.has(key)) continue;
    const amount = stack[key as InventoryCurrencyKey];
    if (amount === undefined || amount === 0) continue;
    out[key as InventoryCurrencyKey] = amount;
  }
  return out;
}
