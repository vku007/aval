import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

const DT = 1000 / 60;

function addScissor(ctx) {
    const heatMap = createHeatMap(ctx);
    const group = new ctx.HotMapUiScissor(heatMap);
    const shard = group.addItem();
    return { heatMap, group, shard, run: shard._slots.life.active };
}

function track(run, channel) {
    return run.block.children.find((child) => child.channels && child.channels[channel]).channels[channel];
}

describe('scissor enter', () => {
    it('starts on the spawn offset, nearly unscaled, spun by 360 plus turn', () => {
        const ctx = loadHeat();
        const { group, shard, run } = addScissor(ctx);
        const shown = shard.channels.combined();
        expect(run.slotName).toBe('life');
        expect(run.fill).toBe('none');
        expect(run.status).toBe('running');
        expect(run.time).toBe(0);
        expect(run.duration).toBeCloseTo(3 / shard.emitter.params.speed, 12);
        expect(shown.offset.col).toBeCloseTo(group.spawn.col, 12);
        expect(shown.offset.row).toBeCloseTo(group.spawn.row, 12);
        expect(shown.scale).toBeCloseTo(0.001, 12);
        expect(shown.rotate).toBeCloseTo(-(360 + group.angleStep), 12);
        expect(shard.emitter.center.col).toBeCloseTo(group.center.col, 12);
        expect(shard.emitter.center.row).toBeCloseTo(group.center.row, 12);
        expect(shard.emitter.target.col).toBeCloseTo(group.center.col, 12);
        expect(shard.emitter.travel).toBeUndefined();
    });

    it('freezes spawn and spin, so a retarget does not rebuild progress from the gap', () => {
        const ctx = loadHeat();
        const { heatMap, group, shard, run } = addScissor(ctx);
        const spawn = { col: group.spawn.col, row: group.spawn.row };
        const spin = -(360 + group.angleStep);
        const duration = run.duration;
        group.spawn.col += 25;
        group.spawn.row -= 10;
        group.angleStep = 90;
        shard.emitter.setCenter({
            col: shard.emitter.target.col + 40,
            row: shard.emitter.target.row - 15
        });
        const frames = 30;
        for (let frame = 0; frame < frames; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        expect(track(run, 'offset').from).toEqual(spawn);
        expect(track(run, 'rotate').from).toBe(spin);
        const u = ctx.heatEase('expOut', run.time / duration);
        const shown = shard.channels.combined();
        expect(shown.offset.col).toBeCloseTo(spawn.col * (1 - u), 9);
        expect(shown.offset.row).toBeCloseTo(spawn.row * (1 - u), 9);
        expect(shown.rotate).toBeCloseTo(spin * (1 - u), 9);
        expect(shown.scale).toBeCloseTo(0.001 + (1 - 0.001) * u, 9);
        const gap = Math.hypot(
            shard.emitter.target.col - shard.emitter.center.col,
            shard.emitter.target.row - shard.emitter.center.row
        );
        expect(gap).toBeGreaterThan(1);
        expect(Math.abs(shown.rotate - spin * (gap / Math.hypot(spawn.col, spawn.row)))).toBeGreaterThan(1);
    });

    it('finish clears the slot and leaves the shard on its landing cell', async () => {
        const ctx = loadHeat();
        const { shard, run } = addScissor(ctx);
        const landing = { col: shard.emitter.center.col, row: shard.emitter.center.row };
        const pending = run.finished;
        run.finish();
        run.finish();
        expect(run.status).toBe('finished');
        await expect(pending).resolves.toEqual({ status: 'finished' });
        const shown = shard.channels.combined();
        expect(shown.offset).toEqual({ col: 0, row: 0 });
        expect(shown.scale).toBe(1);
        expect(shown.rotate).toBe(0);
        expect(shard.emitter.center.col).toBe(landing.col);
        expect(shard.emitter.center.row).toBe(landing.row);
        expect(shard.attached).toBe(true);
    });

    it('cancel restores identity and remove leaves the shard off the field', async () => {
        const ctx = loadHeat();
        const { heatMap, group } = addScissor(ctx);
        const shard = group.parts[0].object;
        const run = shard._slots.life.active;
        run.cancel();
        expect(run.status).toBe('cancelled');
        await expect(run.finished).resolves.toEqual({ status: 'cancelled' });
        expect(shard.channels.combined().scale).toBe(1);
        expect(shard.attached).toBe(true);
        expect(heatMap.field.highlighters).toContain(shard.emitter);
        const removed = group.removeItem();
        expect(removed).toBe(shard);
        expect(shard.attached).toBe(false);
        expect(heatMap.field.highlighters).not.toContain(shard.emitter);
    });

    it('a second shard does not change the first flight', () => {
        const ctx = loadHeat();
        const { group, shard, run } = addScissor(ctx);
        const spin = track(run, 'rotate').from;
        group.angleStep = 10;
        const second = group.addItem();
        expect(track(run, 'rotate').from).toBe(spin);
        expect(shard.channels.combined().rotate).toBeCloseTo(spin, 12);
        expect(second.channels.combined().rotate).toBeCloseTo(-(360 + 10), 12);
        expect(second._runs).not.toContain(run);
    });
});
