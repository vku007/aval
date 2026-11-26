import { describe, expect, it } from 'vitest';
import chapterI from '../../../domain/campaign/chapter-i.json';
import { ValidationError } from '../../../shared/errors/index.js';
import { parseCampaignBody, StartCampaignSchema } from './campaignSchemas.js';

describe('StartCampaignSchema', () => {
  it('accepts a definition id or an editor file, and rejects a body with both', () => {
    expect(parseCampaignBody(StartCampaignSchema, { definitionId: 'chapter-i' })).toEqual({
      definitionId: 'chapter-i'
    });
    const parsed = parseCampaignBody(StartCampaignSchema, { settings: chapterI });
    expect(parsed).toMatchObject({ settings: { id: 'chapter-i', title: 'Chapter I' } });
    expect(() => parseCampaignBody(StartCampaignSchema, { definitionId: 'chapter-i', settings: chapterI }))
      .toThrow(ValidationError);
    expect(() => parseCampaignBody(StartCampaignSchema, {})).toThrow(ValidationError);
    const linear = structuredClone(chapterI);
    linear.rules.scoreWeights = { base: 200, perTurn: 50, perVictory: 20, perSilver: 20, perCopper: 1 };
    expect(parseCampaignBody(StartCampaignSchema, { settings: linear })).toMatchObject({
      settings: { id: 'chapter-i', rules: { scoreWeights: linear.rules.scoreWeights } }
    });
    expect(() => parseCampaignBody(StartCampaignSchema, { settings: { id: 'chapter-i' } })).toThrow(/Required/);
  });
});
