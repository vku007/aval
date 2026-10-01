import { describe, expect, it } from 'vitest';
import { createHeatMap, loadHeat, parkCompositeIdle } from './harness.js';

const DT = 1000 / 60;

function addStone(ctx, count) {
    const heatMap = createHeatMap(ctx);
    const group = new ctx.HotMapUiStone(heatMap);
    const balls = [];
    for (let index = 0; index < count; index += 1) {
        balls.push(group.addItem());
    }
    return { heatMap, group, balls };
}

function orbitDot(ctx, ball) {
    const motion = ball.motion;
    const frame = ball.channels.combined();
    const phase = frame.phase || 0;
    const angle = motion.angle + phase * Math.PI / 180;
    const off = ctx.rotatedOrbitOffset(motion, angle);
    return {
        col: motion.orbitCenter.col + off.col + frame.offset.col,
        row: motion.orbitCenter.row + off.row + frame.offset.row,
        depth: off.depth
    };
}

function screenSpin(ctx, ball) {
    const motion = ball.motion;
    const frame = ball.channels.combined();
    const off = ctx.rotatedOrbitOffset(motion, motion.angle);
    const phase = frame.phase || 0;
    const rad = phase * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        col: motion.orbitCenter.col + off.col * cos - off.row * sin + frame.offset.col,
        row: motion.orbitCenter.row + off.col * sin + off.row * cos + frame.offset.row
    };
}

