import { CHAPTER_I } from './ChapterI.js';
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

const REGISTRY: CampaignDefinition[] = [CHAPTER_I];

export function listDefinitions(): CampaignDefinition[] {
  return REGISTRY;
}

export function findDefinition(id: string): CampaignDefinition | undefined {
  return REGISTRY.find(definition => definition.id === id);
}
