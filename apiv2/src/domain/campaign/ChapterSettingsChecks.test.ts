import { describe, expect, it } from 'vitest';
import { bundled, patchTile, tileAt, tileIndex } from './__fixtures__/chapterSettings.js';
import {
  chapterErrors,
  checkChapterSettings,
  type ChapterSettings,
  type Problem,
  type ProblemCode
} from './ChapterSettingsSchema.js';

function ofCode(settings: ChapterSettings, code: ProblemCode, baseline?: ChapterSettings): Problem[] {
  return checkChapterSettings(settings, baseline === undefined ? undefined : { baseline })
    .filter(item => item.code === code);
}

function the(settings: ChapterSettings, code: ProblemCode, baseline?: ChapterSettings): Problem {
  const found = ofCode(settings, code, baseline);
  expect(found).toHaveLength(1);
  return found[0];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as object)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

const COPPER_TILES = [
  { q: 0, r: 0 },
  { q: -1, r: 1 },
  { q: 2, r: -1 },
  { q: 0, r: 2 }
];

describe('checkChapterSettings', () => {
  it('returns four dig-net warnings and no errors for the bundled file', () => {
    const settings = deepFreeze(bundled());
    const problems = checkChapterSettings(settings, { baseline: deepFreeze(bundled()) });
    expect(chapterErrors(problems)).toEqual([]);
    expect(problems.map(item => item.code)).toEqual(['dig-net', 'dig-net', 'dig-net', 'dig-net']);
    expect(problems.map(item => item.level)).toEqual(['warning', 'warning', 'warning', 'warning']);
    expect(problems.map(item => item.tile)).toEqual(COPPER_TILES);
    expect(problems.map(item => item.path)).toEqual(
      COPPER_TILES.map(cell => ['tiles', tileIndex(settings, cell.q, cell.r), 'mines'])
    );
  });

  it('lists errors before warnings, and tiles in file order', () => {
    const settings = bundled();
    settings.tileCount = 3;
    const east = tileIndex(settings, 2, 0);
    const west = tileIndex(settings, -2, 0);
    patchTile(settings, 2, 0, { q: 9 });
    patchTile(settings, -2, 0, { q: 9, r: 9 });
    const problems = checkChapterSettings(settings);
    expect(problems.map(item => item.code)).toEqual([
      'tile-count',
      'tile-off-map',
      'tile-off-map',
      'dig-net',
      'dig-net',
      'dig-net',
      'dig-net'
    ]);
    expect(problems[1].path).toEqual(['tiles', east]);
    expect(problems[1].tile).toEqual({ q: 9, r: 0 });
    expect(problems[2].path).toEqual(['tiles', west]);
    expect(problems[2].tile).toEqual({ q: 9, r: 9 });
  });

  it('reports tile-count when the count or the list is not 19', () => {
    const count = bundled();
    count.tileCount = 18;
    const countProblem = the(count, 'tile-count');
    expect(countProblem).toMatchObject({ level: 'error', path: ['tileCount'] });
    expect(countProblem.tile).toBeUndefined();

    const short = bundled();
    short.tiles.pop();
    const lengthProblem = the(short, 'tile-count');
    expect(lengthProblem).toMatchObject({ level: 'error', path: ['tiles'] });
    expect(lengthProblem.tile).toBeUndefined();

    const both = bundled();
    both.tileCount = 18;
    both.tiles.pop();
    expect(ofCode(both, 'tile-count').map(item => item.path)).toEqual([['tileCount'], ['tiles']]);
  });

  it('reports tile-off-map', () => {
    const settings = bundled();
    const index = tileIndex(settings, 1, 0);
    patchTile(settings, 1, 0, { q: 5 });
    expect(the(settings, 'tile-off-map')).toMatchObject({
      level: 'error',
      path: ['tiles', index],
      tile: { q: 5, r: 0 }
    });
  });

  it('reports tile-duplicate on the later tile', () => {
    const settings = bundled();
    const index = tileIndex(settings, 1, -1);
    patchTile(settings, 1, -1, { q: 0, r: -1 });
    expect(the(settings, 'tile-duplicate')).toMatchObject({
      level: 'error',
      path: ['tiles', index],
      tile: { q: 0, r: -1 }
    });
  });

  it('reports mines-range when mines exceed maxMines or maxMines is below 1', () => {
    const high = bundled();
    const gate = tileIndex(high, 0, -1);
    patchTile(high, 0, -1, { mines: 9 });
    expect(the(high, 'mines-range')).toMatchObject({
      level: 'error',
      path: ['tiles', gate, 'mines'],
      tile: { q: 0, r: -1 }
    });

    const low = bundled();
    const index = tileIndex(low, 1, 0);
    patchTile(low, 1, 0, { mines: 0, maxMines: 0 });
    expect(the(low, 'mines-range')).toMatchObject({
      level: 'error',
      path: ['tiles', index, 'maxMines'],
      tile: { q: 1, r: 0 }
    });

    const both = bundled();
    const bothIndex = tileIndex(both, 0, -1);
    patchTile(both, 0, -1, { mines: 4, maxMines: 0 });
    expect(ofCode(both, 'mines-range').map(item => item.path)).toEqual([
      ['tiles', bothIndex, 'mines'],
      ['tiles', bothIndex, 'maxMines']
    ]);
  });

  it('reports no-owned-tile', () => {
    const settings = bundled();
    delete tileAt(settings, 0, 0).owner;
    const reported = the(settings, 'no-owned-tile');
    expect(reported).toMatchObject({ level: 'error', path: ['tiles'] });
    expect(reported.tile).toBeUndefined();
  });

  it('reports no-objective', () => {
    const settings = bundled();
    delete tileAt(settings, 0, -2).objective;
    const reported = the(settings, 'no-objective');
    expect(reported).toMatchObject({ level: 'error', path: ['tiles'] });
    expect(reported.tile).toBeUndefined();
  });

  it('reports objective-owned', () => {
    const settings = bundled();
    patchTile(settings, 0, 0, { objective: true });
    expect(the(settings, 'objective-owned')).toMatchObject({
      level: 'error',
      path: ['tiles', 0, 'objective'],
      tile: { q: 0, r: 0 }
    });
    expect(ofCode(settings, 'owned-field')).toEqual([]);
  });

  it('reports difficulty-missing', () => {
    const settings = bundled();
    const index = tileIndex(settings, 0, -1);
    patchTile(settings, 0, -1, { difficulty: null });
    expect(the(settings, 'difficulty-missing')).toMatchObject({
      level: 'error',
      path: ['tiles', index, 'difficulty'],
      tile: { q: 0, r: -1 }
    });
  });

  it('reports owned-field for difficulty, reward, algorithm, and kit', () => {
    const settings = bundled();
    patchTile(settings, 0, 0, {
      difficulty: 'easy',
      reward: { items: { stones: 1 }, currencies: {} },
      npcAlgorithmId: 'npc-v1',
      defenderKit: { stones: 1 }
    });
    expect(ofCode(settings, 'owned-field').map(item => item.path)).toEqual([
      ['tiles', 0, 'difficulty'],
      ['tiles', 0, 'reward'],
      ['tiles', 0, 'npcAlgorithmId'],
      ['tiles', 0, 'defenderKit']
    ]);
    expect(ofCode(settings, 'owned-field').every(item => item.level === 'error' && item.tile?.q === 0)).toBe(true);
    expect(ofCode(settings, 'npc-unknown')).toEqual([]);
  });

  it('reports npc-unknown', () => {
    const known = bundled();
    patchTile(known, 0, -1, { npcAlgorithmId: 'npc-v1' });
    patchTile(known, 1, 0, { npcAlgorithmId: 'npc-greed-v1' });
    expect(ofCode(known, 'npc-unknown')).toEqual([]);

    const settings = bundled();
    const index = tileIndex(settings, 0, -1);
    patchTile(settings, 0, -1, { npcAlgorithmId: 'npc-missing' });
    const reported = the(settings, 'npc-unknown');
    expect(reported).toMatchObject({
      level: 'error',
      path: ['tiles', index, 'npcAlgorithmId'],
      tile: { q: 0, r: -1 }
    });
    expect(reported.message).toContain('npc-missing');
  });

  it('reports entry-field when fee and wager have the wrong companion', () => {
    const missingFee = bundled();
    delete missingFee.rules.attackFee;
    expect(the(missingFee, 'entry-field')).toMatchObject({
      level: 'error',
      path: ['rules', 'attackFee']
    });

    const feeAndKit = bundled();
    delete feeAndKit.rules.attackFee;
    feeAndKit.rules.battleKit = { stones: 1 };
    expect(ofCode(feeAndKit, 'entry-field').map(item => item.path)).toEqual([
      ['rules', 'attackFee'],
      ['rules', 'battleKit']
    ]);

    const missingKit = bundled();
    missingKit.rules.battleEntry = 'wager';
    delete missingKit.rules.attackFee;
    expect(the(missingKit, 'entry-field')).toMatchObject({
      level: 'error',
      path: ['rules', 'battleKit']
    });

    const wagerAndFee = bundled();
    wagerAndFee.rules.battleEntry = 'wager';
    wagerAndFee.rules.battleKit = {};
    expect(the(wagerAndFee, 'entry-field')).toMatchObject({
      level: 'error',
      path: ['rules', 'attackFee']
    });

    const explicitFree = bundled();
    explicitFree.rules.attackFee = 0;
    expect(ofCode(explicitFree, 'entry-field')).toEqual([]);

    const wager = bundled();
    wager.rules.battleEntry = 'wager';
    delete wager.rules.attackFee;
    wager.rules.battleKit = {};
    expect(ofCode(wager, 'entry-field')).toEqual([]);
  });

  it('reports price-zero', () => {
    const settings = bundled();
    settings.rules.marketplace.stones = 0;
    settings.rules.marketplace.NT_effect = 0;
    const found = ofCode(settings, 'price-zero');
    expect(found.map(item => item.path)).toEqual([
      ['rules', 'marketplace', 'stones'],
      ['rules', 'marketplace', 'NT_effect']
    ]);
    expect(found.every(item => item.level === 'error' && item.tile === undefined)).toBe(true);
    expect(chapterErrors(checkChapterSettings(settings)).map(item => item.code)).toEqual([
      'price-zero',
      'price-zero'
    ]);
  });

  it('reports action-points-zero', () => {
    const settings = bundled();
    settings.rules.actionPointsPerTurn = 0;
    const reported = the(settings, 'action-points-zero');
    expect(reported).toMatchObject({ level: 'error', path: ['rules', 'actionPointsPerTurn'] });
    expect(reported.tile).toBeUndefined();
    expect(checkChapterSettings(settings)[0].code).toBe('action-points-zero');
  });

  it('warns version-unchanged when a price changes and the version does not', () => {
    const baseline = bundled();
    const settings = bundled();
    settings.rules.marketplace.stones = 4;
    expect(ofCode(settings, 'version-unchanged')).toEqual([]);
    const reported = the(settings, 'version-unchanged', baseline);
    expect(reported).toMatchObject({ level: 'warning', path: ['rulesetVersion'] });
    expect(reported.tile).toBeUndefined();
    expect(reported.message.endsWith('Best score keeps the highest total over all versions.')).toBe(true);
    expect(checkChapterSettings(settings, { baseline })[0].code).toBe('version-unchanged');
  });

  it('does not warn version-unchanged for a new title, goal, or tile label', () => {
    const baseline = bundled();
    const edits = [
      (settings: ChapterSettings) => { settings.title = 'Renamed'; },
      (settings: ChapterSettings) => { settings.goal = 'A new goal.'; },
      (settings: ChapterSettings) => { patchTile(settings, 0, 0, { label: 'home' }); }
    ];
    for (const edit of edits) {
      const settings = bundled();
      edit(settings);
      expect(ofCode(settings, 'version-unchanged', baseline)).toEqual([]);
    }
  });

  it('does not warn version-unchanged when the version is bumped', () => {
    const baseline = bundled();
    const settings = bundled();
    settings.rules.marketplace.stones = 4;
    settings.rulesetVersion = 2;
    expect(ofCode(settings, 'version-unchanged', baseline)).toEqual([]);
  });

  it('reports objective-many on each objective after the first', () => {
    const settings = bundled();
    const index = tileIndex(settings, 2, -2);
    patchTile(settings, 2, -2, { objective: true });
    expect(the(settings, 'objective-many')).toMatchObject({
      level: 'warning',
      path: ['tiles', index, 'objective'],
      tile: { q: 2, r: -2 }
    });
  });

  it('reports action-points-many', () => {
    const settings = bundled();
    settings.rules.actionPointsPerTurn = 2;
    const reported = the(settings, 'action-points-many');
    expect(reported).toMatchObject({ level: 'warning', path: ['rules', 'actionPointsPerTurn'] });
    expect(reported.tile).toBeUndefined();
  });

  it('reports economy-point', () => {
    const settings = bundled();
    settings.rules.economyConsumesActionPoint = true;
    const reported = the(settings, 'economy-point');
    expect(reported).toMatchObject({ level: 'warning', path: ['rules', 'economyConsumesActionPoint'] });
    expect(reported.tile).toBeUndefined();
  });

  it('reports neighbor-hidden in tile order', () => {
    const settings = bundled();
    patchTile(settings, 1, 0, { revealed: false });
    patchTile(settings, 0, -1, { revealed: false });
    expect(ofCode(settings, 'neighbor-hidden')).toEqual([
      expect.objectContaining({
        level: 'warning',
        path: ['tiles', tileIndex(settings, 0, -1), 'revealed'],
        tile: { q: 0, r: -1 }
      }),
      expect.objectContaining({
        level: 'warning',
        path: ['tiles', tileIndex(settings, 1, 0), 'revealed'],
        tile: { q: 1, r: 0 }
      })
    ]);
  });

  it('reports objective-adjacent', () => {
    const settings = bundled();
    const index = tileIndex(settings, 0, -1);
    patchTile(settings, 0, -1, { objective: true });
    expect(the(settings, 'objective-adjacent')).toMatchObject({
      level: 'warning',
      path: ['tiles', index, 'objective'],
      tile: { q: 0, r: -1 }
    });
  });

  it('reports label-duplicate for a repeated non-empty label', () => {
    const settings = bundled();
    const index = tileIndex(settings, 1, -1);
    patchTile(settings, 1, -1, { label: 'camp' });
    expect(the(settings, 'label-duplicate')).toMatchObject({
      level: 'warning',
      path: ['tiles', index, 'label'],
      tile: { q: 1, r: -1 }
    });

    const blanks = bundled();
    patchTile(blanks, 1, -1, { label: '' });
    patchTile(blanks, 1, 0, { label: '' });
    expect(ofCode(blanks, 'label-duplicate')).toEqual([]);
  });

  it('reports fee-unaffordable above starting copper plus one turn of income', () => {
    const settings = bundled();
    settings.rules.attackFee = 18;
    expect(ofCode(settings, 'fee-unaffordable')).toEqual([]);
    settings.rules.attackFee = 19;
    const reported = the(settings, 'fee-unaffordable');
    expect(reported).toMatchObject({ level: 'warning', path: ['rules', 'attackFee'] });
    expect(reported.tile).toBeUndefined();

    const wager = bundled();
    wager.rules.battleEntry = 'wager';
    wager.rules.battleKit = {};
    wager.rules.attackFee = 100;
    expect(ofCode(wager, 'fee-unaffordable')).toEqual([]);
  });

  it('reports objective-stash', () => {
    const settings = bundled();
    const index = tileIndex(settings, 0, -2);
    patchTile(settings, 0, -2, {
      stash: { items: { papers: 1 }, currencies: {} }
    });
    expect(the(settings, 'objective-stash')).toMatchObject({
      level: 'warning',
      path: ['tiles', index, 'stash'],
      tile: { q: 0, r: -2 }
    });
  });

  it('reports reward-empty on normal and hard tiles without a reward', () => {
    const settings = bundled();
    delete tileAt(settings, 0, -1).reward;
    delete tileAt(settings, 0, -2).reward;
    expect(ofCode(settings, 'reward-empty')).toEqual([
      expect.objectContaining({
        level: 'warning',
        path: ['tiles', tileIndex(settings, 0, -1), 'reward'],
        tile: { q: 0, r: -1 }
      }),
      expect.objectContaining({
        level: 'warning',
        path: ['tiles', tileIndex(settings, 0, -2), 'reward'],
        tile: { q: 0, r: -2 }
      })
    ]);
  });

  it('reports mines-zero, and says owned on an owned tile', () => {
    const neutral = bundled();
    const gate = tileIndex(neutral, 0, -1);
    patchTile(neutral, 0, -1, { mines: 0 });
    const neutralProblem = the(neutral, 'mines-zero');
    expect(neutralProblem).toMatchObject({
      level: 'warning',
      path: ['tiles', gate, 'mines'],
      tile: { q: 0, r: -1 }
    });
    expect(neutralProblem.message).not.toContain('owned');

    const owned = bundled();
    patchTile(owned, 0, 0, { mines: 0 });
    const ownedProblem = the(owned, 'mines-zero');
    expect(ownedProblem).toMatchObject({
      level: 'warning',
      path: ['tiles', 0, 'mines'],
      tile: { q: 0, r: 0 }
    });
    expect(ownedProblem.message).toContain('owned');
  });

  it('reports dig-net for copper tiles whose dig pays nothing', () => {
    const free = bundled();
    free.rules.digCost = 0;
    expect(ofCode(free, 'dig-net')).toEqual([]);

    const settings = bundled();
    patchTile(settings, 0, 0, { mines: 3 });
    expect(ofCode(settings, 'dig-net').map(item => item.tile)).toEqual([
      { q: -1, r: 1 },
      { q: 2, r: -1 },
      { q: 0, r: 2 }
    ]);
  });

  it('reports kit-size against the next and previous difficulty kits', () => {
    const small = bundled();
    const gate = tileIndex(small, 0, -1);
    patchTile(small, 0, -1, { defenderKit: { stones: 12 } });
    expect(the(small, 'kit-size')).toMatchObject({
      level: 'warning',
      path: ['tiles', gate, 'defenderKit'],
      tile: { q: 0, r: -1 },
      message: 'Kit total is below the previous difficulty'
    });

    const equal = bundled();
    patchTile(equal, 0, -1, { defenderKit: { stones: 13 } });
    expect(ofCode(equal, 'kit-size')).toEqual([]);

    const easy = bundled();
    const easyIndex = tileIndex(easy, 1, -1);
    patchTile(easy, 1, -1, { defenderKit: { stones: 22 } });
    expect(the(easy, 'kit-size')).toMatchObject({
      level: 'warning',
      path: ['tiles', easyIndex, 'defenderKit'],
      tile: { q: 1, r: -1 },
      message: 'Kit total is above the next difficulty'
    });

    const matching = bundled();
    patchTile(matching, 1, -1, { defenderKit: { stones: 21 } });
    expect(ofCode(matching, 'kit-size')).toEqual([]);
  });

  it('reports kit-no-gestures', () => {
    const settings = bundled();
    const index = tileIndex(settings, 1, -1);
    patchTile(settings, 1, -1, { defenderKit: {} });
    expect(the(settings, 'kit-no-gestures')).toMatchObject({
      level: 'warning',
      path: ['tiles', index, 'defenderKit'],
      tile: { q: 1, r: -1 }
    });
    expect(ofCode(settings, 'kit-size')).toEqual([]);

    const gestured = bundled();
    patchTile(gestured, 1, -1, { defenderKit: { stones: 1 } });
    expect(ofCode(gestured, 'kit-no-gestures')).toEqual([]);
  });
});