describe('stone enter and spread', () => {
    it('places the dot on the spawn point and leaves the orbit center on the stone', () => {
        const ctx = loadHeat();
        const { group, balls } = addStone(ctx, 1);
        const ball = balls[0];
        const run = ball._slots.life.active;
        const shown = orbitDot(ctx, ball);
        expect(run.slotName).toBe('life');
        expect(run.duration).toBeCloseTo(3 / group.spawnSpeed, 12);
        expect(shown.col).toBeCloseTo(group.center.col + group.spawn.col, 8);
        expect(shown.row).toBeCloseTo(group.center.row + group.spawn.row, 8);
        expect(ball.motion.orbitCenter.col).toBeCloseTo(group.center.col, 12);
        expect(ball.motion.orbitCenter.row).toBeCloseTo(group.center.row, 12);
        expect(ball.motion.centerFollow).toBeNull();
        expect(ball.motion.phaseGoal).toBeNull();
        expect(ball.motion.phaseFollow).toBeNull();
        expect(ball._slots.layout).toBeUndefined();
    });

    it('freezes the spawn offset when the stone is retargeted', () => {
        const ctx = loadHeat();
        const { heatMap, group, balls } = addStone(ctx, 1);
        const ball = balls[0];
        const run = ball._slots.life.active;
        const from = {
            col: run.block.channels.offset.from.col,
            row: run.block.channels.offset.from.row
        };
        const duration = run.duration;
        group.spawn.col += 20;
        group.spawnSpeed = 4;
        ball.motion.orbitTarget.col += 30;
        ball.motion.orbitTarget.row -= 12;
        const frames = 24;
        for (let frame = 0; frame < frames; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        const u = ctx.heatEase('expOut', run.time / duration);
        const offset = ball.channels.combined().offset;
        expect(run.block.channels.offset.from).toEqual(from);
        expect(offset.col).toBeCloseTo(from.col * (1 - u), 8);
        expect(offset.row).toBeCloseTo(from.row * (1 - u), 8);
        const gap = Math.hypot(
            ball.motion.orbitTarget.col - ball.motion.orbitCenter.col,
            ball.motion.orbitTarget.row - ball.motion.orbitCenter.row
        );
        expect(gap).toBeGreaterThan(1);
    });

    it('slides every ball along the tilted orbit while the phase eases', () => {
        const ctx = loadHeat();
        const { heatMap, balls } = addStone(ctx, 3);
        const stamped = [];
        const stamp = ctx.stampRotatedHotBall;
        ctx.stampRotatedHotBall = (grid, cols, rows, cx, cy, params, depth) => {
            stamped.push({ cx, cy, depth });
            return stamp(grid, cols, rows, cx, cy, params, depth);
        };
        const frames = 30;
        for (let frame = 0; frame < frames; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        const shown = stamped.slice(-balls.length);
        let leftTheScreenArc = false;
        balls.forEach((ball, index) => {
            const onOrbit = orbitDot(ctx, ball);
            const spun = screenSpin(ctx, ball);
            expect(shown[index].cx).toBeCloseTo(onOrbit.col, 6);
            expect(shown[index].cy).toBeCloseTo(onOrbit.row, 6);
            expect(shown[index].depth).toBeCloseTo(onOrbit.depth, 6);
            if (Math.hypot(shown[index].cx - spun.col, shown[index].cy - spun.row) > 1) {
                leftTheScreenArc = true;
            }
        });
        expect(leftTheScreenArc).toBe(true);
    });

    it('stamps the committed slot on the frame the spread finishes', () => {
        const ctx = loadHeat();
        const { heatMap, balls } = addStone(ctx, 3);
        const duration = balls[0]._slots.layout.active.duration;
        const steps = Math.round(duration * 60);
        for (let frame = 0; frame < steps - 1; frame += 1) {
            heatMap.field.update(frame * DT, DT);
        }
        expect(balls[0]._slots.layout.active.status).toBe('running');
        const spread = balls[0]._slots.layout.active;
        const stamped = [];
        const stamp = ctx.stampRotatedHotBall;
        ctx.stampRotatedHotBall = (grid, cols, rows, cx, cy, params, depth) => {
            stamped.push({ cx: cx, cy: cy, depth: depth });
            return stamp(grid, cols, rows, cx, cy, params, depth);
        };
        heatMap.field.update((steps - 1) * DT, DT);
        expect(spread.status).toBe('finished');
        expect(balls[0]._slots.layout.active).toBeNull();
        expect(stamped).toHaveLength(balls.length);
        let leftTheOldSlot = false;
        balls.forEach((ball, index) => {
            const motion = ball.motion;
            const frame = ball.channels.combined();
            const landed = ctx.rotatedOrbitOffset(motion, motion.angle);
            expect(stamped[index].cx).toBeCloseTo(
                motion.orbitCenter.col + landed.col + frame.offset.col,
                6
            );
            expect(stamped[index].cy).toBeCloseTo(
                motion.orbitCenter.row + landed.row + frame.offset.row,
                6
            );
            const stale = ctx.rotatedOrbitOffset(
                motion,
                motion.angle - ball.fields.phase * Math.PI / 180
            );
            const gap = Math.hypot(
                stamped[index].cx - (motion.orbitCenter.col + stale.col),
                stamped[index].cy - (motion.orbitCenter.row + stale.row)
            );
            if (Math.abs(ball.fields.phase) > 20 && gap > 1) {
                leftTheOldSlot = true;
            }
        });
        expect(leftTheOldSlot).toBe(true);
    });

    it('commits an even phase and clears the channel', () => {
        const ctx = loadHeat();
        const { balls } = addStone(ctx, 2);
        balls.forEach((ball) => {
            const spread = ball._slots.layout.active;
            expect(spread.slotName).toBe('layout');
            expect(spread.fill).toBe('commit');
            expect(spread.duration).toBeCloseTo(2.5, 12);
            const to = spread.block.channels.phase.to;
            const expected = ball.motion.angle + to * Math.PI / 180;
            spread.finish();
            expect(spread.status).toBe('finished');
            expect(ball.motion.angle).toBeCloseTo(expected, 9);
            expect(ball.channels.combined().phase).toBe(0);
            expect(ball.channels.held('phase')).toBe(false);
            expect(ball.fields.phase).toBeCloseTo(to, 9);
            expect(ball.motion.phaseGoal).toBeNull();
        });
        expect(Math.abs(balls[0].motion.angle - balls[1].motion.angle)).toBeGreaterThan(0.5);
    });

    it('replaces a spread from the current phase', () => {
        const ctx = loadHeat();
        const { heatMap, group, balls } = addStone(ctx, 2);
        const ball = balls[1];
        const old = ball._slots.layout.active;
        heatMap.field.update(0, DT);
        const before = ball.channels.combined().phase;
        expect(Math.abs(before)).toBeGreaterThan(0);
        group.addItem();
        expect(old.status).toBe('cancelled');
        const next = ball._slots.layout.active;
        expect(next).not.toBe(old);
        expect(next.block.channels.phase.from).toBeCloseTo(before, 8);
        expect(ball.channels.combined().phase).toBeCloseTo(before, 8);
    });

    it('parks the idle pose on the landing center with the spread committed', () => {
        const ctx = loadHeat();
        const { group, balls } = addStone(ctx, 3);
        const expected = balls.map((ball) => {
            const spread = ball._slots.layout.active;
            return ball.motion.angle + spread.block.channels.phase.to * Math.PI / 180;
        });
        parkCompositeIdle(ctx, group);
        balls.forEach((ball, index) => {
            expect(ball.motion.angle).toBeCloseTo(expected[index], 8);
            expect(ball.channels.combined().phase).toBe(0);
            expect(ball.channels.combined().offset).toEqual({ col: 0, row: 0 });
            expect(ball.motion.orbitCenter.col).toBeCloseTo(group.center.col, 12);
            expect(ball.motion.centerFollow).toBeNull();
            expect(ball.motion.phaseGoal).toBeNull();
        });
    });
});
