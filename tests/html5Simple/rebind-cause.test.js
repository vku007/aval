import { describe, expect, it } from 'vitest';
import { createHeatMap, DT_MS, loadHeat } from './harness.js';

/**
 * Slice 1h. Waits and pulses are field-clock runs. Destroying the field
 * cancels them and drops their rods and disks. A response that arrives
 * after that destroy must not be applied.
 */
describe('field destroy cancels the move chain', () => {
    it('cancels a field wait and does not advance it after destroy', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const run = ctx.heatFieldWait(heatMap.field, 5);
        expect(run.status).toBe('running');
        expect(run.time).toBe(0);
        heatMap.field.update(0, DT_MS);
        expect(run.time).toBeCloseTo(DT_MS / 1000, 9);
        heatMap.field.destroy();
        await expect(run.finished).resolves.toEqual({ status: 'cancelled' });
        heatMap.field.update(DT_MS, DT_MS);
        expect(run.status).toBe('cancelled');
    });

    it('holds a pulse until the field ticks, then drops the rod on destroy', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const panel = { x: 0, y: 200, width: 390, height: 120 };
        const pulse = new ctx.HorisontalPulse(heatMap, { panel });
        const run = pulse.play();
        expect(run.status).toBe('running');
        expect(run.time).toBe(0);
        expect(heatMap.field.rods).toHaveLength(1);
        const start = pulse.rod.channels.combined().offset.row;
        expect(start).not.toBe(0);
        heatMap.field.update(0, DT_MS);
        expect(run.time).toBeCloseTo(DT_MS / 1000, 9);
        expect(Math.abs(pulse.rod.channels.combined().offset.row)).toBeLessThan(Math.abs(start));
        heatMap.field.destroy();
        await expect(run.finished).resolves.toEqual({ status: 'cancelled' });
        expect(heatMap.field.rods).toEqual([]);
    });

    it('finishes a pulse by detaching the rod', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const panel = { x: 0, y: 40, width: 200, height: 80 };
        const pulse = new ctx.VerticalPulse(heatMap, { panel });
        const run = pulse.play();
        expect(heatMap.field.rods).toHaveLength(1);
        run.finish();
        await expect(run.finished).resolves.toEqual({ status: 'finished' });
        expect(heatMap.field.rods).toEqual([]);
        run.finish();
        expect(run.status).toBe('finished');
    });

    it('cancels a reveal and a staggered clear without leaving disks', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const enemy = new ctx.HotMapUiNewPaper(heatMap);
        enemy.specCount = 0;
        const reveal = enemy.reveal(3);
        expect(enemy.items.length).toBe(1);
        heatMap.field.destroy();
        await expect(reveal.finished).resolves.toEqual({ status: 'cancelled' });
        expect(heatMap.field.highlighters).toEqual([]);

        const next = createHeatMap(ctx);
        const stack = new ctx.HotMapUiNewPaper(next);
        stack.specCount = 0;
        stack.addItem({ animate: false });
        stack.addItem({ animate: false });
        stack.addItem({ animate: false });
        const clearing = stack.clear();
        expect(stack.items.length).toBeGreaterThan(0);
        next.field.destroy();
        await expect(clearing.finished).resolves.toEqual({ status: 'cancelled' });
        expect(next.field.highlighters).toEqual([]);
        expect(next.field.rods).toEqual([]);
    });

    it('does not apply a network response after the field is destroyed', async () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const field = heatMap.field;
        let applied = null;
        let release;
        const network = new Promise((resolve) => {
            release = resolve;
        });
        const chain = (async () => {
            const response = await network;
            if (!field || field.destroyed || heatMap.field !== field) {
                return;
            }
            applied = response;
        })();
        field.destroy();
        const fresh = createHeatMap(ctx);
        heatMap.field = fresh.field;
        release({ exchange: 'old' });
        await chain;
        expect(applied).toBeNull();
        expect(fresh.field.destroyed).toBe(false);
    });

    it('resets a round back to an empty spec before reveal', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const group = new ctx.HotMapUiStone(heatMap);
        group.specCount = 0;
        group.addItem({ animate: false });
        group.addItem({ animate: false });
        expect(group.items).toHaveLength(2);
        group.reset({ items: 'spec' });
        expect(group.items).toHaveLength(0);
        const reveal = group.reveal(2);
        expect(group.items).toHaveLength(1);
        reveal.finish();
        expect(group.items).toHaveLength(2);
    });
});
