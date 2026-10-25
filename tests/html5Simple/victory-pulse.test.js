import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

function rodParams() {
    return {
        thickness: 10,
        energy: 1.5,
        angle: 0,
        noiseAmt: 0
    };
}

function stampClip(ctx, clip) {
    const cols = 80;
    const rows = 40;
    const grid = new Float32Array(cols * rows);
    ctx.stampHotRodLine(
        grid,
        cols,
        rows,
        { col: 40, row: 20 },
        rodParams(),
        0,
        clip
    );
    return { grid, cols, rows };
}

function heatAt(grid, cols, x, y) {
    return grid[y * cols + x];
}

describe('victory pulse edge', () => {
    it('feathers the clipped end so a half-cell shift changes the rim', () => {
        const ctx = loadHeat();
        const hardA = stampClip(ctx, { colMin: 20, colMax: 50.2 });
        const hardB = stampClip(ctx, { colMin: 20, colMax: 50.7 });
        expect(heatAt(hardA.grid, hardA.cols, 50, 20)).toBeGreaterThan(0.9);
        expect(heatAt(hardA.grid, hardA.cols, 52, 20)).toBe(0);
        expect(heatAt(hardB.grid, hardB.cols, 50, 20)).toBe(heatAt(hardA.grid, hardA.cols, 50, 20));

        const softA = stampClip(ctx, { colMin: 20, colMax: 50.2, feather: 4 });
        const softB = stampClip(ctx, { colMin: 20, colMax: 50.7, feather: 4 });
        const tail = [];
        for (let x = 50; x <= 60; x += 1) {
            tail.push(heatAt(softA.grid, softA.cols, x, 20));
        }
        const mid = tail.filter((heat) => heat > 0.02 && heat < 0.95);
        expect(mid.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < tail.length; i += 1) {
            expect(tail[i]).toBeLessThanOrEqual(tail[i - 1] + 1e-6);
        }
        expect(heatAt(softB.grid, softB.cols, 52, 20)).toBeGreaterThan(heatAt(softA.grid, softA.cols, 52, 20));
    });

    it('leans each end along the line between its corners', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pulse = new ctx.VictoryPulse(heatMap, {
            start: { x: 195, y: 700 },
            end: { x: 40, y: 30 },
            startWidth: 360,
            endWidth: 24
        });
        expect(pulse.leftAngle).toBeGreaterThan(-8);
        expect(pulse.leftAngle).toBeLessThan(8);
        expect(pulse.rightAngle).toBeLessThan(-15);

        const emitter = pulse.rod.emitter;
        const grid = new Float32Array(emitter.cols * emitter.rows);
        emitter.stamp(grid);
        const row = Math.round(emitter.center.row);
        const cols = emitter.cols;
        const reach = (y) => {
            let last = -1;
            for (let x = 0; x < cols; x += 1) {
                if (grid[y * cols + x] > 0.5) {
                    last = x;
                }
            }
            return last;
        };
        expect(reach(row + 6)).toBeGreaterThan(reach(row));
        expect(reach(row)).toBeGreaterThan(reach(row - 6));
        pulse.remove();
    });

    it('softens the long edge of a victory strike across several rows', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const pulse = new ctx.VictoryPulse(heatMap, {
            start: { x: 195, y: 420 },
            end: { x: 195, y: 420 },
            startWidth: 180,
            endWidth: 72
        });
        const emitter = pulse.rod.emitter;
        const grid = new Float32Array(emitter.cols * emitter.rows);
        emitter.stamp(grid);
        const col = Math.round(emitter.center.col);
        const row = Math.round(emitter.center.row);
        const above = [];
        for (let y = row; y < Math.min(emitter.rows, row + 16); y += 1) {
            above.push(grid[y * emitter.cols + col]);
        }
        const rim = above.filter((heat) => heat > 0.02 && heat < 0.95);
        expect(rim.length).toBeGreaterThanOrEqual(3);
        expect(above[0]).toBeGreaterThan(0.9);
        pulse.remove();
    });
});
