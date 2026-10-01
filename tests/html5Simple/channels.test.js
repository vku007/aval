import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLDEN_PATH, createHeatMap, loadHeat, stepField } from './harness.js';

const DT = 1000 / 60;

function hotCell(src, cols) {
    let best = -1;
    let at = 0;
    for (let index = 0; index < src.length; index += 1) {
        if (src[index] > best) {
            best = src[index];
            at = index;
        }
    }
    return { col: at % cols, row: Math.floor(at / cols) };
}

function stepOnce(heatMap) {
    heatMap.field.update(0, DT);
}

describe('channel combiner', () => {
    it('adds offsets, multiplies scale, and keeps the latest pose', () => {
        const ctx = loadHeat();
        const channels = new ctx.HeatChannels('back-highlight');
        expect(channels.combined()).toEqual({
            offset: { col: 0, row: 0 },
            rotate: 0,
            scale: 1,
            heat: 1,
            pose: 0
        });
        channels.set('a', { offset: { col: 1, row: 2 }, scale: 2, pose: 0.25 }, 1);
        channels.set('b', { offset: { col: 3, row: 4 }, scale: 3, pose: 0.9 }, 2);
        channels.set('c', { pose: 0.1 }, 2);
        expect(channels.combined().offset).toEqual({ col: 4, row: 6 });
        expect(channels.combined().scale).toBe(6);
        expect(channels.combined().pose).toBe(0.1);
        channels.clear('c');
        expect(channels.combined().pose).toBe(0.9);
        channels.clear('b');
        expect(channels.combined().offset).toEqual({ col: 1, row: 2 });
        expect(channels.combined().scale).toBe(2);
        channels.clear();
        expect(channels.combined().offset).toEqual({ col: 0, row: 0 });
        expect(channels.held('pose')).toBe(false);
    });
});

describe('stamp channels', () => {
    it('shifts a ball with offset and restores the idle golden when cleared', async () => {
        const ctx = loadHeat();
        const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
        const plain = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(plain);
        stepOnce(plain);
        const origin = hotCell(plain.field.src, plain.field.cols);

        const moved = createHeatMap(ctx);
        const shifted = new ctx.UiHotBall(moved);
        shifted.channels.set('probe', { offset: { col: 18, row: -11 } });
        stepOnce(moved);
        const peak = hotCell(moved.field.src, moved.field.cols);
        expect(peak.col - origin.col).toBeGreaterThan(8);
        expect(origin.row - peak.row).toBeGreaterThan(4);

        const restoredMap = createHeatMap(ctx);
        const restored = new ctx.UiHotBall(restoredMap);
        restored.channels.set('probe', { offset: { col: 18, row: -11 } });
        restored.channels.clear('probe');
        expect(await stepField(restoredMap)).toBe(golden.cases['hot-ball']);
        expect(ball.channels.combined().offset).toEqual({ col: 0, row: 0 });
    }, 30000);

    it('shifts a stone from the group offset and returns when that contribution is cleared', async () => {
        const ctx = loadHeat();
        async function run(mode) {
            const heatMap = createHeatMap(ctx);
            const group = new ctx.HotMapUiStone(heatMap);
            const item = group.addItem();
            expect(item.parent).toBe(group);
            expect(group.channels.combined()).toEqual({
                offset: { col: 0, row: 0 },
                rotate: 0,
                scale: 1,
                heat: 1
            });
            if (mode !== 'plain') {
                group.channels.set('probe', { offset: { col: 14, row: 0 } });
            }
            if (mode === 'clear') {
                group.channels.clear('probe');
            }
            return stepField(heatMap, 20);
        }
        const plain = await run('plain');
        const shifted = await run('shift');
        const cleared = await run('clear');
        expect(shifted).not.toBe(plain);
        expect(cleared).toBe(plain);
    }, 30000);
});
