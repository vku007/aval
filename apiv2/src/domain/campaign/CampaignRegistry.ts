import type { CampaignDefinition } from './CampaignDefinition.js';
import { CHAPTER_I } from './ChapterI.js';

const REGISTRY: CampaignDefinition[] = [CHAPTER_I];

export function listDefinitions(): CampaignDefinition[] {
  return REGISTRY;
}

export function findDefinition(id: string): CampaignDefinition | undefined {
  return REGISTRY.find(definition => definition.id === id);
}
