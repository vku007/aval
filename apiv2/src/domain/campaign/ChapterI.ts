import type { CampaignDefinition } from './CampaignDefinition.js';
import {
  assertCurrencyKeys,
  assertItemKeys,
  type CurrencyStack,
  type ItemStack
} from './CampaignInventory.js';
import { assertSupportedNpcAlgorithm, Garrison, NPC_ALGORITHM_V1 } from './Garrison.js';
import chapterISettings from './chapter-i.json';
import type { ScoreWeights } from './CampaignScore.js';
import type { BattleEntry, ServerTile, Stash, StoredRules, TileDifficulty, TileRounds } from './Tile.js';

type Product = 'stones' | 'scissors' | 'papers' | 'copper';

interface TileSpec {
  q: number;
  r: number;
  product: Product;
  mines: number;
  maxMines: number;
  difficulty: TileDifficulty | null;
  revealed: boolean;
  owner?: 'player';
  objective?: boolean;
  label: string;
  /** Omitted garrisons use `npc-v1`. */
  npcAlgorithmId?: string;
  reward?: { items: ItemStack; currencies: CurrencyStack };
  stash?: { items: ItemStack; currencies: CurrencyStack };
}

interface ChapterSettings {
  id: string;
  title: string;
  goal: string;
  rulesetVersion: number;
  tileCount: number;
  rules: StoredRules;
  startingInventory: { items: ItemStack; currencies: CurrencyStack };
  defenderKits: Record<TileDifficulty, ItemStack>;
  rounds: Record<TileDifficulty, TileRounds>;
  easyRewards: Record<Product, { items: ItemStack; currencies: CurrencyStack }>;
  tiles: TileSpec[];
}

const PRODUCTS = new Set<Product>(['stones', 'scissors', 'papers', 'copper']);
const DIFFICULTIES = new Set<TileDifficulty>(['easy', 'normal', 'hard']);
const ROUNDS = new Set<TileRounds>(['BO5', 'BO7']);

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Chapter I settings ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readCount(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Chapter I settings ${label} must be an integer`);
  }
  return value;
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Chapter I settings ${label} must be a string`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Chapter I settings ${label} must be a boolean`);
  }
  return value;
}

function readStack(value: unknown, label: string): Record<string, number> {
  const source = readObject(value, label);
  const stack: Record<string, number> = {};
  for (const [key, amount] of Object.entries(source)) {
    stack[key] = readCount(amount, `${label}.${key}`);
  }
  return stack;
}

function readReward(value: unknown, label: string): { items: ItemStack; currencies: CurrencyStack } {
  const reward = readObject(value, label);
  return {
    items: readStack(reward.items, `${label} items`),
    currencies: readStack(reward.currencies, `${label} currencies`)
  };
}

function readScoreWeights(value: unknown): ScoreWeights {
  const weights = readObject(value, 'rules.scoreWeights');
  return {
    base: readCount(weights.base, 'rules.scoreWeights.base'),
    perTurn: readCount(weights.perTurn, 'rules.scoreWeights.perTurn'),
    perVictory: readCount(weights.perVictory, 'rules.scoreWeights.perVictory'),
    perSilver: readCount(weights.perSilver, 'rules.scoreWeights.perSilver'),
    perCopper: readCount(weights.perCopper, 'rules.scoreWeights.perCopper')
  };
}

function readRules(value: unknown): StoredRules {
  const rules = readObject(value, 'rules');
  if (rules.battleEntry !== 'fee' && rules.battleEntry !== 'wager') {
    throw new Error('Chapter I settings rules.battleEntry must be "fee" or "wager"');
  }
  const battleEntry: BattleEntry = rules.battleEntry;
  const stored: StoredRules = {
    digCost: readCount(rules.digCost, 'rules.digCost'),
    searchCost: readCount(rules.searchCost, 'rules.searchCost'),
    increaseMinesCost: readCount(rules.increaseMinesCost, 'rules.increaseMinesCost'),
    battleEntry,
    marketplace: readStack(rules.marketplace, 'rules.marketplace'),
    scoreWeights: readScoreWeights(rules.scoreWeights),
    economyConsumesActionPoint: readBoolean(rules.economyConsumesActionPoint, 'rules.economyConsumesActionPoint'),
    actionPointsPerTurn: readCount(rules.actionPointsPerTurn, 'rules.actionPointsPerTurn')
  };
  if (rules.attackFee !== undefined) {
    stored.attackFee = readCount(rules.attackFee, 'rules.attackFee');
  }
  if (rules.battleKit !== undefined) {
    stored.battleKit = readStack(rules.battleKit, 'rules.battleKit');
  }
  return stored;
}

function readKits(value: unknown): Record<TileDifficulty, ItemStack> {
  const kits = readObject(value, 'defenderKits');
  const read = (difficulty: TileDifficulty) => readStack(kits[difficulty], `defenderKits.${difficulty}`);
  return { easy: read('easy'), normal: read('normal'), hard: read('hard') };
}

function readRounds(value: unknown): Record<TileDifficulty, TileRounds> {
  const rounds = readObject(value, 'rounds');
  const read = (difficulty: TileDifficulty): TileRounds => {
    const round = rounds[difficulty];
    if (typeof round !== 'string' || !ROUNDS.has(round as TileRounds)) {
      throw new Error(`Chapter I settings rounds.${difficulty} must be BO5 or BO7`);
    }
    return round as TileRounds;
  };
  return { easy: read('easy'), normal: read('normal'), hard: read('hard') };
}

function readEasyRewards(value: unknown): Record<Product, { items: ItemStack; currencies: CurrencyStack }> {
  const rewards = readObject(value, 'easyRewards');
  const read = (product: Product) => readReward(rewards[product], `easyRewards.${product}`);
  return {
    stones: read('stones'),
    scissors: read('scissors'),
    papers: read('papers'),
    copper: read('copper')
  };
}

function readTile(value: unknown, index: number): TileSpec {
  const tile = readObject(value, `tiles[${index}]`);
  const label = typeof tile.label === 'string' && tile.label.length > 0 ? tile.label : `#${index}`;
  if (typeof tile.product !== 'string' || !PRODUCTS.has(tile.product as Product)) {
    throw new Error(`Chapter I settings tile ${label} has an unknown product`);
  }
  let difficulty: TileDifficulty | null = null;
  if (tile.difficulty != null) {
    if (typeof tile.difficulty !== 'string' || !DIFFICULTIES.has(tile.difficulty as TileDifficulty)) {
      throw new Error(`Chapter I settings tile ${label} has an unknown difficulty`);
    }
    difficulty = tile.difficulty as TileDifficulty;
  }
  const spec: TileSpec = {
    q: readCount(tile.q, `tile ${label} q`),
    r: readCount(tile.r, `tile ${label} r`),
    product: tile.product as Product,
    mines: readCount(tile.mines, `tile ${label} mines`),
    maxMines: readCount(tile.maxMines, `tile ${label} maxMines`),
    difficulty,
    revealed: readBoolean(tile.revealed, `tile ${label} revealed`),
    label
  };
  if (tile.owner !== undefined) {
    if (tile.owner !== 'player') {
      throw new Error(`Chapter I settings tile ${label} owner must be "player"`);
    }
    spec.owner = 'player';
  }
  if (tile.objective !== undefined && typeof tile.objective !== 'boolean') {
    throw new Error(`Chapter I settings tile ${label} objective must be a boolean`);
  }
  if (tile.objective === true) {
    spec.objective = true;
  }
  if (tile.npcAlgorithmId !== undefined) {
    spec.npcAlgorithmId = readText(tile.npcAlgorithmId, `tile ${label} npcAlgorithmId`);
  }
  if (tile.reward !== undefined) {
    spec.reward = readReward(tile.reward, `tile ${label} reward`);
  }
  if (tile.stash !== undefined) {
    spec.stash = readReward(tile.stash, `tile ${label} stash`);
  }
  return spec;
}

