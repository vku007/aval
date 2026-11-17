import type { ItemStack, CurrencyStack, MineProduct } from './CampaignInventory.js';
import type { Garrison } from './Garrison.js';
import type { ScoreWeights } from './CampaignScore.js';

export type TileDifficulty = 'easy' | 'normal' | 'hard';
export type TileRounds = 'BO5' | 'BO7';
export type TileOwner = 'player' | 'neutral';

export interface Stash {
  id: string;
  items: ItemStack;
  currencies: CurrencyStack;
  found: boolean;
}

/**
 * Server tile. Never sent whole to the client.
 * `acquiredTurn` is the turnNumber when the player captured it.
 * Null means the player started with it, so the first End Turn pays it.
 */
export interface ServerTile {
  q: number;
  r: number;
  enabled: boolean;
  owner: TileOwner | null;
  revealed: boolean;
  objective: boolean;
  product: MineProduct | null;
  mines: number;
  maxMines: number;
  stashes: Stash[];
  difficulty: TileDifficulty | null;
  rounds: TileRounds | null;
  label: string;
  /** Present on every tile the player does not own. Cleared when the tile is captured. */
  garrison: Garrison | null;
  victoryReward: { items: ItemStack; currencies: CurrencyStack };
  dugThisTurn: boolean;
  searchedThisTurn: boolean;
  increasedThisTurn: boolean;
  acquiredTurn: number | null;
}

export type BattleEntry = 'fee' | 'wager';

export interface StoredRules {
  digCost: number;
  searchCost: number;
  increaseMinesCost: number;
  /**
   * Absent means `wager`, so a run stored before the fee still debits `battleKit`.
   * `fee` charges `attackFee` copper and moves every campaign item.
   */
  battleEntry?: BattleEntry;
  /** Copper charged when `battleEntry` is `fee`. */
  attackFee?: number;
  /** Present on a wager chapter. Chapter I omits it. */
  battleKit?: ItemStack;
  marketplace: ItemStack;
  scoreWeights: ScoreWeights;
  economyConsumesActionPoint: boolean;
  actionPointsPerTurn: number;
}

export interface ActiveBattleState {
  attackId: string;
  battleSeed: number;
  gameId: string | null;
  q: number;
  r: number;
  /** Kit that left the campaign. Absent on a fee attack. */
  wager?: ItemStack;
  /** Every item that left the campaign on a fee attack. */
  committedItems?: ItemStack;
  /** Copper charged for a fee attack. Absent on a wager attack. */
  feeCopper?: number;
  resolved: boolean;
}

export interface ResolvedAttack {
  attackId: string;
  gameId: string;
}

export type CampaignLogType =
  | 'income'
  | 'dig'
  | 'search'
  | 'purchase'
  | 'attack'
  | 'battle_won'
  | 'battle_lost'
  | 'battle_refunded'
  | 'mines_increased'
  | 'left'
  | 'victory';

export interface CampaignLogEntry {
  at: number;
  turn: number;
  type: CampaignLogType;
  summary: string;
}
