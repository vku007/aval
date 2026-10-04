import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

function span(a, b) {
    return Math.hypot(a.col - b.col, a.row - b.row);
}

describe('new paper enter', () => {
    it('hides the disk until the balls ease in on a wider arc', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const disk = new ctx.UiNewSheet(heatMap, {
            ballCount: 2,
            ballRadius: 40,
            ballSpeed: 0,
            speed: 0,
            tiltX: 0,
            tiltY: 0,
            tiltZ: 0
        });
        disk.heat = 0.4;
        disk.radius = 18;
        disk.ballOffsets = [0, Math.PI];
        disk.beginBallTravel({ col: 0, row: 80 });
        const spawn = disk.ballAt(0);
        expect(disk.ballAt(1).col).toBeCloseTo(spawn.col, 5);
        expect(disk.ballAt(1).row).toBeCloseTo(spawn.row, 5);
        expect(disk.diskTraveling()).toBe(true);

        disk.ballTravel.u = 0.25;
        const early = disk.ballAt(0);
        disk.ballTravel.u = 1;
        const landed = disk.ballAt(0);
        disk.ballTravel.u = 0.75;
        const late = disk.ballAt(0);
        expect(span(spawn, early)).toBeGreaterThan(span(late, landed));

        const dest = disk.ballPlace(0);
        const center = disk.diskCenter(disk.depth);
        const t = ctx.heatEase('expOut', 0.35);
        disk.ballTravel.u = 0.35;
        const bowed = disk.ballAt(0);
        const straight = {
            col: spawn.col + (dest.col - spawn.col) * t,
            row: spawn.row + (dest.row - spawn.row) * t
        };
        expect(span(bowed, center)).toBeGreaterThan(span(straight, center) + 1);

        const cols = heatMap.field.cols;
        const rows = heatMap.field.rows;
        const grid = new Float32Array(cols * rows);
        const cx = Math.round(center.col);
        const cy = Math.round(center.row);
        disk.stamp(grid);
        expect(grid[cy * cols + cx]).toBe(0);

        disk.ballTravel.u = 0.99;
        disk.step(1000);
        expect(disk.diskTraveling()).toBe(false);
        grid.fill(0);
        disk.heat = 0.4;
        disk.stamp(grid);
        expect(grid[cy * cols + cx]).toBeGreaterThan(0);
    });

    it('eases the fly-in when a spinning slot switches the arc side', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const disk = new ctx.UiNewSheet(heatMap, {
            ballCount: 1,
            ballRadius: 32,
            ballSpeed: 0,
            speed: 0,
            tiltX: 75,
            tiltY: 0,
            tiltZ: 0
        });
        disk.rebuildBallOffsets();
        disk.beginBallTravel({ col: 0, row: 128 });
        disk.ballTravel.u = 0.35;
        let prev = null;
        let maxStep = 0;
        for (let deg = 0; deg <= 360; deg += 1) {
            disk.ballSpin = deg;
            const point = disk.ballAt(0);
            if (prev) {
                maxStep = Math.max(maxStep, span(prev, point));
            }
            prev = point;
        }
        expect(maxStep).toBeLessThan(2);
    });
});