function readSettings(value: unknown): ChapterSettings {
  const settings = readObject(value, 'file');
  if (!Array.isArray(settings.tiles)) {
    throw new Error('Chapter I settings tiles must be an array');
  }
  const inventory = readObject(settings.startingInventory, 'startingInventory');
  return {
    id: readText(settings.id, 'id'),
    title: readText(settings.title, 'title'),
    goal: readText(settings.goal, 'goal'),
    rulesetVersion: readCount(settings.rulesetVersion, 'rulesetVersion'),
    tileCount: readCount(settings.tileCount, 'tileCount'),
    rules: readRules(settings.rules),
    startingInventory: {
      items: readStack(inventory.items, 'startingInventory.items'),
      currencies: readStack(inventory.currencies, 'startingInventory.currencies')
    },
    defenderKits: readKits(settings.defenderKits),
    rounds: readRounds(settings.rounds),
    easyRewards: readEasyRewards(settings.easyRewards),
    tiles: settings.tiles.map((tile, index) => readTile(tile, index))
  };
}

const settings = readSettings(chapterISettings);

function stash(id: string, items: ItemStack, currencies: CurrencyStack): Stash {
  return { id, items, currencies, found: false };
}

function defenderKit(difficulty: TileDifficulty | null): ItemStack {
  if (difficulty === null) return {};
  return { ...settings.defenderKits[difficulty] };
}

function makeTile(spec: TileSpec): ServerTile {
  const reward = spec.reward ?? (spec.difficulty === 'easy'
    ? settings.easyRewards[spec.product]
    : { items: {}, currencies: {} });
  const npcAlgorithmId = spec.npcAlgorithmId ?? NPC_ALGORITHM_V1;
  assertSupportedNpcAlgorithm(npcAlgorithmId);
  return {
    q: spec.q,
    r: spec.r,
    enabled: true,
    owner: spec.owner ?? 'neutral',
    revealed: spec.revealed,
    objective: spec.objective === true,
    product: spec.product,
    mines: spec.mines,
    maxMines: spec.maxMines,
    stashes: spec.stash ? [stash(`stash-${spec.q}-${spec.r}`, spec.stash.items, spec.stash.currencies)] : [],
    difficulty: spec.difficulty,
    rounds: spec.difficulty === null ? null : settings.rounds[spec.difficulty],
    label: spec.label,
    garrison: spec.owner === 'player'
      ? null
      : Garrison.hidden(npcAlgorithmId, defenderKit(spec.difficulty)),
    victoryReward: { items: { ...reward.items }, currencies: { ...reward.currencies } },
    dugThisTurn: false,
    searchedThisTurn: false,
    increasedThisTurn: false,
    acquiredTurn: null
  };
}

function validateTile(tile: ServerTile): void {
  if (tile.owner === 'player') {
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

function buildChapterI(): CampaignDefinition {
  assertItemKeys(settings.rules.marketplace, 'marketplace');
  assertItemKeys(settings.startingInventory.items, 'starting inventory');
  assertCurrencyKeys(settings.startingInventory.currencies, 'starting inventory');
  for (const difficulty of DIFFICULTIES) {
    assertItemKeys(settings.defenderKits[difficulty], `${difficulty} garrison`);
  }
  const tiles = settings.tiles.map(makeTile);
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

export const CHAPTER_I: CampaignDefinition = buildChapterI();
