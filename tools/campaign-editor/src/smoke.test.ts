import { describe, expect, it } from 'vitest';
import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { ChapterSettingsSchema, parseChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';

describe('campaign editor smoke', () => {
  it('parses the bundled chapter settings', () => {
    const settings = parseChapterSettings(JSON.parse(chapterRaw));
    expect(ChapterSettingsSchema.parse(settings)).toEqual(settings);
    expect(settings.id).toBe('chapter-i');
    expect(settings.tiles).toHaveLength(19);
  });
});
