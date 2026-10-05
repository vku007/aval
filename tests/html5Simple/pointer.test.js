import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

function fixedPointer(ctx, heatMap, extra) {
    const pose = { width: 70, height: 100, angle: 0, skew: 0, heat: 1.5, shapeHeat: 0 };
    return new ctx.UiPointer(heatMap, Object.assign({
        from: pose,
        to: Object.assign({}, pose),
        apexOn: false,
        leftOn: false,
        rightOn: false
    }, extra || {}));
}

function hottest(grid, cols) {
    let best = -1;
    let index = 0;
    for (let i = 0; i < grid.length; i += 1) {
        if (grid[i] > best) {
            best = grid[i];
            index = i;
        }
    }
    return {
        heat: best,
        col: index % cols,
        row: Math.floor(index / cols)
    };
}

function stamped(pointer) {
    const field = pointer.emitter.field;
    field.src.fill(0);
    pointer.emitter.stamp(field.src);
    return field.src;
}

describe('UiPointer', () => {
    it('fills the triangle and leaves the top corners cold', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pointer = fixedPointer(ctx, heatMap, {
            from: { width: 70, height: 100, angle: 0, skew: 0, heat: 0, shapeHeat: 1 },
            to: { width: 70, height: 100, angle: 0, skew: 0, heat: 0, shapeHeat: 1 }
        });
        const grid = stamped(pointer);
        const center = pointer.emitter.center;
        const cols = pointer.emitter.cols;
        const at = (col, row) => grid[row * cols + col];
        const midCol = Math.round(center.col);
        const midRow = Math.round(center.row);
        const top = Math.round(center.row - pointer.emitter.current.height * 2 / 3);
        const left = Math.round(center.col - pointer.emitter.current.width * 0.5);
        const right = Math.round(center.col + pointer.emitter.current.width * 0.5);
        expect(at(midCol, midRow)).toBeGreaterThan(0.5);
        expect(at(left, top)).toBeLessThan(0.05);
        expect(at(right, top)).toBeLessThan(0.05);
    });

    it('runs each glisten from its side toward the opposite corner', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pointer = fixedPointer(ctx, heatMap);
        const center = pointer.emitter.center;
        const cols = pointer.emitter.cols;
        const cases = [
            { id: 'apex', start: 'row', end: 'row', sign: -1 },
            { id: 'left', start: 'col', end: 'col', sign: -1 },
            { id: 'right', start: 'col', end: 'col', sign: 1 }
        ];
        cases.forEach((spec) => {
            pointer.emitter.glistens.forEach((state) => {
                state.on = state.id === spec.id;
                state.glistenPhase = 'run';
            });
            pointer.emitter.glistenById(spec.id).glisten = 0;
            const atSide = hottest(stamped(pointer), cols);
            pointer.emitter.glistenById(spec.id).glisten = 96;
            const atCorner = hottest(stamped(pointer), cols);
            expect(atSide.heat).toBeGreaterThan(0.4);
            expect(atCorner.heat).toBeGreaterThan(0.4);
            const sideDelta = atSide[spec.start] - center[spec.start];
            const cornerDelta = atCorner[spec.end] - center[spec.end];
            expect(cornerDelta * spec.sign).toBeGreaterThan(sideDelta * spec.sign);
        });
    });

    it('leaves a glisten in place while its flag is off', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pointer = fixedPointer(ctx, heatMap, { apexOn: true, leftOn: false });
        const apex = pointer.emitter.glistenById('apex');
        const left = pointer.emitter.glistenById('left');
        apex.glisten = 12;
        left.glisten = 12;
        for (let frame = 0; frame < 30; frame += 1) {
            heatMap.field.update(frame, 1000 / 60);
        }
        expect(apex.glisten).toBeGreaterThan(20);
        expect(left.glisten).toBe(12);
        expect(pointer.nudgeParam('apexOn', 1)).toBe(false);
        expect(pointer.params.apexOn).toBe(false);
        expect(pointer.params.leftOn).toBe(false);
        expect(pointer.params.rightOn).toBe(false);
    });

    it('round-trips flags, pose, and glisten phase', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pointer = new ctx.UiPointer(heatMap, { name: 'Pointer' });
        pointer.emitter.setParam('apexOn', false);
        pointer.emitter.setParam('fromWidth', 48);
        pointer.emitter.setParam('toHeight', 140);
        pointer.emitter.setParam('glistenSpeed', 1.4);
        pointer.emitter.glistenById('left').glisten = 41;
        const data = pointer.serialize();
        const loaded = new ctx.UiPointer(heatMap, { name: 'Other' });
        loaded.applySerialized(data);
        expect(loaded.name).toBe('Pointer');
        expect(loaded.params.apexOn).toBe(false);
        expect(loaded.params.leftOn).toBe(true);
        expect(loaded.params.rightOn).toBe(true);
        expect(loaded.params.fromWidth).toBe(48);
        expect(loaded.params.toHeight).toBe(140);
        expect(loaded.params.glistenSpeed).toBe(1.4);
        expect(loaded.emitter.glistenById('left').glisten).toBe(41);
        expect(data.glistens.map((entry) => entry.id)).toEqual(['apex', 'left', 'right']);
        expect(ctx.createItem('pointer', heatMap).kind).toBe('pointer');
    });
});
