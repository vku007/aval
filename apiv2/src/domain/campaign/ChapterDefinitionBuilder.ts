import type { CampaignDefinition } from './CampaignDefinition.js';
import {
  assertCurrencyKeys,
  assertItemKeys,
  type CurrencyStack,
  type ItemStack
} from './CampaignInventory.js';
import type { ChapterSettings, RewardSettings, TileSettings } from './ChapterSettingsSchema.js';
import { assertSupportedNpcAlgorithm, Garrison, NPC_ALGORITHM_V1 } from './Garrison.js';
import type { ServerTile, Stash, TileRounds } from './Tile.js';

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export function effectiveReward(settings: ChapterSettings, tile: TileSettings): RewardSettings {
  if (tile.reward) {
    return tile.reward;
  }
  if (tile.difficulty === 'easy') {
    return settings.easyRewards[tile.product];
  }
  return { items: {}, currencies: {} };
}

export function effectiveDefenderKit(settings: ChapterSettings, tile: TileSettings): ItemStack {
  if (tile.owner === 'player') {
    return {};
  }
  if (tile.defenderKit) {
    return { ...tile.defenderKit };
  }
  if (tile.difficulty === null) {
    return {};
  }
  return { ...settings.defenderKits[tile.difficulty] };
}

export function tileRounds(settings: ChapterSettings, tile: TileSettings): TileRounds | null {
  if (tile.owner === 'player' || tile.difficulty === null) {
    return null;
  }
  return settings.rounds[tile.difficulty];
}

function stash(id: string, items: ItemStack, currencies: CurrencyStack): Stash {
  return { id, items, currencies, found: false };
}

function tileLabel(tile: TileSettings, index: number): string {
  if (typeof tile.label === 'string' && tile.label.length > 0) {
    return tile.label;
  }
  return `#${index}`;
}

function makeTile(settings: ChapterSettings, tile: TileSettings, index: number): ServerTile {
  const label = tileLabel(tile, index);
  if (tile.unavailable === true) {
    return {
      q: tile.q,
      r: tile.r,
      enabled: false,
      owner: null,
      revealed: tile.revealed,
      objective: false,
      product: tile.product,
      mines: 0,
      maxMines: 0,
      stashes: [],
      difficulty: null,
      rounds: null,
      label,
      garrison: null,
      victoryReward: { items: {}, currencies: {} },
      dugThisTurn: false,
      searchedThisTurn: false,
      increasedThisTurn: false,
      acquiredTurn: null
    };
  }
  const reward = effectiveReward(settings, tile);
  const npcAlgorithmId = tile.npcAlgorithmId ?? NPC_ALGORITHM_V1;
  assertSupportedNpcAlgorithm(npcAlgorithmId);
  return {
    q: tile.q,
    r: tile.r,
    enabled: true,
    owner: tile.owner ?? 'neutral',
    revealed: tile.revealed,
    objective: tile.objective === true,
    product: tile.product,
    mines: tile.mines,
    maxMines: tile.maxMines,
    stashes: tile.stash
      ? [stash(`stash-${tile.q}-${tile.r}`, { ...tile.stash.items }, { ...tile.stash.currencies })]
      : [],
    difficulty: tile.difficulty,
    rounds: tileRounds(settings, tile),
    label,
    garrison: tile.owner === 'player'
      ? null
      : Garrison.hidden(npcAlgorithmId, effectiveDefenderKit(settings, tile)),
    victoryReward: { items: { ...reward.items }, currencies: { ...reward.currencies } },
    dugThisTurn: false,
    searchedThisTurn: false,
    increasedThisTurn: false,
    acquiredTurn: null
  };
}

function validateTile(tile: ServerTile): void {
  if (!tile.enabled) {
    if (tile.owner !== null) {
      throw new Error(`tile ${tile.label} is unavailable and must not have an owner`);
    }
    if (tile.garrison) {
      throw new Error(`tile ${tile.label} is unavailable and must not have a garrison`);
    }
  } else if (tile.owner === 'player') {
    if (tile.garrison) {
      throw new Error(`tile ${tile.label} is owned and must not have a garrison`);
    }
  } else if (!tile.garrison) {
    throw new Error(`tile ${tile.label} must have a garrison`);
  } else {
    assertSupportedNpcAlgorithm(tile.garrison.npcAlgorithmId);
    assertItemKeys(tile.garrison.inventory.items, `tile ${tile.label} garrison`);
    assertCurrencyKeys(tile.garrison.inventory.currencies, `tile ${tile.label} garrison`);
  }
  assertItemKeys(tile.victoryReward.items, `tile ${tile.label} reward`);
  assertCurrencyKeys(tile.victoryReward.currencies, `tile ${tile.label} reward`);
  tile.stashes.forEach((pile, index) => {
    assertItemKeys(pile.items, `tile ${tile.label} stash ${index}`);
    assertCurrencyKeys(pile.currencies, `tile ${tile.label} stash ${index}`);
  });
}

/** Builds the definition the game runs. Callers run `checkChapterSettings` first. */
export function buildChapterDefinition(settings: ChapterSettings): CampaignDefinition {
  assertItemKeys(settings.rules.marketplace, 'marketplace');
  assertItemKeys(settings.startingInventory.items, 'starting inventory');
  assertCurrencyKeys(settings.startingInventory.currencies, 'starting inventory');
  for (const difficulty of DIFFICULTIES) {
    assertItemKeys(settings.defenderKits[difficulty], `${difficulty} garrison`);
  }
  const tiles = settings.tiles.map((tile, index) => makeTile(settings, tile, index));
  if (tiles.length !== settings.tileCount) {
    throw new Error(`Chapter I must have ${settings.tileCount} tiles, found ${tiles.length}`);
  }
  tiles.forEach(validateTile);
  return {
    id: settings.id,
    title: settings.title,
    goal: settings.goal,
    rulesetVersion: settings.rulesetVersion,
    rules: structuredClone(settings.rules),
    startingInventory: structuredClone(settings.startingInventory),
    tiles
  };
}
