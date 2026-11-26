import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { describe, expect, it } from 'vitest';
import { createEditorState, reduce, type EditorState } from './document.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function tileAt(doc: ChapterSettings, q: number, r: number): TileSettings {
  const tile = doc.tiles.find(item => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing ${q},${r}`);
  return tile;
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  return value;
}

const gate = { q: 0, r: -1 };
const normalKit = { stones: 9, scissors: 4, papers: 7, NA_effect_stone: 1 };

describe('reduce', () => {
  it('clears the four owner fields, remembers them, and restores them', () => {
    const initial = freeze(createEditorState(bundled(), 'bundled'));
    const reward = structuredClone(tileAt(initial.doc, 0, -1).reward);
    let state = reduce(initial, {
      type: 'setTiles',
      cells: [gate],
      patch: { npcAlgorithmId: 'npc-greed-v1', objective: true }
    });
    state = reduce(state, { type: 'setKit', cells: [gate], kit: { scissors: 7 } });
    const prepared = freeze(state);

    const owned = reduce(prepared, { type: 'setOwner', cells: [gate], owner: 'player' });
    const cleared = tileAt(owned.doc, 0, -1);
    expect(cleared.owner).toBe('player');
    expect(cleared.difficulty).toBeNull();
    expect(cleared.npcAlgorithmId).toBeUndefined();
    expect(cleared.reward).toBeUndefined();
    expect(cleared.defenderKit).toBeUndefined();
    expect(cleared.objective).toBeUndefined();
    expect(cleared.label).toBe('gate');
    expect(owned.ownerMemory['0,-1']).toEqual({
      difficulty: 'normal',
      npcAlgorithmId: 'npc-greed-v1',
      reward,
      defenderKit: { scissors: 7 }
    });
    expect(owned.ownerMemory['0,-1']?.reward).not.toBe(tileAt(prepared.doc, 0, -1).reward);
    expect(tileAt(prepared.doc, 0, -1).difficulty).toBe('normal');
    expect(tileAt(prepared.doc, 0, -1).objective).toBe(true);

    const again = reduce(owned, { type: 'setOwner', cells: [gate], owner: 'player' });
    expect(again.ownerMemory['0,-1']).toBe(owned.ownerMemory['0,-1']);

    const restored = tileAt(
      reduce(owned, { type: 'setOwner', cells: [gate], owner: 'neutral' }).doc,
      0,
      -1
    );
    expect(restored.owner).toBeUndefined();
    expect(restored.difficulty).toBe('normal');
    expect(restored.npcAlgorithmId).toBe('npc-greed-v1');
    expect(restored.reward).toEqual(reward);
    expect(restored.defenderKit).toEqual({ scissors: 7 });
    expect(restored.objective).toBeUndefined();
  });

  it('gives an owned tile with no memory difficulty easy and no algorithm, reward, or kit', () => {
    const state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setOwner',
      cells: [{ q: 0, r: 0 }],
      owner: 'neutral'
    });
    const camp = tileAt(state.doc, 0, 0);
    expect(camp.owner).toBeUndefined();
    expect(camp.difficulty).toBe('easy');
    expect(camp.npcAlgorithmId).toBeUndefined();
    expect(camp.reward).toBeUndefined();
    expect(camp.defenderKit).toBeUndefined();
    expect(camp.label).toBe('camp');
    expect(camp.product).toBe('copper');
    expect(state.ownerMemory['0,0']).toBeUndefined();
  });

  it('keeps a stash when the owner changes', () => {
    const stash = { items: { scissors: 4 }, currencies: { silver: 2, copper: 6 } };
    let state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setOwner',
      cells: [{ q: 0, r: 1 }],
      owner: 'player'
    });
    expect(tileAt(state.doc, 0, 1).stash).toEqual(stash);
    expect(tileAt(state.doc, 0, 1).owner).toBe('player');
    state = reduce(state, { type: 'setOwner', cells: [{ q: 0, r: 1 }], owner: 'neutral' });
    expect(tileAt(state.doc, 0, 1).stash).toEqual(stash);
    expect(tileAt(state.doc, 0, 1).owner).toBeUndefined();
    expect(tileAt(state.doc, 0, 1).difficulty).toBe('easy');
  });

  it('copies the difficulty kit and keeps that copy when the difficulty kit changes', () => {
    let state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setKit',
      cells: [gate],
      kit: 'copy-difficulty'
    });
    expect(tileAt(state.doc, 0, -1).defenderKit).toEqual(normalKit);
    expect(tileAt(state.doc, 0, -1).defenderKit).not.toBe(state.doc.defenderKits.normal);
    state = reduce(state, { type: 'setStack', path: ['defenderKits', 'normal'], items: { stones: 1 } });
    expect(tileAt(state.doc, 0, -1).defenderKit).toEqual(normalKit);
    expect(state.doc.defenderKits.normal).toEqual({ stones: 1 });
    state = reduce(state, { type: 'setKit', cells: [gate], kit: null });
    expect(tileAt(state.doc, 0, -1).defenderKit).toBeUndefined();
  });

  it('leaves the kit unchanged when copy-difficulty has no difficulty', () => {
    const state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setKit',
      cells: [{ q: 0, r: 0 }],
      kit: 'copy-difficulty'
    });
    expect(tileAt(state.doc, 0, 0).defenderKit).toBeUndefined();
    expect(tileAt(state.doc, 0, 0).owner).toBe('player');
  });

  it('removes the other battle-entry field and seeds the new one', () => {
    let state = reduce(createEditorState(bundled(), 'bundled'), { type: 'setAttackFee', fee: 4 });
    state = reduce(state, { type: 'setBattleEntry', entry: 'fee' });
    expect(state.doc.rules.attackFee).toBe(4);
    expect(state.doc.rules.battleKit).toBeUndefined();

    state = reduce(state, { type: 'setBattleEntry', entry: 'wager' });
    expect(state.doc.rules.battleEntry).toBe('wager');
    expect(state.doc.rules.attackFee).toBeUndefined();
    expect(state.doc.rules.battleKit).toEqual({});

    state = reduce(state, { type: 'setStack', path: ['rules', 'battleKit'], items: { stones: 2 } });
    state = reduce(state, { type: 'setBattleEntry', entry: 'wager' });
    expect(state.doc.rules.battleKit).toEqual({ stones: 2 });

    state = reduce(state, { type: 'setBattleEntry', entry: 'fee' });
    expect(state.doc.rules.battleEntry).toBe('fee');
    expect(state.doc.rules.battleKit).toBeUndefined();
    expect(state.doc.rules.attackFee).toBe(10);
  });

  it('drops a marketplace key when the price is null', () => {
    const state = freeze(createEditorState(bundled(), 'bundled'));
    const next = reduce(state, { type: 'setMarketplaceItem', item: 'stones', price: null });
    expect(next.doc.rules.marketplace.stones).toBeUndefined();
    expect(state.doc.rules.marketplace.stones).toBe(3);
    expect(reduce(next, { type: 'setMarketplaceItem', item: 'stones', price: 5 }).doc.rules.marketplace.stones).toBe(5);
  });

  it('sets and clears a reward and a stash', () => {
    const reward = { items: { stones: 1 }, currencies: { copper: 2 } };
    let state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setReward',
      cells: [{ q: 1, r: -1 }],
      reward
    });
    expect(tileAt(state.doc, 1, -1).reward).toEqual(reward);
    expect(tileAt(state.doc, 1, -1).reward).not.toBe(reward);
    state = reduce(state, { type: 'setReward', cells: [{ q: 1, r: -1 }], reward: null });
    expect(tileAt(state.doc, 1, -1).reward).toBeUndefined();

    state = reduce(state, { type: 'setStash', cells: [gate], stash: reward });
    expect(tileAt(state.doc, 0, -1).stash).toEqual(reward);
    state = reduce(state, { type: 'setStash', cells: [gate], stash: null });
    expect(tileAt(state.doc, 0, -1).stash).toBeUndefined();
  });

  it('unions cells when the selection is additive', () => {
    let state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'select',
      cells: [{ q: 0, r: 0 }]
    });
    state = reduce(state, { type: 'select', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }], additive: true });
    expect(state.selection).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    state = reduce(state, { type: 'select', cells: [{ q: 1, r: -1 }] });
    expect(state.selection).toEqual([{ q: 1, r: -1 }]);
  });

  it('makes a tile unavailable in one step and restores a neutral fight', () => {
    const state = reduce(createEditorState(bundled(), 'bundled'), {
      type: 'setUnavailable',
      cells: [gate],
      unavailable: true
    });
    const wall = tileAt(state.doc, 0, -1);
    expect(wall.unavailable).toBe(true);
    expect(wall.owner).toBeUndefined();
    expect(wall.objective).toBeUndefined();
    expect(wall.difficulty).toBeNull();
    expect(wall.mines).toBe(0);
    expect(wall.maxMines).toBe(0);
    expect(wall.reward).toBeUndefined();
    expect(wall.defenderKit).toBeUndefined();
    expect(wall.stash).toBeUndefined();
    expect(wall.label).toBe('gate');
    expect(wall.product).toBe('papers');

    const camp = reduce(state, { type: 'setUnavailable', cells: [{ q: 0, r: 0 }], unavailable: true });
    expect(tileAt(camp.doc, 0, 0).owner).toBeUndefined();
    expect(tileAt(camp.doc, 0, 0).unavailable).toBe(true);
    expect(tileAt(camp.doc, 0, 0).product).toBe('copper');

    const restored = reduce(state, { type: 'setUnavailable', cells: [gate], unavailable: false });
    const fight = tileAt(restored.doc, 0, -1);
    expect(fight.unavailable).toBeUndefined();
    expect(fight).toMatchObject({
      difficulty: 'easy',
      mines: 1,
      maxMines: 1,
      product: 'papers',
      revealed: true,
      label: 'gate'
    });
    expect(fight.reward).toBeUndefined();
    expect(fight.defenderKit).toBeUndefined();
  });

  it('keeps the baseline independent of the document', () => {
    const state: EditorState = createEditorState(bundled(), 'bundled');
    state.doc.title = 'Changed';
    expect(state.baseline.title).toBe('Chapter I');
  });
});
