import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, SITE_ROOT } from './harness.js';

function samePoint(a, b) {
    expect(a.col).toBeCloseTo(b.col, 5);
    expect(a.row).toBeCloseTo(b.row, 5);
}

describe('HotMapUiStonePrime', () => {
    it('keeps one stone ball plus a prime circle and round on the stone center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const stonePrime = new ctx.HotMapUiStonePrime(heatMap, {
            name: 'Stone Prime',
            center: { col: 28, row: 48 },
            animate: false
        });
        const file = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'resources/prime-1.json'), 'utf8'));
        const entry = file.primes[0];
        const balls = stonePrime.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'hot-ball');
        expect(stonePrime.kind).toBe('hot-map-stone-prime');
        expect(balls).toHaveLength(1);
        expect(stonePrime.circle.kind).toBe('circle');
        expect(stonePrime.round.kind).toBe('round');
        expect(stonePrime.circle.emitter.from).toMatchObject(entry.circle.from);
        expect(stonePrime.circle.emitter.cycling).toBe(entry.circle.cycling !== false);
        expect(stonePrime.round.emitter.from).toMatchObject(entry.round.from);
        expect(stonePrime.round.emitter.cycling).toBe(entry.round.cycling !== false);
        samePoint(stonePrime.circle.emitter.center, stonePrime.center);
        samePoint(stonePrime.round.emitter.center, stonePrime.center);
        samePoint(balls[0].motion.orbitCenter, stonePrime.center);
        expect(ctx.createComposite('stonePrime', heatMap, { animate: false }).kind).toBe('hot-map-stone-prime');
    });

    it('refuses a second ball and restores the one ball without dropping the shell', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const stonePrime = new ctx.HotMapUiStonePrime(heatMap, { animate: false });
        const circle = stonePrime.circle;
        const round = stonePrime.round;
        const ball = stonePrime.parts.map((part) => part.object).find((object) => object.kind === 'hot-ball');
        expect(stonePrime.addItem()).toBeNull();
        expect(stonePrime.ballCount()).toBe(1);
        expect(stonePrime.removeItem()).toBe(ball);
        expect(stonePrime.ballCount()).toBe(0);
        expect(stonePrime.circle).toBe(circle);
        expect(stonePrime.round).toBe(round);
        const restored = stonePrime.addItem({ animate: false });
        expect(restored.kind).toBe('hot-ball');
        expect(stonePrime.addItem()).toBeNull();
        samePoint(restored.motion.orbitCenter, stonePrime.center);
        samePoint(stonePrime.circle.emitter.center, stonePrime.center);
    });

    it('moves the ball, the circle, and the round when the stone is retargeted', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const stonePrime = new ctx.HotMapUiStonePrime(heatMap, {
            center: { col: 28, row: 48 },
            animate: false
        });
        stonePrime.retarget({ col: 70, row: 90 });
        const ball = stonePrime.parts.map((part) => part.object).find((object) => object.kind === 'hot-ball');
        samePoint(stonePrime.center, { col: 70, row: 90 });
        samePoint(ball.motion.orbitCenter, stonePrime.center);
        samePoint(stonePrime.circle.emitter.center, stonePrime.center);
        samePoint(stonePrime.round.emitter.center, stonePrime.center);
        samePoint(stonePrime.round.emitter.target, stonePrime.center);
    });

    it('edits the circle and the round from the stone prime', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const stonePrime = new ctx.HotMapUiStonePrime(heatMap, { animate: false });
        const outer = stonePrime.circle.emitter.from.outer;
        const radius = stonePrime.round.emitter.from.radius;
        expect(stonePrime.params.circle_fromOuter).toBe(outer);
        expect(stonePrime.params.round_cycling).toBe(true);
        stonePrime.nudgeParam('circle_fromOuter', 1);
        stonePrime.nudgeParam('round_fromRadius', 1);
        expect(stonePrime.circle.emitter.from.outer).toBeGreaterThan(outer);
        expect(stonePrime.round.emitter.from.radius).toBeGreaterThan(radius);
        const loaded = new ctx.HotMapUiStonePrime(heatMap, { animate: false });
        loaded.applySerialized(stonePrime.serialize());
        expect(loaded.circle.emitter.from.outer).toBe(stonePrime.circle.emitter.from.outer);
        expect(loaded.round.emitter.from.radius).toBe(stonePrime.round.emitter.from.radius);
        samePoint(loaded.circle.emitter.center, loaded.center);
        samePoint(loaded.round.emitter.center, loaded.center);
    });
});
