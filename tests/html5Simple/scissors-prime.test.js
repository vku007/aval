import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function samePoint(a, b) {
    expect(a.col).toBeCloseTo(b.col, 5);
    expect(a.row).toBeCloseTo(b.row, 5);
}

describe('HotMapUiScissorsPrime', () => {
    it('keeps one scissor shard plus a prime circle and round on the scissor center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const scissorsPrime = new ctx.HotMapUiScissorsPrime(heatMap, {
            name: 'Scissors Prime',
            center: { col: 102, row: 210 },
            animate: false
        });
        const file = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'resources/prime-1.json'), 'utf8'));
        const entry = file.primes[0];
        const shards = scissorsPrime.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'shard');
        expect(scissorsPrime.kind).toBe('hot-map-scissors-prime');
        expect(shards).toHaveLength(1);
        expect(shards[0].emitter.from.width).toBe(44);
        expect(scissorsPrime.circle.kind).toBe('circle');
        expect(scissorsPrime.round.kind).toBe('round');
        expect(scissorsPrime.circle.emitter.from).toMatchObject(entry.circle.from);
        expect(scissorsPrime.circle.emitter.cycling).toBe(entry.circle.cycling !== false);
        expect(scissorsPrime.round.emitter.from).toMatchObject(entry.round.from);
        expect(scissorsPrime.round.emitter.cycling).toBe(entry.round.cycling !== false);
        samePoint(scissorsPrime.circle.emitter.center, scissorsPrime.center);
        samePoint(scissorsPrime.round.emitter.center, scissorsPrime.center);
        samePoint(shards[0].emitter.center, scissorsPrime.center);
        expect(ctx.createComposite('scissorsPrime', heatMap, { animate: false }).kind).toBe('hot-map-scissors-prime');
    });

    it('refuses a second shard and restores the one shard without dropping the shell', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const scissorsPrime = new ctx.HotMapUiScissorsPrime(heatMap, { animate: false });
        const circle = scissorsPrime.circle;
        const round = scissorsPrime.round;
        const shard = scissorsPrime.parts.map((part) => part.object).find((object) => object.kind === 'shard');
        expect(scissorsPrime.addItem()).toBeNull();
        expect(scissorsPrime.shardCount()).toBe(1);
        expect(scissorsPrime.removeItem()).toBe(shard);
        expect(scissorsPrime.shardCount()).toBe(0);
        expect(scissorsPrime.circle).toBe(circle);
        expect(scissorsPrime.round).toBe(round);
        const restored = scissorsPrime.addItem({ animate: false });
        expect(restored.kind).toBe('shard');
        expect(scissorsPrime.addItem()).toBeNull();
        samePoint(restored.emitter.center, scissorsPrime.center);
        samePoint(scissorsPrime.circle.emitter.center, scissorsPrime.center);
    });

    it('moves the shard, the circle, and the round when the scissor is retargeted', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const scissorsPrime = new ctx.HotMapUiScissorsPrime(heatMap, {
            center: { col: 102, row: 210 },
            animate: false
        });
        scissorsPrime.retarget({ col: 40, row: 80 });
        const shard = scissorsPrime.parts.map((part) => part.object).find((object) => object.kind === 'shard');
        samePoint(scissorsPrime.center, { col: 40, row: 80 });
        samePoint(shard.emitter.center, scissorsPrime.center);
        samePoint(scissorsPrime.circle.emitter.center, scissorsPrime.center);
        samePoint(scissorsPrime.round.emitter.center, scissorsPrime.center);
        samePoint(scissorsPrime.round.emitter.target, scissorsPrime.center);
    });

    it('edits the circle and the round from the scissors prime', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const scissorsPrime = new ctx.HotMapUiScissorsPrime(heatMap, { animate: false });
        const outer = scissorsPrime.circle.emitter.from.outer;
        const radius = scissorsPrime.round.emitter.from.radius;
        expect(scissorsPrime.params.circle_fromOuter).toBe(outer);
        expect(scissorsPrime.params.round_cycling).toBe(true);
        scissorsPrime.nudgeParam('circle_fromOuter', 1);
        scissorsPrime.nudgeParam('round_fromRadius', 1);
        expect(scissorsPrime.circle.emitter.from.outer).toBeGreaterThan(outer);
        expect(scissorsPrime.round.emitter.from.radius).toBeGreaterThan(radius);
        const loaded = new ctx.HotMapUiScissorsPrime(heatMap, { animate: false });
        loaded.applySerialized(scissorsPrime.serialize());
        expect(loaded.circle.emitter.from.outer).toBe(scissorsPrime.circle.emitter.from.outer);
        expect(loaded.round.emitter.from.radius).toBe(scissorsPrime.round.emitter.from.radius);
        samePoint(loaded.circle.emitter.center, loaded.center);
        samePoint(loaded.round.emitter.center, loaded.center);
    });
});
