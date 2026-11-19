import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { describe, expect, it } from 'vitest';
import type { Route } from '../model/document.js';
import { referenceRoutes, walkRoute } from './walk.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function routeNamed(name: string): Route {
  const route = referenceRoutes().find((item) => item.name === name);
  if (!route) throw new Error(`missing reference route ${name}`);
  return route;
}

describe('reference routes on the bundled chapter', () => {
  const settings = bundled();

  it('loads the four score examples', () => {
    expect(referenceRoutes().map((route) => route.name)).toEqual([
      'Bare rush',
      'South stash',
      'South stash plus (1,0)',
      'Lose the gate once'
    ]);
  });

  it('scores the bare rush at 200 in 2 turns', () => {
    const result = walkRoute(settings, routeNamed('Bare rush'));
    expect(result.completed).toBe(true);
    expect(result.score).toEqual({ total: 200, turns: 2, victories: 2, silver: 3, copper: 0 });
    expect(result.steps.at(-1)).toMatchObject({ ok: true, turn: 2 });
  });

  it('stops the south-stash route at the citadel attack with 6 copper', () => {
    const result = walkRoute(settings, routeNamed('South stash'));
    const failed = result.steps.at(-1);
    expect(result.completed).toBe(false);
    expect(result.score).toBeNull();
    expect(failed).toMatchObject({
      ok: false,
      copper: 6,
      step: { type: 'attack', q: 0, r: -2 }
    });
    expect(failed?.error).toContain('Not enough copper');
  });

  it('stops the south stash plus (1,0) at the gate with 4 copper', () => {
    const result = walkRoute(settings, routeNamed('South stash plus (1,0)'));
    expect(result.steps.at(-1)).toMatchObject({
      ok: false,
      copper: 4,
      step: { type: 'attack', q: 0, r: -1 }
    });
    expect(result.steps.at(-1)?.error).toContain('Not enough copper');
  });

  it('finishes a lost gate then the rush in 6 turns at 0', () => {
    const result = walkRoute(settings, routeNamed('Lose the gate once'));
    expect(result.completed).toBe(true);
    expect(result.score).toMatchObject({ total: 0, turns: 6 });
    expect(result.steps[0]).toMatchObject({ ok: true, owned: 1, copper: 6, turn: 1 });
  });

  it('lets the south-stash route finish when starting copper is 4 higher', () => {
    const richer = structuredClone(settings);
    richer.startingInventory.currencies.copper = (richer.startingInventory.currencies.copper ?? 0) + 4;
    const result = walkRoute(richer, routeNamed('South stash'));
    expect(result.completed).toBe(true);
    expect(result.score).not.toBeNull();
  });
});

describe('walkRoute', () => {
  it('runs dig, upgrade, and buy on the campaign', () => {
    const result = walkRoute(bundled(), {
      name: 'economy',
      steps: [
        { type: 'dig', q: 0, r: 0 },
        { type: 'upgrade', q: 0, r: 0 },
        { type: 'buy', item: 'stones', amount: 1 },
        { type: 'end_turn' }
      ]
    });
    expect(result.steps.map((step) => step.ok)).toEqual([true, true, true, true]);
    expect(result.completed).toBe(true);
    expect(result.score).toBeNull();
  });

  it('does not run steps after the first rejection', () => {
    const result = walkRoute(bundled(), {
      name: 'blocked',
      steps: [
        { type: 'attack', q: 2, r: 0 },
        { type: 'end_turn' }
      ]
    });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].ok).toBe(false);
    expect(result.steps[0].error).toContain('hidden');
    expect(result.completed).toBe(false);
  });
});
