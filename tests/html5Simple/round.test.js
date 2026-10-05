import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

function fixedRound(ctx, heatMap, extra) {
    const pose = { radius: 24, heat: 1 };
    return new ctx.UiRound(heatMap, Object.assign({
        from: pose,
        to: Object.assign({}, pose)
    }, extra || {}));
}

function stamped(round) {
    const field = round.emitter.field;
    field.src.fill(0);
    round.emitter.stamp(field.src);
    return field.src;
}

describe('UiRound', () => {
    it('fills a disk of the given radius and leaves the corners cold', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const round = fixedRound(ctx, heatMap, {
            from: { radius: 20, heat: 1 },
            to: { radius: 20, heat: 1 }
        });
        const grid = stamped(round);
        const center = round.emitter.center;
        const cols = round.emitter.cols;
        const at = (col, row) => grid[row * cols + col];
        const midCol = Math.round(center.col);
        const midRow = Math.round(center.row);
        expect(at(midCol, midRow)).toBeGreaterThan(0.5);
        expect(at(midCol + 12, midRow)).toBeGreaterThan(0.5);
        expect(at(midCol + 30, midRow)).toBeLessThan(0.05);
        expect(at(midCol, midRow - 30)).toBeLessThan(0.05);
    });

    it('eases radius from FROM toward TO', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const round = fixedRound(ctx, heatMap, {
            from: { radius: 16, heat: 1 },
            to: { radius: 40, heat: 1 },
            params: { speed: 4, delay: 2, gap: 2 }
        });
        expect(round.emitter.current.radius).toBe(16);
        heatMap.field.update(0, 1000 / 60);
        expect(round.emitter.current.radius).toBeGreaterThan(16);
        expect(round.emitter.current.radius).toBeLessThan(40);
    });

    it('round-trips radius, heat, and center', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const round = new ctx.UiRound(heatMap, { name: 'Round' });
        round.emitter.setParam('fromRadius', 22);
        round.emitter.setParam('toRadius', 64);
        round.emitter.setParam('toHeat', 2.2);
        round.emitter.setParam('speed', 2);
        const data = round.serialize();
        const loaded = new ctx.UiRound(heatMap, { name: 'Other' });
        loaded.applySerialized(data);
        expect(loaded.name).toBe('Round');
        expect(loaded.params.fromRadius).toBe(22);
        expect(loaded.params.toRadius).toBe(64);
        expect(loaded.params.toHeat).toBe(2.2);
        expect(loaded.params.speed).toBe(2);
        expect(loaded.emitter.current.radius).toBe(22);
        expect(ctx.createItem('round', heatMap).kind).toBe('round');
    });

    it('stays on the dim pose until hover', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const round = fixedRound(ctx, heatMap, {
            cycling: false,
            from: { radius: 16, heat: 0.2 },
            to: { radius: 28, heat: 1 },
            params: { speed: 8, delay: 0.5, gap: 0.4 }
        });
        round.armHover();
        heatMap.field.update(0, 1000 / 60);
        expect(round.emitter.current.radius).toBeCloseTo(16, 0);
        expect(round.emitter.current.heat).toBeCloseTo(0.2, 1);
        round.setHovered(true);
        for (let frame = 0; frame < 20; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        expect(round.emitter.current.radius).toBeGreaterThan(20);
        expect(round.emitter.current.heat).toBeGreaterThan(0.5);
    });
});
