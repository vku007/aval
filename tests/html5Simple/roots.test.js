import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat } from './harness.js';

describe('field roots', () => {
    it('registers each item kind as a root', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        const rod = new ctx.UiHotRod(heatMap);
        const rect = new ctx.UiBackHighlighter(heatMap);
        const shard = new ctx.UiShard(heatMap);
        const sheet = new ctx.UiSheet(heatMap);
        const disk = new ctx.UiNewSheet(heatMap, { ownField: false });
        expect(ball).toBeInstanceOf(ctx.HeatItem);
        expect(ball.parent).toBeNull();
        expect(heatMap.field.roots).toEqual([ball, rod, rect, shard, sheet, disk]);
        [ball, rod, rect, shard, sheet, disk].forEach((item) => {
            expect(item.attached).toBe(true);
            expect(item.field).toBe(heatMap.field);
        });
    });

    it('defers a remove until the tick finishes', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        const motion = ball.motion;
        const advance = motion.advance.bind(motion);
        let stillListed = false;
        motion.advance = (delta) => {
            heatMap.removeBall(motion);
            stillListed = heatMap.field.balls.indexOf(motion) >= 0;
            return advance(delta);
        };
        heatMap.field.update(0, 1000 / 60);
        expect(stillListed).toBe(true);
        expect(heatMap.field.balls).not.toContain(motion);
        expect(ball.attached).toBe(false);
        expect(heatMap.field.roots).not.toContain(ball);
    });

    it('does not tick a root added during the current frame', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        const advance = ball.motion.advance.bind(ball.motion);
        let extra = null;
        ball.motion.advance = (delta) => {
            extra = new ctx.UiHotBall(heatMap);
            return advance(delta);
        };
        heatMap.field.update(0, 1000 / 60);
        expect(heatMap.field.balls).toHaveLength(2);
        expect(extra.motion.t).toBe(0);
        expect(ball.motion.t).toBeGreaterThan(0);
    });

    it('destroy detaches every root and later ticks do nothing', () => {
        const ctx = loadHeat();
        const heatMap = createHeatMap(ctx);
        const ball = new ctx.UiHotBall(heatMap);
        heatMap.field.update(0, 1000 / 60);
        const snapshot = Array.from(heatMap.field.src);
        heatMap.field.destroy();
        expect(ball.attached).toBe(false);
        expect(heatMap.field.roots).toEqual([]);
        expect(heatMap.field.balls).toEqual([]);
        heatMap.field.update(0, 1000 / 60);
        expect(Array.from(heatMap.field.src)).toEqual(snapshot);
    });
});
