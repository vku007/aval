import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

const DT = 1000 / 60;

function parkedScissor(ctx) {
    const heatMap = createHeatMap(ctx);
    const group = new ctx.HotMapUiScissor(heatMap);
    const shard = group.addItem({ animate: false });
    return { heatMap, group, shard };
}

describe('scissor drama remove', () => {
    it('projects a card tumble: pitch flattens height, yaw flattens width', () => {
        const ctx = loadHeat();
        const flat = { width: 40, height: 20, angle: 0, skew: 0, heat: 1 };
        const pitched = ctx.projectBackHighlightTilt(Object.assign({}, flat), 90, 0);
        expect(pitched.width).toBeCloseTo(40, 4);
        expect(pitched.height).toBeCloseTo(1, 4);

        const yawed = ctx.projectBackHighlightTilt(Object.assign({}, flat), 0, 90);
        expect(yawed.width).toBeCloseTo(1, 4);
        expect(yawed.height).toBeCloseTo(20, 4);

        const turned = ctx.projectBackHighlightTilt(Object.assign({}, flat), 0, 0);
        expect(turned.width).toBeCloseTo(40, 4);
        expect(turned.height).toBeCloseTo(20, 4);
        expect(turned.angle).toBeCloseTo(0, 4);
    });

    it('does not stretch an edge-on skewed shard past its width', () => {
        const ctx = loadHeat();
        const pose = { width: 56, height: 8, angle: 0, skew: -60, heat: 1.8, shapeHeat: 0.2 };
        const cols = 180;
        const rows = 40;
        const center = { col: 90, row: 20 };
        const grid = new Float32Array(cols * rows);
        [88, 89, 90, 91].forEach((tilt) => {
            const shown = ctx.projectBackHighlightTilt(Object.assign({}, pose), tilt, 0);
            grid.fill(0);
            ctx.stampBackHighlightRect(grid, cols, rows, center, shown);
            let minX = cols;
            let maxX = -1;
            for (let i = 0; i < grid.length; i += 1) {
                if (grid[i] <= 0.05) {
                    continue;
                }
                const x = i % cols;
                if (x < minX) {
                    minX = x;
                }
                if (x > maxX) {
                    maxX = x;
                }
            }
            expect(maxX - minX).toBeLessThanOrEqual(pose.width + 4);
        });
    });

    it('holds triple heat, then falls faster under gravity while tumbling', () => {
        const ctx = loadHeat();
        const { group, shard } = parkedScissor(ctx);
        group.dramaTime = 0.9;
        group.dramaFade = 0.45;
        group.dramaSpinX = 100;
        group.dramaSpinY = 0;
        group.dramaSpinZ = 40;
        const width = shard.emitter.current.width;
        const removed = group.removeItemWithDrama();
        const run = shard._slots.life.active;

        expect(removed).toBe(shard);
        expect(shard.attached).toBe(true);
        expect(shard.emitter.current.width).toBeCloseTo(width, 6);
        const shown = shard.channels.combined();
        expect(shown.heat).toBeCloseTo(3, 8);
        expect(shown.offset).toEqual({ col: 0, row: 0 });
        expect(shown.rotate).toBeCloseTo(0, 8);
        expect(shown.tiltX).toBeCloseTo(0, 8);
        expect(shown.tiltY).toBeCloseTo(0, 8);

        const time = group.dramaTime;
        const drop = 0.5 * group.dramaGravity * time * time;
        expect(run.ctx.drop).toBeCloseTo(drop, 8);
        expect(run.ctx.heat).toBe(3);
        expect(run.ctx.hold).toBeCloseTo(time - group.dramaFade, 8);
        expect(run.ctx.spinX).toBeCloseTo(group.dramaSpinX * time, 8);
        expect(run.ctx.spinY).toBeCloseTo(group.dramaSpinY * time, 8);
        expect(run.ctx.spinZ).toBeCloseTo(group.dramaSpinZ * time, 8);

        const hold = run.ctx.hold;
        run.seek(hold);
        const crest = shard.channels.combined();
        expect(crest.heat).toBeCloseTo(3, 5);
        expect(crest.offset.row).toBeCloseTo(drop * 0.25, 4);
        expect(crest.offset.col).toBeCloseTo(0, 5);

        run.seek(hold + run.ctx.fade * 0.5);
        expect(shard.channels.combined().heat).toBeCloseTo(1.5, 4);

        const early = ctx.heatSample(run.block, time * 0.5).values.offset.row;
        const landed = ctx.heatSample(run.block, time).values.offset.row;
        expect(landed - early).toBeGreaterThan(early);
        expect(landed).toBeCloseTo(drop, 4);

        const end = time - 1e-3;
        run.seek(end);
        const falling = shard.channels.combined();
        expect(falling.heat).toBeLessThan(0.05);
        expect(falling.rotate).toBeCloseTo(run.ctx.spinZ * (end / time), 4);
        expect(falling.tiltX).toBeCloseTo(run.ctx.spinX * (end / time), 4);
        expect(falling.tiltY).toBeCloseTo(run.ctx.spinY * (end / time), 4);
        const posed = ctx.heatPresentPose(
            ctx.heatFrame(shard),
            shard.emitter.current,
            shard.emitter.from,
            shard.emitter.to
        );
        expect(posed.height).toBeLessThan(2);
        expect(posed.width).toBeGreaterThan(20);
        expect(shard.emitter.current.width).toBeCloseTo(width, 5);

        run.finish();
        expect(run.status).toBe('finished');
        expect(shard.attached).toBe(false);
        expect(group.items).not.toContain(shard);
    });

    it('matches seek with stepping, and cancel restores the shard', () => {
        const ctx = loadHeat();
        const stepped = parkedScissor(ctx);
        stepped.group.removeItemWithDrama();
        const frames = 18;
        for (let frame = 0; frame < frames; frame += 1) {
            stepped.heatMap.field.update(frame * DT, DT);
        }
        const sought = parkedScissor(ctx);
        sought.group.removeItemWithDrama();
        const run = sought.shard._slots.life.active;
        run.seek(frames * DT / 1000);
        const a = stepped.shard.channels.combined();
        const b = sought.shard.channels.combined();
        expect(b.offset.row).toBeCloseTo(a.offset.row, 5);
        expect(b.heat).toBeCloseTo(a.heat, 5);
        expect(b.rotate).toBeCloseTo(a.rotate, 5);
        expect(b.tiltX).toBeCloseTo(a.tiltX, 5);
        expect(b.tiltY).toBeCloseTo(a.tiltY, 5);

        const cancelled = parkedScissor(ctx);
        cancelled.group.removeItemWithDrama();
        const hit = cancelled.shard._slots.life.active;
        hit.cancel();
        const restored = cancelled.shard.channels.combined();
        expect(restored.heat).toBe(1);
        expect(restored.offset).toEqual({ col: 0, row: 0 });
        expect(restored.rotate).toBe(0);
        expect(restored.tiltX).toBe(0);
        expect(restored.tiltY).toBe(0);
        expect(cancelled.shard.attached).toBe(true);
        expect(cancelled.group.items).toContain(cancelled.shard);
    });

    it('destroy resolves the fall as cancelled', async () => {
        const ctx = loadHeat();
        const { heatMap, shard, group } = parkedScissor(ctx);
        group.removeItemWithDrama();
        const run = shard._slots.life.active;
        const pending = run.finished;
        heatMap.field.update(0, DT);
        heatMap.field.destroy();
        expect(run.status).toBe('cancelled');
        expect(shard.attached).toBe(false);
        await expect(pending).resolves.toEqual({ status: 'cancelled' });
    });

    it('does not flash the rest pose at the origin when the fall ends', () => {
        const ctx = loadHeat();
        const { heatMap, group, shard } = parkedScissor(ctx);
        group.dramaGravity = 400;
        group.dramaTime = 0.5;
        group.dramaFade = 0.5;
        group.dramaSpinX = 0;
        group.dramaSpinY = 0;
        group.dramaSpinZ = 0;
        group.removeItemWithDrama();
        const field = heatMap.field;
        const center = shard.emitter.center;
        let frame = 0;
        while (shard.attached && frame < 90) {
            field.src.fill(0);
            field.dst.fill(0);
            field.update(frame * DT, DT);
            frame += 1;
        }
        expect(shard.attached).toBe(false);
        const col = Math.round(center.col);
        const row = Math.round(center.row);
        let peak = 0;
        for (let y = row - 8; y <= row + 8; y += 1) {
            for (let x = col - 8; x <= col + 8; x += 1) {
                const heat = field.src[y * field.cols + x] || 0;
                if (heat > peak) {
                    peak = heat;
                }
            }
        }
        expect(peak).toBeLessThan(0.05);
    });

    it('pops every shard 0.66 s apart, or only the requested count', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiScissor(heatMap);
        const first = group.addItem({ animate: false });
        const second = group.addItem({ animate: false });
        const run = group.removeWithDrama();
        expect(run.removed).toBe(2);
        expect(second._scissorLeaving).toBe(true);
        expect(first._scissorLeaving).toBeFalsy();
        for (let frame = 0; frame < 39; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        expect(first._scissorLeaving).toBeFalsy();
        heatMap.field.update(39 * DT, DT);
        expect(first._scissorLeaving).toBe(true);

        const partialMap = createHeatMap(ctx);
        const partial = new ctx.HotMapUiScissor(partialMap);
        const kept = partial.addItem({ animate: false });
        const dropped = partial.addItem({ animate: false });
        expect(partial.removeWithDrama(1).removed).toBe(1);
        expect(dropped._scissorLeaving).toBe(true);
        expect(kept._scissorLeaving).toBeFalsy();

        const pending = run.finished;
        for (let frame = 40; frame < 180; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        await expect(pending).resolves.toEqual({ status: 'finished' });
        expect(first.attached).toBe(false);
        expect(second.attached).toBe(false);
    });

    it('pops the previous shard while one is falling, and ignores a second pop of the same shard', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiScissor(heatMap);
        const first = group.addItem({ animate: false });
        const second = group.addItem({ animate: false });
        expect(group.removeItemWithDrama()).toBe(second);
        expect(second._scissorLeaving).toBe(true);
        expect(group.removeItemWithDrama()).toBe(first);
        expect(group.removeItemWithDrama()).toBe(null);
        expect(group.params.dramaHeat).toBe(3);
        expect(group.nudgeParam('dramaHeat', 1)).toBeCloseTo(3.1, 8);
        const keys = group.constructor.REMOVE_TABS[0].rows.map((row) => row.key);
        expect(keys).toEqual([
            'dramaHeat', 'dramaGravity', 'dramaTime',
            'dramaSpinX', 'dramaSpinY', 'dramaSpinZ', 'dramaFade',
            'removeItemWithDrama', 'removeItem'
        ]);
    });
});