describe('new paper drama', () => {
    it('keeps the disk steps and arcs both balls into the bucket', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const disk = new ctx.UiNewSheet(heatMap, {
            ballCount: 2,
            ballRadius: 40,
            ballSpeed: 0,
            speed: 0,
            tiltX: 0,
            tiltY: 0,
            tiltZ: 0,
            heatFrom: 0.08,
            heatTo: 0.02
        });
        disk.radius = 20;
        disk.heat = 0.1;
        disk.ballOffsets = [0, Math.PI];
        disk.beginRemoveDrama({
            jump: 18,
            drop: 28,
            speeds: [400, 900, 160],
            heatScale: 3,
            radiusScale: 3
        });

        expect(disk.dramaBallFade()).toBe(3);
        const bucket = disk.drama.ballTo;
        const start = [0, 1].map((index) => disk.ballAt(index));
        expect(Math.abs(start[0].col - start[1].col)).toBeGreaterThan(1);
        start.forEach((ball, index) => {
            expect(ball.row).toBeCloseTo(disk.drama.ballFrom[index].row, 6);
            expect(ball.col).toBeCloseTo(disk.drama.ballFrom[index].col, 6);
        });

        const rawHeat = 100 / 400;
        const rawBurst = 100 / 900;
        expect(disk.drama.peakTime).toBeCloseTo(rawHeat + rawBurst, 8);

        disk.advanceDrama(rawHeat * 0.67);
        expect(disk.drama.step).toBe(2);
        expect(disk.radius).toBeCloseTo(20, 5);
        expect(disk.heat).toBeCloseTo(disk.drama.heat1, 5);
        const rising = [0, 1].map((index) => disk.ballAt(index));
        rising.forEach((ball, index) => {
            expect(ball.row).toBeLessThan(start[index].row);
            expect(Math.abs(ball.col - bucket.col)).toBeLessThan(Math.abs(start[index].col - bucket.col));
        });

        disk.advanceDrama(rawBurst * 0.75);
        expect(disk.drama.step).toBe(3);
        expect(disk.heat).toBeCloseTo(0, 5);
        expect(disk.radius).toBeCloseTo(60, 5);
        expect(disk.drama.elapsed).toBeLessThan(disk.drama.peakTime);
        [0, 1].forEach((index) => {
            expect(disk.ballAt(index).row).toBeGreaterThan(start[index].row - 18);
        });

        disk.advanceDrama(disk.drama.peakTime - disk.drama.elapsed);
        expect(disk.drama.step).toBe(3);
        expect(disk.drama.diskDone).toBe(false);
        expect(disk.heat).toBeCloseTo(0, 6);
        expect(disk.radius).toBeCloseTo(60, 6);
        expect(disk.dramaBallFade()).toBe(3);
        const crest = [0, 1].map((index) => disk.ballAt(index));
        crest.forEach((ball, index) => {
            expect(ball.row).toBeCloseTo(start[index].row - 18, 4);
            expect(Math.abs(ball.col - bucket.col)).toBeLessThan(Math.abs(rising[index].col - bucket.col));
        });

        const fall = disk.drama.totalTime - disk.drama.peakTime;
        disk.advanceDrama(fall * 0.5);
        const mid = [0, 1].map((index) => disk.ballAt(index));
        mid.forEach((ball, index) => {
            expect(ball.row).toBeGreaterThan(crest[index].row);
        });
        disk.advanceDrama(fall * 0.5);
        expect(disk.drama.done).toBe(true);
        expect(disk.dramaBallFade()).toBe(0);
        const landed = [0, 1].map((index) => disk.ballAt(index));
        landed.forEach((ball) => {
            expect(ball.col).toBeCloseTo(bucket.col, 4);
            expect(ball.row).toBeCloseTo(bucket.row, 4);
        });
        expect(bucket.row).toBeCloseTo(disk.pivotRow + 28, 6);
        [0, 1].forEach((index) => {
            expect(span(crest[index], mid[index])).toBeLessThan(span(mid[index], landed[index]));
        });
    });

    it('does not stamp the idle disk on the tick after drama ends', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const paper = new ctx.HotMapUiNewPaper(heatMap);
        const disk = paper.addItem({ animate: false });
        paper.removeItemWithDrama();
        const dt = 1000 / 60;
        let finishedAt = -1;
        for (let frame = 0; frame < 180; frame += 1) {
            heatMap.field.update(frame * dt, dt);
            if (disk.drama && disk.drama.done) {
                finishedAt = frame;
                break;
            }
        }
        expect(finishedAt).toBeGreaterThan(0);
        expect(disk.isVisible).toBe(false);
        const stamped = [];
        const orig = disk.stamp;
        disk.stamp = function stamp(grid) {
            stamped.push({ heat: this.heat, drama: this.drama });
            return orig.call(this, grid);
        };
        heatMap.field.update((finishedAt + 1) * dt, dt);
        expect(stamped).toEqual([]);
    });
});
