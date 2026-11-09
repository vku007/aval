import type { CampaignDefinition } from './CampaignDefinition.js';
import {
  assertCurrencyKeys,
  assertItemKeys,
  type CurrencyStack,
  type ItemStack
} from './CampaignInventory.js';
import { Garrison, NPC_ALGORITHM_V1 } from './Garrison.js';
import type { ServerTile, Stash, StoredRules, TileDifficulty } from './Tile.js';

const GOAL = 'Take the citadel. Fewer turns, more victories, and more silver and copper make a higher score.';

const BATTLE_KIT: ItemStack = {
  stones: 8,
  scissors: 5,
  papers: 8,
  NA_effect_stone: 1,
  NA_effect_scissors: 1,
  NA_effect_papers: 1,
  NT_effect: 1
};

const EASY_KIT: ItemStack = { stones: 6, scissors: 3, papers: 4 };
const NORMAL_KIT: ItemStack = { stones: 9, scissors: 4, papers: 7, NA_effect_stone: 1 };
const HARD_KIT: ItemStack = {
  stones: 12,
  scissors: 8,
  papers: 8,
  NA_effect_stone: 1,
  NA_effect_scissors: 1,
  NA_effect_papers: 1,
  NT_effect: 1
};

function defenderKit(difficulty: TileDifficulty | null): ItemStack {
  if (difficulty === 'easy') return { ...EASY_KIT };
  if (difficulty === 'normal') return { ...NORMAL_KIT };
  if (difficulty === 'hard') return { ...HARD_KIT };
  return {};
}

function roundsFor(difficulty: TileDifficulty | null): 'BO5' | 'BO7' | null {
  if (difficulty === 'hard') return 'BO7';
  if (difficulty === 'easy' || difficulty === 'normal') return 'BO5';
  return null;
}

function easyReward(product: 'stones' | 'scissors' | 'papers' | 'copper'): { items: ItemStack; currencies: CurrencyStack } {
  if (product === 'copper') {
    return { items: {}, currencies: { copper: 4 } };
  }
  return { items: { [product]: 2 }, currencies: { copper: 2 } };
}

interface TileSpec {
  q: number;
  r: number;
  product: 'stones' | 'scissors' | 'papers' | 'copper';
  mines: number;
  maxMines: number;
  difficulty: TileDifficulty | null;
  revealed: boolean;
  owner?: 'player';
  objective?: boolean;
  label: string;
  reward?: { items: ItemStack; currencies: CurrencyStack };
  stash?: { items: ItemStack; currencies: CurrencyStack };
}

function stash(id: string, items: ItemStack, currencies: CurrencyStack): Stash {
  return { id, items, currencies, found: false };
}

function makeTile(spec: TileSpec): ServerTile {
  const reward = spec.reward ?? (spec.difficulty === 'easy' ? easyReward(spec.product) : { items: {}, currencies: {} });
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
    rounds: roundsFor(spec.difficulty),
    label: spec.label,
    garrison: spec.owner === 'player'
      ? null
      : Garrison.hidden(NPC_ALGORITHM_V1, defenderKit(spec.difficulty)),
    victoryReward: { items: { ...reward.items }, currencies: { ...reward.currencies } },
    dugThisTurn: false,
    searchedThisTurn: false,
    increasedThisTurn: false,
    acquiredTurn: spec.owner === 'player' ? null : null
  };
}

