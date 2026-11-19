import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { ITEM_KEYS } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { describe, expect, it } from 'vitest';
import { readChapterText, serializeChapter } from './serialize.js';

function readOk(text: string): ChapterSettings {
  const result = readChapterText(text);
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join('; '));
  return result.settings;
}

function tileAt(settings: ChapterSettings, q: number, r: number): TileSettings {
  const tile = settings.tiles.find(item => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing ${q},${r}`);
  return tile;
}

function parsedTile(text: string, q: number, r: number): Record<string, unknown> {
  const tiles = JSON.parse(text).tiles as Record<string, unknown>[];
  const tile = tiles.find(item => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing ${q},${r}`);
  return tile;
}

describe('serializeChapter', () => {
  it('reproduces the bundled file byte for byte', () => {
    const settings = readOk(chapterRaw);
    expect(settings).toEqual(parseChapterSettings(JSON.parse(chapterRaw)));
    expect(serializeChapter(settings)).toBe(chapterRaw);
  });

  it('keeps loaded stack key order where the file is not in key-constant order', () => {
    const text = serializeChapter(readOk(chapterRaw));
    const body = JSON.parse(text);
    expect(Object.keys(body.rules.marketplace)).toEqual([
      'stones',
      'papers',
      'scissors',
      'NA_effect_stone',
      'NA_effect_scissors',
      'NA_effect_papers',
      'NT_effect'
    ]);
    const gate = parsedTile(text, 0, -1);
    const citadel = parsedTile(text, 0, -2);
    expect(Object.keys((gate.reward as { currencies: object }).currencies)).toEqual(['copper', 'silver']);
    expect(Object.keys((citadel.reward as { items: object }).items)).toEqual(['papers', 'stones', 'NT_effect']);
    expect(Object.keys((citadel.reward as { currencies: object }).currencies)).toEqual(['copper', 'silver']);
  });

  it('omits a default reward and kit, and still writes a custom kit equal to the difficulty kit', () => {
    const settings = readOk(chapterRaw);
    const easy = parsedTile(serializeChapter(settings), 1, -1);
    expect(easy.reward).toBeUndefined();
    expect(easy.defenderKit).toBeUndefined();
    expect(easy.owner).toBeUndefined();
    expect(easy.objective).toBeUndefined();
    expect(easy.npcAlgorithmId).toBeUndefined();

    const gate = tileAt(settings, 0, -1);
    delete gate.reward;
    gate.npcAlgorithmId = 'npc-v1';
    gate.objective = false;
    const cleared = parsedTile(serializeChapter(settings), 0, -1);
    expect(cleared.reward).toBeUndefined();
    expect(cleared.npcAlgorithmId).toBeUndefined();
    expect(cleared.objective).toBeUndefined();

    gate.defenderKit = { ...settings.defenderKits.normal };
    const custom = parsedTile(serializeChapter(settings), 0, -1);
    expect(custom.defenderKit).toEqual(settings.defenderKits.normal);
  });

  it('drops zero amounts except starting inventory, and omits an item that is not for sale', () => {
    const settings = readOk(chapterRaw);
    const gate = tileAt(settings, 0, -1);
    gate.reward = {
      items: { papers: 1, stones: 0, scissors: 2 },
      currencies: { copper: 0, silver: 1, gold: 0 }
    };
    const reward = parsedTile(serializeChapter(settings), 0, -1).reward as {
      items: Record<string, number>;
      currencies: Record<string, number>;
    };
    expect(reward.items).toEqual({ papers: 1, scissors: 2 });
    expect(Object.keys(reward.items)).toEqual(['papers', 'scissors']);
    expect(reward.currencies).toEqual({ silver: 1 });

    settings.startingInventory.items = { ...settings.startingInventory.items, stones: 0 };
    settings.rules.marketplace = { ...settings.rules.marketplace, stones: 0 };
    delete settings.rules.marketplace.NT_effect;
    const body = JSON.parse(serializeChapter(settings));
    expect(body.startingInventory.items.stones).toBe(0);
    expect(Object.keys(body.startingInventory.items)).toEqual([...ITEM_KEYS]);
    expect(body.rules.marketplace.stones).toBeUndefined();
    expect(body.rules.marketplace.NT_effect).toBeUndefined();
    expect(body.rules.marketplace.papers).toBe(3);
  });

  it('writes an empty label as (q,r) and orders every optional tile field', () => {
    const settings = readOk(chapterRaw);
    const tile = tileAt(settings, 1, 0);
    tile.label = '';
    tile.owner = 'player';
    tile.objective = true;
    tile.npcAlgorithmId = 'npc-greed-v1';
    tile.defenderKit = { scissors: 1 };
    tile.reward = { items: { stones: 1 }, currencies: { copper: 1 } };
    tile.stash = { items: { papers: 1 }, currencies: { silver: 1 } };
    const written = parsedTile(serializeChapter(settings), 1, 0);
    expect(written.label).toBe('(1,0)');
    expect(Object.keys(written)).toEqual([
      'q',
      'r',
      'product',
      'mines',
      'maxMines',
      'difficulty',
      'revealed',
      'owner',
      'objective',
      'label',
      'npcAlgorithmId',
      'defenderKit',
      'reward',
      'stash'
    ]);
  });

  it('writes rules keys in file order and keeps only the battle-entry field that is set', () => {
    const settings = readOk(chapterRaw);
    delete settings.rules.attackFee;
    settings.rules.battleEntry = 'wager';
    settings.rules.battleKit = { stones: 1, scissors: 0 };
    const rules = JSON.parse(serializeChapter(settings)).rules;
    expect(Object.keys(rules)).toEqual([
      'digCost',
      'searchCost',
      'increaseMinesCost',
      'battleEntry',
      'battleKit',
      'marketplace',
      'scoreWeights',
      'economyConsumesActionPoint',
      'actionPointsPerTurn'
    ]);
    expect(rules.attackFee).toBeUndefined();
    expect(rules.battleKit).toEqual({ stones: 1 });
    settings.tileCount = 3;
    expect(JSON.parse(serializeChapter(settings)).tileCount).toBe(19);
  });
});

describe('readChapterText', () => {
  it('reports invalid JSON at the root and schema issues with their paths', () => {
    const invalid = readChapterText('not json');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues).toHaveLength(1);
      expect(invalid.issues[0]?.path).toEqual([]);
      expect(invalid.issues[0]?.message.length).toBeGreaterThan(0);
    }

    const body = JSON.parse(chapterRaw) as Record<string, unknown>;
    body.extra = true;
    const unknown = readChapterText(JSON.stringify(body));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.issues.some(issue => issue.path.at(-1) === 'extra')).toBe(true);
    }
  });
});
