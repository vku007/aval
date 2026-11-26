import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/chapter-i.definition.json';
import { bundled, tileAt } from './__fixtures__/chapterSettings.js';
import { positiveCurrencies, positiveItems } from './CampaignInventory.js';
import { CHAPTER_I } from './ChapterI.js';
import {
  buildChapterDefinition,
  effectiveReward,
  tileRounds
} from './ChapterDefinitionBuilder.js';

describe('ChapterDefinitionBuilder', () => {
  it('matches the definition captured before the builder moved', () => {
    expect(JSON.parse(JSON.stringify(CHAPTER_I))).toEqual(golden);
  });

  it('uses a tile defenderKit as the whole garrison', () => {
    const settings = bundled();
    const gate = settings.tiles.find(tile => tile.q === 0 && tile.r === -1);
    if (!gate) {
      throw new Error('expected the gate');
    }
    gate.defenderKit = { scissors: 9 };
    expect(gate.difficulty).toBe('normal');

    const definition = buildChapterDefinition(settings);
    const tile = definition.tiles.find(item => item.q === 0 && item.r === -1);
    if (!tile?.garrison) {
      throw new Error('expected a garrison on the gate');
    }
    expect(positiveItems(tile.garrison.inventory.items)).toEqual({ scissors: 9 });
    expect(positiveCurrencies(tile.garrison.inventory.currencies)).toEqual({});
  });

  it('resolves the effective reward', () => {
    const settings = bundled();
    const easy = settings.tiles.find(tile => tile.difficulty === 'easy' && tile.reward === undefined);
    if (!easy) {
      throw new Error('expected an easy tile without a reward');
    }
    expect(effectiveReward(settings, easy)).toEqual(settings.easyRewards[easy.product]);

    const normal = { ...easy, difficulty: 'normal' as const };
    expect(effectiveReward(settings, normal)).toEqual({ items: {}, currencies: {} });

    const custom = {
      ...easy,
      reward: { items: { stones: 5 }, currencies: { copper: 1 } }
    };
    expect(effectiveReward(settings, custom)).toEqual(custom.reward);
  });

  it('uses the difficulty rounds and skips an owned tile', () => {
    const settings = bundled();
    const owned = settings.tiles.find(tile => tile.owner === 'player');
    const hard = settings.tiles.find(tile => tile.difficulty === 'hard');
    if (!owned || !hard) {
      throw new Error('expected an owned tile and a hard tile');
    }
    expect(tileRounds(settings, owned)).toBeNull();
    expect(tileRounds(settings, hard)).toBe(settings.rounds.hard);
  });

  it('builds an unavailable tile as a disabled wall', () => {
    const settings = bundled();
    const gate = tileAt(settings, 0, -1);
    delete gate.owner;
    delete gate.objective;
    delete gate.reward;
    delete gate.stash;
    delete gate.defenderKit;
    delete gate.npcAlgorithmId;
    gate.unavailable = true;
    gate.difficulty = null;
    gate.mines = 0;
    gate.maxMines = 0;

    const definition = buildChapterDefinition(settings);
    const tile = definition.tiles.find(item => item.q === 0 && item.r === -1);
    expect(tile).toMatchObject({
      enabled: false,
      owner: null,
      revealed: true,
      objective: false,
      product: 'papers',
      mines: 0,
      maxMines: 0,
      stashes: [],
      difficulty: null,
      rounds: null,
      label: 'gate',
      garrison: null,
      victoryReward: { items: {}, currencies: {} }
    });
  });
});