function buildTiles(): ServerTile[] {
  return [
    makeTile({ q: 0, r: 0, product: 'copper', mines: 1, maxMines: 3, difficulty: null, revealed: true, owner: 'player', label: 'camp' }),
    makeTile({ q: 0, r: -1, product: 'stones', mines: 1, maxMines: 3, difficulty: 'normal', revealed: true, label: 'gate', reward: { items: { stones: 3, scissors: 1 }, currencies: { copper: 4, silver: 1 } } }),
    makeTile({ q: 1, r: -1, product: 'stones', mines: 1, maxMines: 2, difficulty: 'easy', revealed: true, label: '(1,-1)' }),
    makeTile({ q: 1, r: 0, product: 'papers', mines: 1, maxMines: 2, difficulty: 'easy', revealed: true, label: '(1,0)' }),
    makeTile({ q: 0, r: 1, product: 'scissors', mines: 1, maxMines: 2, difficulty: 'easy', revealed: true, label: '(0,1)', stash: { items: { scissors: 4 }, currencies: { silver: 2, copper: 6 } } }),
    makeTile({ q: -1, r: 1, product: 'copper', mines: 1, maxMines: 2, difficulty: 'easy', revealed: true, label: '(-1,1)' }),
    makeTile({ q: -1, r: 0, product: 'scissors', mines: 1, maxMines: 2, difficulty: 'easy', revealed: true, label: '(-1,0)' }),
    makeTile({ q: 0, r: -2, product: 'papers', mines: 2, maxMines: 4, difficulty: 'hard', revealed: false, objective: true, label: 'citadel', reward: { items: { papers: 4, stones: 2, NT_effect: 1 }, currencies: { copper: 8, silver: 2 } } }),
    makeTile({ q: 1, r: -2, product: 'papers', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(1,-2)', stash: { items: { papers: 4, NA_effect_papers: 1 }, currencies: { silver: 1, copper: 4 } } }),
    makeTile({ q: 2, r: -2, product: 'stones', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(2,-2)' }),
    makeTile({ q: 2, r: -1, product: 'copper', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(2,-1)' }),
    makeTile({ q: 2, r: 0, product: 'papers', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(2,0)' }),
    makeTile({ q: 1, r: 1, product: 'stones', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(1,1)' }),
    makeTile({ q: 0, r: 2, product: 'copper', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(0,2)' }),
    makeTile({ q: -1, r: 2, product: 'scissors', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(-1,2)' }),
    makeTile({ q: -2, r: 2, product: 'papers', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(-2,2)' }),
    makeTile({ q: -2, r: 1, product: 'stones', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(-2,1)' }),
    makeTile({ q: -2, r: 0, product: 'scissors', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(-2,0)' }),
    makeTile({ q: -1, r: -1, product: 'stones', mines: 1, maxMines: 2, difficulty: 'easy', revealed: false, label: '(-1,-1)', stash: { items: { stones: 4, NA_effect_stone: 1 }, currencies: { copper: 4 } } })
  ];
}

function validateTile(tile: ServerTile): void {
  if (tile.owner === 'player') {
    if (tile.garrison) {
      throw new Error(`tile ${tile.label} is owned and must not have a garrison`);
    }
  } else if (!tile.garrison || tile.garrison.npcAlgorithmId !== NPC_ALGORITHM_V1) {
    throw new Error(`tile ${tile.label} must have an ${NPC_ALGORITHM_V1} garrison`);
  } else {
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

const RULES: StoredRules = {
  digCost: 4,
  searchCost: 6,
  increaseMinesCost: 6,
  battleKit: BATTLE_KIT,
  marketplace: {
    stones: 3,
    papers: 3,
    scissors: 4,
    NA_effect_stone: 8,
    NA_effect_scissors: 8,
    NA_effect_papers: 8,
    NT_effect: 12
  },
  scoreWeights: { base: 200, perTurn: 50, perVictory: 20, perSilver: 20, perCopper: 1 },
  economyConsumesActionPoint: false,
  actionPointsPerTurn: 1
};

function buildChapterI(): CampaignDefinition {
  assertItemKeys(BATTLE_KIT, 'battle kit');
  assertItemKeys(RULES.marketplace, 'marketplace');
  const tiles = buildTiles();
  if (tiles.length !== 19) {
    throw new Error(`Chapter I must have 19 tiles, found ${tiles.length}`);
  }
  tiles.forEach(validateTile);
  return {
    id: 'chapter-i',
    title: 'Chapter I',
    goal: GOAL,
    rulesetVersion: 1,
    rules: RULES,
    startingInventory: {
      items: {
        stones: 14,
        scissors: 10,
        papers: 14,
        NA_effect_stone: 2,
        NA_effect_scissors: 2,
        NA_effect_papers: 2,
        NT_effect: 2
      },
      currencies: { gold: 0, silver: 0, copper: 16 }
    },
    tiles
  };
}

export const CHAPTER_I: CampaignDefinition = buildChapterI();
