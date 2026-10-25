import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function samePoint(a, b) {
    expect(a.col).toBeCloseTo(b.col, 5);
    expect(a.row).toBeCloseTo(b.row, 5);
}

function pivot(sheet) {
    return { col: sheet.pivotCol, row: sheet.pivotRow };
}

describe('HotMapUiPaperPrime', () => {
    it('keeps one new-paper disk plus a prime circle and round on the paper center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const paperPrime = new ctx.HotMapUiPaperPrime(heatMap, {
            name: 'Paper Prime',
            center: { col: 36, row: 250 },
            animate: false
        });
        const file = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'resources/prime-1.json'), 'utf8'));
        const entry = file.primes[0];
        const sheets = paperPrime.sheetList();
        expect(paperPrime.kind).toBe('hot-map-paper-prime');
        expect(sheets).toHaveLength(1);
        expect(sheets[0].kind).toBe('new-sheet');
        expect(sheets[0].radFrom).toBe(16);
        expect(sheets[0].depth).toBe(0);
        expect(paperPrime.circle.kind).toBe('circle');
        expect(paperPrime.round.kind).toBe('round');
        expect(paperPrime.circle.emitter.from).toMatchObject(entry.circle.from);
        expect(paperPrime.circle.emitter.cycling).toBe(entry.circle.cycling !== false);
        expect(paperPrime.round.emitter.from).toMatchObject(entry.round.from);
        expect(paperPrime.round.emitter.cycling).toBe(entry.round.cycling !== false);
        samePoint(paperPrime.circle.emitter.center, paperPrime.center);
        samePoint(paperPrime.round.emitter.center, paperPrime.center);
        samePoint(pivot(sheets[0]), paperPrime.center);
        expect(ctx.createComposite('paperPrime', heatMap, { animate: false }).kind).toBe('hot-map-paper-prime');
    });

    it('refuses a second disk and restores the one disk without dropping the shell', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const paperPrime = new ctx.HotMapUiPaperPrime(heatMap, { animate: false });
        const circle = paperPrime.circle;
        const round = paperPrime.round;
        const sheet = paperPrime.sheetList()[0];
        expect(paperPrime.addItem()).toBeNull();
        expect(paperPrime.sheetCount()).toBe(1);
        expect(paperPrime.removeItem()).toBe(sheet);
        expect(paperPrime.sheetCount()).toBe(0);
        expect(paperPrime.circle).toBe(circle);
        expect(paperPrime.round).toBe(round);
        const restored = paperPrime.addItem({ animate: false });
        expect(restored.kind).toBe('new-sheet');
        expect(restored.radFrom).toBe(16);
        expect(paperPrime.addItem()).toBeNull();
        samePoint(pivot(restored), paperPrime.center);
        samePoint(paperPrime.circle.emitter.center, paperPrime.center);
    });

    it('moves the disk, the circle, and the round when the paper is retargeted', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const paperPrime = new ctx.HotMapUiPaperPrime(heatMap, {
            center: { col: 36, row: 250 },
            animate: false
        });
        paperPrime.retarget({ col: 70, row: 40 });
        const sheet = paperPrime.sheetList()[0];
        samePoint(paperPrime.center, { col: 70, row: 40 });
        samePoint(pivot(sheet), paperPrime.center);
        samePoint(paperPrime.circle.emitter.center, paperPrime.center);
        samePoint(paperPrime.round.emitter.center, paperPrime.center);
        samePoint(paperPrime.round.emitter.target, paperPrime.center);
    });

    it('edits the circle and the round from the paper prime', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const paperPrime = new ctx.HotMapUiPaperPrime(heatMap, { animate: false });
        const outer = paperPrime.circle.emitter.from.outer;
        const radius = paperPrime.round.emitter.from.radius;
        const diskRadius = paperPrime.sheetList()[0].radFrom;
        expect(paperPrime.params.circle_fromOuter).toBe(outer);
        expect(paperPrime.params.round_cycling).toBe(true);
        paperPrime.nudgeParam('circle_fromOuter', 1);
        paperPrime.nudgeParam('round_fromRadius', 1);
        paperPrime.nudgeParam('radFrom', 1);
        expect(paperPrime.circle.emitter.from.outer).toBeGreaterThan(outer);
        expect(paperPrime.round.emitter.from.radius).toBeGreaterThan(radius);
        expect(paperPrime.sheetList()[0].radFrom).toBeGreaterThan(diskRadius);
        expect(paperPrime.circle.emitter.from.outer).not.toBe(paperPrime.sheetList()[0].radFrom);
        const loaded = new ctx.HotMapUiPaperPrime(heatMap, { animate: false });
        loaded.applySerialized(paperPrime.serialize());
        expect(loaded.circle.emitter.from.outer).toBe(paperPrime.circle.emitter.from.outer);
        expect(loaded.round.emitter.from.radius).toBe(paperPrime.round.emitter.from.radius);
        expect(loaded.sheetList()[0].radFrom).toBe(paperPrime.sheetList()[0].radFrom);
        samePoint(loaded.circle.emitter.center, loaded.center);
        samePoint(loaded.round.emitter.center, loaded.center);
    });
});
