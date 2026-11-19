import { describe, expect, it } from 'vitest';
import chapterI from './chapter-i.json';
import { parseChapterSettings, safeParseChapterSettings } from './ChapterSettingsSchema.js';

function clone(): any {
  return structuredClone(chapterI);
}

function issueFor(value: unknown) {
  const parsed = safeParseChapterSettings(value);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    throw new Error('expected settings to fail');
  }
  const issue = parsed.issues[0];
  expect(issue).toBeDefined();
  expect(() => parseChapterSettings(value)).toThrow(
    `Chapter settings ${issue.path.join('.')}: ${issue.message}`
  );
  return issue;
}

describe('ChapterSettingsSchema', () => {
  it('parses the bundled file unchanged', () => {
    expect(parseChapterSettings(chapterI)).toEqual(chapterI);
  });

  it('rejects a negative count', () => {
    const doc = clone();
    doc.tiles[7].mines = -1;
    expect(issueFor(doc).path).toEqual(['tiles', 7, 'mines']);
  });

  it('rejects a non-integer count', () => {
    const doc = clone();
    doc.rules.digCost = 1.5;
    expect(issueFor(doc).path).toEqual(['rules', 'digCost']);
  });

  it('rejects an unknown item key in a tile stash', () => {
    const doc = clone();
    const index = doc.tiles.findIndex((tile: { stash?: unknown }) => tile.stash);
    doc.tiles[index].stash.items.not_an_item = 1;
    const issue = issueFor(doc);
    expect(issue.path.at(-1)).toBe('not_an_item');
    expect(issue.path).toEqual(['tiles', index, 'stash', 'items', 'not_an_item']);
  });

  it('rejects an unknown currency key', () => {
    const doc = clone();
    doc.startingInventory.currencies.platinum = 1;
    expect(issueFor(doc).path).toEqual(['startingInventory', 'currencies', 'platinum']);
  });

  it('rejects an unknown top-level field', () => {
    const doc = clone();
    doc.author = 'designer';
    expect(issueFor(doc).path).toEqual(['author']);
  });

  it('rejects an unknown tile field', () => {
    const doc = clone();
    doc.tiles[0].note = 'camp note';
    expect(issueFor(doc).path).toEqual(['tiles', 0, 'note']);
  });

  it('rejects a bad rounds value', () => {
    const doc = clone();
    doc.rounds.easy = 'BO3';
    expect(issueFor(doc).path).toEqual(['rounds', 'easy']);
  });

  it('rejects an unknown difficulty', () => {
    const doc = clone();
    doc.tiles[1].difficulty = 'extreme';
    expect(issueFor(doc).path).toEqual(['tiles', 1, 'difficulty']);
  });

  it('rejects an owner other than player', () => {
    const doc = clone();
    doc.tiles[1].owner = 'npc';
    expect(issueFor(doc).path).toEqual(['tiles', 1, 'owner']);
  });

  it('rejects a file with no rules', () => {
    const doc = clone();
    delete doc.rules;
    expect(issueFor(doc).path).toEqual(['rules']);
  });

  it('parses a tile defender kit', () => {
    const doc = clone();
    doc.tiles[1].defenderKit = { scissors: 9 };
    expect(parseChapterSettings(doc)).toEqual(doc);
  });
});
