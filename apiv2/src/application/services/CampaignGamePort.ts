import type { Game } from '../../domain/entity/Game.js';
import type { CurrencyStack, ItemStack } from '../../domain/campaign/CampaignInventory.js';
import type { RoundsLength } from '../../domain/value-object/RoundsLength.js';

export interface BattleGameSpec {
  userId: string;
  campaignId: string;
  attackId: string;
  seed: number;
  tile: { q: number; r: number };
  rounds: RoundsLength;
  levelName: string;
  title: string;
  humanItems: ItemStack;
  npcItems: ItemStack;
  npcCurrencies: CurrencyStack;
  npcAlgorithmId: string;
}

export interface LoadedGame {
  game: Game;
  etag?: string;
}

export interface CampaignGamePort {
  createBattle(spec: BattleGameSpec): Promise<{ gameId: string }>;
  load(gameId: string): Promise<LoadedGame | null>;
  save(game: Game, ifMatch: string | undefined): Promise<void>;
}

export interface CampaignBattleSink {
  resolveFromGame(game: Game): Promise<void>;
}
