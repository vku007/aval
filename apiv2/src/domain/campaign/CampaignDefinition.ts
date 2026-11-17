import type { CurrencyStack, ItemStack } from './CampaignInventory.js';
import type { ServerTile, StoredRules } from './Tile.js';

export interface CampaignDefinition {
  id: string;
  title: string;
  goal: string;
  rulesetVersion: number;
  rules: StoredRules;
  startingInventory: { items: ItemStack; currencies: CurrencyStack };
  tiles: ServerTile[];
}
