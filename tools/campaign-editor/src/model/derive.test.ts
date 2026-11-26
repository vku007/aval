import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { describe, expect, it } from 'vitest';
import { kitUsage, mixedValue, revealedBy, startView, tileFacts } from './derive.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function tileAt(settings: ChapterSettings, q: number, r: number): TileSettings {
  const tile = settings.tiles.find(item => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing ${q},${r}`);
  return tile;
}

describe('tileFacts', () => {
  it('reports income, dig, rounds, and the default kit', () => {
    const settings = bundled();
    const camp = tileFacts(settings, { q: 0, r: 0 });
    expect(camp.incomePerTurn).toBe(2);
    expect(camp.digYield).toBe(4);
    expect(camp.digNet).toBe(0);
    expect(camp.rounds).toBeNull();
    expect(camp.reward).toEqual({ items: {}, currencies: {} });
    expect(camp.rewardIsDefault).toBe(true);
    expect(camp.kit).toEqual({});
    expect(camp.kitIsDefault).toBe(true);
    expect(camp.kitDiff).toEqual([]);

    const gate = tileFacts(settings, { q: 0, r: -1 });
    expect(gate.incomePerTurn).toBe(1);
    expect(gate.digYield).toBe(2);
    expect(gate.digNet).toBeNull();
    expect(gate.rounds).toBe('BO5');
    expect(gate.rewardIsDefault).toBe(false);
    expect(gate.reward).toEqual(tileAt(settings, 0, -1).reward);
    expect(gate.kit).toEqual(settings.defenderKits.normal);
    expect(gate.kitIsDefault).toBe(true);
    expect(gate.kitDiff).toEqual([]);

    const citadel = tileFacts(settings, { q: 0, r: -2 });
    expect(citadel.incomePerTurn).toBe('never-pays');
    expect(citadel.digYield).toBe(4);
    expect(citadel.digNet).toBeNull();
    expect(citadel.rounds).toBe('BO7');

    const easy = tileFacts(settings, { q: 1, r: -1 });
    expect(easy.rewardIsDefault).toBe(true);
    expect(easy.reward).toEqual(settings.easyRewards.papers);
  });

  it('diffs a custom kit of 7 scissors against the normal kit', () => {
    const settings = bundled();
    const gate = tileAt(settings, 0, -1);
    gate.defenderKit = { scissors: 7 };
    const facts = tileFacts(settings, { q: 0, r: -1 });
    expect(facts.kit).toEqual({ scissors: 7 });
    expect(facts.kitIsDefault).toBe(false);
    expect(facts.kitDiff).toEqual([
      { key: 'stones', delta: -9 },
      { key: 'scissors', delta: 3 },
      { key: 'papers', delta: -7 },
      { key: 'NA_effect_stone', delta: -1 }
    ]);
  });
});

describe('startView', () => {
  it('marks 7 cells visible on the bundled file', () => {
    const view = startView(bundled());
    const counts = { owned: 0, seen: 0, hidden: 0, blocked: 0 };
    for (const value of Object.values(view)) counts[value] += 1;
    expect(Object.keys(view)).toHaveLength(19);
    expect(counts).toEqual({ owned: 1, seen: 6, hidden: 12, blocked: 0 });
    expect(view['0,0']).toBe('owned');
    expect(view['0,-1']).toBe('seen');
    expect(view['0,-2']).toBe('hidden');
  });

  it('shows a revealed wall as blocked and a hidden wall as hidden', () => {
    const settings = bundled();
    tileAt(settings, 0, -1).unavailable = true;
    tileAt(settings, 0, -2).unavailable = true;
    const view = startView(settings);
    expect(view['0,-1']).toBe('blocked');
    expect(view['0,-2']).toBe('hidden');
  });
});

describe('revealedBy', () => {
  it('lists the hidden cells the gate capture would reveal', () => {
    const settings = bundled();
    const cells = revealedBy(settings, { q: 0, r: -1 });
    expect(cells).toEqual([
      { q: 1, r: -2 },
      { q: 0, r: -2 },
      { q: -1, r: -1 }
    ]);
    const labels = cells.map(cell => tileAt(settings, cell.q, cell.r).label);
    expect(labels).toEqual(['(1,-2)', 'citadel', '(-1,-1)']);
  });

  it('includes a hidden cell itself', () => {
    expect(revealedBy(bundled(), { q: 0, r: -2 })).toEqual([
      { q: 0, r: -2 },
      { q: -1, r: -1 },
      { q: 1, r: -2 }
    ]);
  });
});

describe('kitUsage', () => {
  it('counts default kits and lists custom cells', () => {
    const settings = bundled();
    expect(kitUsage(settings)).toEqual({
      easy: { defaultCount: 16, customCells: [] },
      normal: { defaultCount: 1, customCells: [] },
      hard: { defaultCount: 1, customCells: [] }
    });
    tileAt(settings, 0, -1).defenderKit = { scissors: 7 };
    expect(kitUsage(settings).normal).toEqual({ defaultCount: 0, customCells: [{ q: 0, r: -1 }] });
  });
});

describe('mixedValue', () => {
  it('returns the shared value or mixed', () => {
    const settings = bundled();
    const gate = tileAt(settings, 0, -1);
    const neighbor = tileAt(settings, 1, -1);
    expect(mixedValue([gate, neighbor], 'product')).toBe('papers');
    expect(mixedValue([gate, neighbor], 'mines')).toBe(1);
    expect(mixedValue([gate, neighbor], 'difficulty')).toBe('mixed');
    expect(mixedValue([], 'mines')).toBe('mixed');

    const reward = { items: { stones: 1 }, currencies: { copper: 1 } };
    const copy = { ...neighbor, reward: { items: { stones: 1 }, currencies: { copper: 1 } } };
    expect(mixedValue([{ ...gate, reward }, copy], 'reward')).toEqual(reward);
    expect(mixedValue([copy, { ...copy, reward: { items: { stones: 2 }, currencies: {} } }], 'reward')).toBe('mixed');
  });
});
