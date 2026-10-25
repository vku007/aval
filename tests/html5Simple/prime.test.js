import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

const DT = 1000 / 60;

function samePoint(a, b) {
    expect(a.col).toBeCloseTo(b.col, 5);
    expect(a.row).toBeCloseTo(b.row, 5);
}

function stepField(heatMap, frames) {
    for (let frame = 0; frame < frames; frame += 1) {
        heatMap.field.update(frame * DT, DT);
    }
}

describe('UiPrime', () => {
    it('puts one circle, one cycling round, and one cycling round item on the same center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { name: 'Prime', centerX: 40, centerY: 60, animate: false });
        expect(prime.kind).toBe('prime');
        expect(prime.circle.kind).toBe('circle');
        expect(prime.round.kind).toBe('round');
        expect(prime.item.kind).toBe('round');
        expect(prime.item).not.toBe(prime.round);
        expect(prime.circle.emitter.cycling).toBe(true);
        expect(prime.circle.emitter.from.outer).toBe(48);
        expect(prime.circle.emitter.from.inner).toBe(44);
        expect(prime.round.emitter.cycling).toBe(true);
        expect(prime.round.emitter.from.radius).toBe(prime.circle.emitter.from.inner);
        expect(prime.item.emitter.cycling).toBe(true);
        samePoint(prime.circle.emitter.center, prime.center);
        samePoint(prime.round.emitter.center, prime.center);
        samePoint(prime.item.emitter.center, prime.center);
        samePoint(prime.item.emitter.target, prime.center);
        expect(ctx.createItem('prime', heatMap).kind).toBe('prime');
        expect(ctx.createComposite('prime', heatMap).kind).toBe('prime');
    });

    it('takes circle, round, and item defaults from prime-1.json', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { name: 'Prime', centerX: 40, centerY: 60, animate: false });
        const file = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'resources/prime-1.json'), 'utf8'));
        const entry = file.primes[0];
        expect(prime.circle.emitter.from).toMatchObject(entry.circle.from);
        expect(prime.circle.emitter.to).toMatchObject(entry.circle.to);
        expect(prime.circle.emitter.cycling).toBe(entry.circle.cycling !== false);
        expect(prime.circle.emitter.glistenOn).toBe(entry.circle.glistenOn !== false);
        expect(prime.circle.emitter.params.speed).toBe(entry.circle.params.speed);
        expect(prime.circle.emitter.params.glistenSpeed).toBe(entry.circle.params.glistenSpeed);
        expect(prime.circle.emitter.params.glistenPower).toBe(entry.circle.params.glistenPower);
        expect(prime.circle.emitter.glisten).toBeCloseTo(entry.circle.glisten, 5);
        expect(prime.round.emitter.from).toMatchObject(entry.round.from);
        expect(prime.round.emitter.to).toMatchObject(entry.round.to);
        expect(prime.round.emitter.cycling).toBe(entry.round.cycling !== false);
        expect(prime.round.emitter.params.speed).toBe(entry.round.params.speed);
        expect(prime.round.emitter.params.delay).toBe(entry.round.params.delay);
        expect(prime.round.emitter.params.gap).toBe(entry.round.params.gap);
        expect(prime.item.emitter.from).toMatchObject(entry.item.from);
        expect(prime.item.emitter.to).toMatchObject(entry.item.to);
        expect(prime.item.emitter.params.speed).toBe(entry.item.params.speed);
        samePoint(prime.circle.emitter.center, prime.center);
        samePoint(prime.round.emitter.center, prime.center);
        samePoint(prime.item.emitter.center, prime.center);
        expect(prime.center.col).not.toBe(entry.center.col);
    });

    it('refuses a second item', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { animate: false });
        const item = prime.item;
        expect(prime.addItem()).toBeNull();
        expect(prime.item).toBe(item);
        expect(prime.parts.filter((part) => part.object && part.object.kind === 'round')).toHaveLength(2);
    });

    it('fades the item in on add, and a cancel restores that slot', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { name: 'Prime' });
        const item = prime.item;
        expect(item.channels.combined().heat).toBeCloseTo(0, 5);
        item.tick(DT);
        expect(item.channels.combined().heat).toBeGreaterThan(0);
        item.cancelAll();
        expect(item.channels.combined().heat).toBeCloseTo(1, 5);
    });

    it('finish matches seek-to-end, and destroy resolves cancelled', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const finished = new ctx.UiPrime(heatMap, { name: 'Done' });
        const sought = new ctx.UiPrime(heatMap, { name: 'Seek' });
        const run = finished.item._runs[finished.item._runs.length - 1];
        const other = sought.item._runs[sought.item._runs.length - 1];
        run.finish();
        other.seek(other.duration);
        expect(finished.item.channels.combined().heat).toBeCloseTo(sought.item.channels.combined().heat, 5);
        const pending = other.finished;
        heatMap.field.destroy();
        await expect(pending).resolves.toEqual({ status: 'cancelled' });
    });

    it('fades the item out and leaves the circle and the round', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { animate: false });
        const circle = prime.circle;
        const round = prime.round;
        const removed = prime.removeItem();
        expect(removed).toBeTruthy();
        expect(prime.removeItem()).toBeNull();
        stepField(heatMap, 50);
        expect(prime.item).toBeNull();
        expect(prime.circle).toBe(circle);
        expect(prime.round).toBe(round);
        const restored = prime.addItem({ animate: false });
        expect(restored.kind).toBe('round');
        expect(restored.emitter.cycling).toBe(true);
        samePoint(restored.emitter.center, prime.center);
        expect(prime.addItem()).toBeNull();
    });

    it('moves every part when the prime is retargeted', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { centerX: 40, centerY: 60, animate: false });
        prime.retarget({ col: 20, row: 30 });
        samePoint(prime.center, { col: 20, row: 30 });
        samePoint(prime.circle.emitter.center, prime.center);
        samePoint(prime.round.emitter.center, prime.center);
        samePoint(prime.item.emitter.center, prime.center);
    });

    it('round-trips the center, the circle, and the item', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { name: 'Prime', animate: false });
        prime.setCenter({ col: 18, row: 44 });
        prime.nudgeParam('circle_fromOuter', 1);
        prime.nudgeParam('item_fromRadius', 1);
        const loaded = new ctx.UiPrime(heatMap, { name: 'Other', animate: false });
        loaded.applySerialized(prime.serialize());
        expect(loaded.name).toBe('Prime');
        samePoint(loaded.center, { col: 18, row: 44 });
        samePoint(loaded.item.emitter.center, loaded.center);
        expect(loaded.circle.emitter.from.outer).toBe(prime.circle.emitter.from.outer);
        expect(loaded.item.emitter.from.radius).toBe(prime.item.emitter.from.radius);
        expect(loaded.item.emitter.cycling).toBe(true);
        expect(loaded.round.emitter.cycling).toBe(true);
    });

    it('edits circle, round, and item props from the prime', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { animate: false });
        const outer = prime.circle.emitter.from.outer;
        const radius = prime.round.emitter.from.radius;
        const itemRadius = prime.item.emitter.from.radius;
        expect(prime.params.circle_fromOuter).toBe(outer);
        expect(prime.params.round_cycling).toBe(true);
        expect(prime.params.item_fromRadius).toBe(itemRadius);
        prime.nudgeParam('circle_fromOuter', 1);
        prime.nudgeParam('round_fromRadius', 1);
        prime.nudgeParam('item_fromRadius', 1);
        expect(prime.circle.emitter.from.outer).toBeGreaterThan(outer);
        expect(prime.round.emitter.from.radius).toBeGreaterThan(radius);
        expect(prime.item.emitter.from.radius).toBeGreaterThan(itemRadius);
        const keys = ctx.UiPrime.PROP_TABS.reduce((all, tab) => all.concat(tab.rows.map((row) => row.key)), []);
        expect(keys).toContain('circle_fromOuter');
        expect(keys).toContain('round_cycling');
        expect(keys).toContain('item_fromRadius');
        const addKeys = ctx.UiPrime.ADD_TABS.reduce((all, tab) => all.concat(tab.rows.map((row) => row.key)), []);
        const removeKeys = ctx.UiPrime.REMOVE_TABS.reduce((all, tab) => all.concat(tab.rows.map((row) => row.key)), []);
        expect(addKeys).toContain('addItem');
        expect(removeKeys).toContain('removeItem');
    });

    it('keeps the item pose after the exit and the next add', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const prime = new ctx.UiPrime(heatMap, { animate: false });
        prime.nudgeParam('item_fromRadius', 1);
        const radius = prime.item.emitter.from.radius;
        const removed = prime.removeItem();
        removed._slots.life.active.finish();
        expect(prime.item).toBeNull();
        expect(prime.circle).toBeTruthy();
        expect(prime.round).toBeTruthy();
        expect(prime.params.item_fromRadius).toBe(radius);
        prime.nudgeParam('item_fromRadius', 1);
        const next = prime.params.item_fromRadius;
        expect(next).toBeGreaterThan(radius);
        const restored = prime.addItem({ animate: false });
        expect(restored.emitter.from.radius).toBe(next);
        expect(restored.emitter.cycling).toBe(true);
        samePoint(restored.emitter.center, prime.center);
    });
});
