import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

function fixedCircle(ctx, heatMap, extra) {
    const pose = { outer: 30, inner: 16, heat: 0.4 };
    return new ctx.UiCircle(heatMap, Object.assign({
        from: pose,
        to: Object.assign({}, pose),
        glistenOn: false
    }, extra || {}));
}

function stamped(circle) {
    const field = circle.emitter.field;
    field.src.fill(0);
    circle.emitter.stamp(field.src);
    return field.src;
}

describe('UiCircle', () => {
    it('heats the ring between the circles and leaves the hole and the outside cold', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = fixedCircle(ctx, heatMap, {
            from: { outer: 30, inner: 16, heat: 1 },
            to: { outer: 30, inner: 16, heat: 1 }
        });
        const grid = stamped(circle);
        const center = circle.emitter.center;
        const cols = circle.emitter.cols;
        const at = (col, row) => grid[row * cols + col];
        const midCol = Math.round(center.col);
        const midRow = Math.round(center.row);
        expect(at(midCol, midRow)).toBeLessThan(0.05);
        expect(at(midCol + 23, midRow)).toBeGreaterThan(0.5);
        expect(at(midCol, midRow - 23)).toBeGreaterThan(0.5);
        expect(at(midCol + 48, midRow)).toBeLessThan(0.05);
    });

    it('keeps the inner radius from exceeding the outer', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = fixedCircle(ctx, heatMap);
        circle.emitter.setParam('fromOuter', 20);
        circle.emitter.setParam('fromInner', 40);
        expect(circle.emitter.from.inner).toBe(20);
        expect(circle.emitter.from.outer).toBe(20);
        circle.emitter.setParam('fromInner', 12);
        circle.emitter.setParam('fromOuter', 8);
        expect(circle.emitter.from.outer).toBe(8);
        expect(circle.emitter.from.inner).toBe(8);
    });

    it('sweeps the glisten around the ring', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = fixedCircle(ctx, heatMap, {
            from: { outer: 30, inner: 16, heat: 0.2 },
            to: { outer: 30, inner: 16, heat: 0.2 },
            glistenOn: true,
            params: { glistenPower: 1 }
        });
        const center = circle.emitter.center;
        const cols = circle.emitter.cols;
        const midCol = Math.round(center.col);
        const midRow = Math.round(center.row);
        const at = (grid, col) => grid[midRow * cols + col];
        circle.emitter.glisten = 0;
        circle.emitter.glistenPhase = 'run';
        const atStart = stamped(circle);
        expect(at(atStart, midCol + 23)).toBeGreaterThan(at(atStart, midCol - 23));
        circle.emitter.glisten = 50;
        const halfway = stamped(circle);
        expect(at(halfway, midCol - 23)).toBeGreaterThan(at(halfway, midCol + 23));
    });

    it('eases the outer radius from FROM toward TO', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = fixedCircle(ctx, heatMap, {
            from: { outer: 20, inner: 8, heat: 0.4 },
            to: { outer: 48, inner: 20, heat: 0.4 },
            params: { speed: 4, delay: 2, gap: 2 }
        });
        expect(circle.emitter.current.outer).toBe(20);
        heatMap.field.update(0, 1000 / 60);
        expect(circle.emitter.current.outer).toBeGreaterThan(20);
        expect(circle.emitter.current.outer).toBeLessThan(48);
        expect(circle.emitter.current.inner).toBeLessThanOrEqual(circle.emitter.current.outer);
    });

    it('round-trips radii, heat, and the glisten clock', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = new ctx.UiCircle(heatMap, { name: 'Circle' });
        circle.emitter.setParam('fromOuter', 28);
        circle.emitter.setParam('fromInner', 12);
        circle.emitter.setParam('toOuter', 60);
        circle.emitter.setParam('toHeat', 0.9);
        circle.emitter.setParam('glistenSpeed', 1.4);
        circle.emitter.glisten = 40;
        const data = circle.serialize();
        const loaded = new ctx.UiCircle(heatMap, { name: 'Other' });
        loaded.applySerialized(data);
        expect(loaded.name).toBe('Circle');
        expect(loaded.params.fromOuter).toBe(28);
        expect(loaded.params.fromInner).toBe(12);
        expect(loaded.params.toOuter).toBe(60);
        expect(loaded.params.toHeat).toBe(0.9);
        expect(loaded.params.glistenSpeed).toBe(1.4);
        expect(loaded.emitter.current.outer).toBe(28);
        expect(loaded.emitter.glisten).toBe(40);
        expect(ctx.createItem('circle', heatMap).kind).toBe('circle');
    });

    it('scales both radii together', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const circle = fixedCircle(ctx, heatMap, {
            from: { outer: 20, inner: 10, heat: 1 },
            to: { outer: 20, inner: 10, heat: 1 }
        });
        circle.channels.set('grow', { scale: 2 });
        const grid = stamped(circle);
        const center = circle.emitter.center;
        const cols = circle.emitter.cols;
        const midCol = Math.round(center.col);
        const midRow = Math.round(center.row);
        const at = (col) => grid[midRow * cols + col];
        expect(at(midCol + 12)).toBeLessThan(0.05);
        expect(at(midCol + 30)).toBeGreaterThan(0.5);
    });
});
