import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    GOLDEN_PATH,
    captureIdleHashes,
    idleCases,
    loadHeat,
    createHeatMap,
    stepField
} from './harness.js';

describe('idle goldens', () => {
    it('hashes each item and each 3-item composite after the idle frames', async () => {
        const captured = await captureIdleHashes();
        if (process.env.UPDATE_GOLDENS === '1') {
            fs.mkdirSync(new URL('./goldens/', import.meta.url), { recursive: true });
            fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(captured, null, 2)}\n`);
        }
        const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
        expect(captured.frames).toBe(golden.frames);
        expect(captured.dtMs).toBe(golden.dtMs);
        expect(captured.width).toBe(golden.width);
        expect(captured.height).toBe(golden.height);
        expect(Object.keys(captured.cases).sort()).toEqual(Object.keys(golden.cases).sort());
        Object.keys(golden.cases).forEach((name) => {
            expect(captured.cases[name], name).toBe(golden.cases[name]);
        });
    }, 120000);

    it('repeats the same grid from a second script context', async () => {
        const first = await captureIdleHashes();
        const second = await captureIdleHashes();
        expect(second.cases).toEqual(first.cases);
    }, 120000);

    it('covers every item kind and the four composites', () => {
        expect(Object.keys(idleCases()).sort()).toEqual([
            'back-highlight',
            'hot-ball',
            'hot-rod',
            'new-paper',
            'new-sheet',
            'paper',
            'scissor',
            'shard',
            'sheet',
            'stone'
        ]);
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        expect(heatMap.field.cols).toBeGreaterThan(0);
        expect(heatMap.field.rows).toBeGreaterThan(0);
        expect(typeof stepField).toBe('function');
    });
});
